import json
import os
import traceback
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

import boto3
from common.db import SessionLocal
from common.i18n import get_requested_lang
from common.localize import apply_cached_listing_i18n
from common.models import BookingORM, ListingORM, ReviewORM, UserORM
from common.serializers import to_out
from common.translate import translate_text
from sqlalchemy import func

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Accept-Language,x-language",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}

DEBUG = os.environ.get("DEBUG_ERRORS", "false").lower() == "true"

AVAIL_TABLE_NAME = os.environ.get("AVAILABILITY_TABLE")
_avail_table = None

try:
    if AVAIL_TABLE_NAME:
        _dynamodb = boto3.resource("dynamodb")
        _avail_table = _dynamodb.Table(AVAIL_TABLE_NAME)
        print(f"Availability table initialized: {AVAIL_TABLE_NAME}")
    else:
        print("WARNING: AVAILABILITY_TABLE not set")
except Exception as e:
    print(f"ERROR initializing DynamoDB availability table: {repr(e)}")


def _resp(body: Dict, status: int = 200) -> Dict:
    return {
        "statusCode": status,
        "headers": CORS,
        "body": json.dumps(body, default=str),
    }


def _get_sub_and_email(event) -> Tuple[Optional[str], Optional[str]]:
    try:
        claims = (
            event.get("requestContext", {})
            .get("authorizer", {})
            .get("jwt", {})
            .get("claims", {})
        )
        return claims.get("sub"), claims.get("email")
    except Exception as e:
        print(f"ERROR extracting claims: {repr(e)}")
        return None, None


def _get_or_create_user(db, sub: str, email: str) -> UserORM:
    user = db.query(UserORM).filter(UserORM.cognito_sub == sub).one_or_none()
    if not user:
        user = UserORM(cognito_sub=sub, email=email or f"{sub}@example.com")
        db.add(user)
        db.flush()
    return user


def _recalculate_listing_rating(db, listing_id: int):
    stats = (
        db.query(
            func.count(ReviewORM.id).label("count"),
            func.avg(ReviewORM.rating).label("avg_rating"),
        )
        .filter(ReviewORM.listing_id == listing_id)
        .one()
    )

    count = stats.count or 0
    avg_rating = float(stats.avg_rating) if stats.avg_rating is not None else 0.0

    listing = db.get(ListingORM, listing_id)
    if listing:
        listing.review_count = count
        listing.rating = avg_rating


def _generate_booking_code():
    import random
    import string
    return "BK" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _format_guest_name(full_name: str) -> str:
    if not full_name or not full_name.strip():
        return "Guest"
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0]
    first = parts[0]
    last_initial = parts[-1][0].upper() + "."
    return f"{first} {last_initial}"


# -----------------------------
# Best-effort "script conversion"
# (English -> Telugu script, etc.)
# -----------------------------
_TRANSLATE_CACHE: Dict[Tuple[str, str], str] = {}
_TRANSLATE_CACHE_MAX = 2000


def _to_local_script(text: Optional[str], lang: str) -> Optional[str]:
    """
    Best-effort conversion to target language script using AWS Translate.
    This usually produces Telugu script for English/Latin names + titles.

    Not a strict transliteration engine, but matches your current listing approach.
    """
    text = (text or "").strip()
    lang = (lang or "en").strip().lower()

    if not text or lang == "en":
        return text

    key = (lang, text)
    if key in _TRANSLATE_CACHE:
        return _TRANSLATE_CACHE[key]

    try:
        translated, _src = translate_text(text, lang)
        out = (translated or text).strip()
    except Exception as e:
        print(f"Translate failed for '{text}' -> {lang}: {repr(e)}")
        out = text

    if len(_TRANSLATE_CACHE) >= _TRANSLATE_CACHE_MAX:
        _TRANSLATE_CACHE.clear()

    _TRANSLATE_CACHE[key] = out
    return out


def _translated_listing_fields(listing: Optional[ListingORM], lang: str) -> Dict[str, Optional[str]]:
    """
    1) Prefer cached listing.i18n[lang] via apply_cached_listing_i18n (cheap)
    2) Fallback to AWS Translate to convert title/location to the target script
    """
    if not listing:
        return {"title": None, "location": None}

    lang = (lang or "en").strip().lower()

    payload = to_out(listing)

    # Apply cached i18n first
    if lang != "en":
        payload = apply_cached_listing_i18n(payload, listing.i18n or {}, lang)

    title = payload.get("title") or getattr(listing, "title", None)
    location = payload.get("location") or getattr(listing, "location", None) or payload.get("city")

    # Fallback: convert to local script even if cache didn't exist
    if lang != "en":
        if title:
            title = _to_local_script(title, lang)
        if location:
            location = _to_local_script(location, lang)

    return {"title": title, "location": location}


def _mark_dates_booked(
    listing_id: int,
    check_in: date,
    check_out: date,
    guest_name: Optional[str],
    nightly_price: Optional[float],
    booking_id: Optional[int] = None,
) -> None:
    if _avail_table is None:
        return

    try:
        cur = check_in
        while cur < check_out:
            item = {
                "listing_id": str(listing_id),
                "date": cur.isoformat(),
                "status": "booked",
            }

            if nightly_price is not None:
                item["price"] = Decimal(str(nightly_price))

            if guest_name:
                item["guest_name"] = _format_guest_name(guest_name)

            if booking_id is not None:
                item["booking_id"] = str(booking_id)

            _avail_table.put_item(Item=item)
            cur += timedelta(days=1)
    except Exception as e:
        print(f"Failed to write booked availability rows: {repr(e)}")


def _mark_dates_available(listing_id: int, check_in: date, check_out: date) -> None:
    if _avail_table is None:
        return

    try:
        cur = check_in
        while cur < check_out:
            item = {
                "listing_id": str(listing_id),
                "date": cur.isoformat(),
                "status": "available",
            }
            _avail_table.put_item(Item=item)
            cur += timedelta(days=1)
    except Exception as e:
        print(f"Failed to write available availability rows: {repr(e)}")


# ----------------------------------------------------------
# POST /v1/bookings - Create a booking (Guest)
# ----------------------------------------------------------
def create_booking(event, _ctx):
    lang = get_requested_lang(event)

    try:
        sub, email = _get_sub_and_email(event)
        if not sub:
            return _resp({"detail": "Unauthorized"}, 401)

        try:
            body = json.loads(event.get("body") or "{}")
        except Exception:
            return _resp({"detail": "Invalid JSON body"}, 400)

        listing_id   = body.get("listing_id")
        check_in     = body.get("check_in")
        check_out    = body.get("check_out")
        guests       = body.get("guests", 1)
        total_paid   = body.get("total_paid", 0)
        room_type_id = body.get("room_type_id")  # ✅ optional, hotels only

        if not listing_id or not check_in or not check_out:
            return _resp({"detail": "Missing required fields: listing_id, check_in, check_out"}, 400)

        try:
            check_in_date  = datetime.strptime(check_in,  "%Y-%m-%d").date()
            check_out_date = datetime.strptime(check_out, "%Y-%m-%d").date()
        except Exception:
            return _resp({"detail": "Invalid date format. Use YYYY-MM-DD"}, 400)

        if check_out_date <= check_in_date:
            return _resp({"detail": "Check-out must be after check-in"}, 400)

        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)

            pk = int(listing_id) if str(listing_id).isdigit() else listing_id
            listing = db.get(ListingORM, pk)
            if not listing:
                return _resp({"detail": "Listing not found"}, 404)

            if listing.status != "live":
                return _resp({"detail": "Listing is not available for booking"}, 400)

            conflict = (
                db.query(BookingORM)
                .filter(
                    BookingORM.listing_id == listing.id,
                    BookingORM.status.in_(["pending", "confirmed"]),
                    BookingORM.check_in  < check_out_date,
                    BookingORM.check_out > check_in_date,
                )
                .first()
            )
            if conflict:
                return _resp({"detail": "Listing is already booked for those dates"}, 409)

            # ✅ Validate room type if provided
            room_type            = None
            room_type_name_snap  = None
            nightly_price        = listing.price  # default to listing base price
            if room_type_id:
                from common.models import HotelRoomTypeORM
                room_type = db.get(HotelRoomTypeORM, int(room_type_id))
                if not room_type or room_type.listing_id != listing.id:
                    return _resp({"detail": "Invalid room_type_id for this listing"}, 400)
                room_type_name_snap = room_type.name
                # Use room type price if it has one, otherwise fall back to listing price
                if room_type.price is not None:
                    nightly_price = room_type.price

            booking_code = _generate_booking_code()

            if user.profile and user.profile.full_name:
                guest_name = _format_guest_name(user.profile.full_name)
            else:
                guest_name = (email or "Guest").split("@")[0]

            booking = BookingORM(
                booking_code   = booking_code,
                listing_id     = listing.id,
                host_user_id   = listing.host_user_id or user.id,
                guest_user_id  = user.id,
                check_in       = check_in_date,
                check_out      = check_out_date,
                guests         = int(guests),
                total_paid     = float(total_paid),
                payout_amount  = None,
                status         = "confirmed",
                guest_name     = guest_name,
                guest_email    = user.email,
                listing_name   = listing.title,       # snapshot
                room_type_id   = room_type.id if room_type else None,    # ✅
                room_type_name = room_type_name_snap,                    # ✅
            )

            db.add(booking)
            db.commit()
            db.refresh(booking)

            _mark_dates_booked(
                listing_id    = listing.id,
                check_in      = check_in_date,
                check_out     = check_out_date,
                guest_name    = guest_name,
                nightly_price = nightly_price,  # ✅ uses room type price if available
                booking_id    = booking.id,
            )

            t = _translated_listing_fields(listing, lang)

            response_booking = {
                "id":              booking.id,
                "booking_id":      booking.id,
                "booking_code":    booking.booking_code,
                "listing_name":    t["title"] or booking.listing_name,
                "listing_image":   listing.photo_url,
                "listing_location": t["location"],
                "check_in":        booking.check_in.isoformat(),
                "check_out":       booking.check_out.isoformat(),
                "guests":          booking.guests,
                "total_paid":      booking.total_paid,
                "status":          booking.status,
                "room_type_id":    booking.room_type_id,    # ✅
                "room_type_name":  booking.room_type_name,  # ✅
            }

            return _resp({"ok": True, "booking": response_booking}, 201)

    except Exception as e:
        traceback.print_exc()
        return _resp({"detail": str(e) if DEBUG else "Internal error."}, 500)


# ----------------------------------------------------------
# GET /v1/bookings - List my bookings (Guest)
# ----------------------------------------------------------
def list_my_bookings(event, _ctx):
    lang = get_requested_lang(event)

    try:
        sub, email = _get_sub_and_email(event)
        if not sub:
            return _resp({"detail": "Unauthorized"}, 401)

        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)

            bookings: List[BookingORM] = (
                db.query(BookingORM)
                .filter(BookingORM.guest_user_id == user.id)
                .order_by(BookingORM.created_at.desc())
                .all()
            )

            def to_dict(b: BookingORM):
                listing = b.listing
                review  = b.review

                today = date.today()
                can_review = (
                    b.guest_user_id == user.id
                    and b.check_out <= today
                    and review is None
                    and b.status in ("confirmed", "completed", "cancelled")
                )

                effective_status = b.status
                if b.status == "cancelled":
                    effective_status = "cancelled"
                elif b.check_out <= today and b.status in ("confirmed", "completed"):
                    effective_status = "completed"

                t = {"title": None, "location": None}
                if listing:
                    t = _translated_listing_fields(listing, lang)

                # Guest-side: include host_name and convert it to local script
                host_name = None
                if listing and listing.host and listing.host.profile and listing.host.profile.full_name:
                    host_name = _format_guest_name(listing.host.profile.full_name)
                    host_name = _to_local_script(host_name, lang)

                return {
                    "id":               b.id,
                    "booking_id":       b.id,
                    "booking_code":     b.booking_code,
                    "listing_name":     t["title"] or b.listing_name,
                    "listing_image":    listing.photo_url if listing else None,
                    "listing_location": t["location"],
                    "check_in":         b.check_in.isoformat(),
                    "check_out":        b.check_out.isoformat(),
                    "guests":           b.guests,
                    "total_paid":       b.total_paid,
                    "status":           effective_status,
                    "host_name":        host_name,
                    "room_type_id":     b.room_type_id,    # ✅
                    "room_type_name":   b.room_type_name,  # ✅ mytrips.tsx reads this
                    "review": {
                        "id":         review.id,
                        "rating":     review.rating,
                        "comment":    review.comment,
                        "created_at": review.created_at.isoformat() if review and review.created_at else None,
                    } if review else None,
                    "can_review": can_review,
                }

            data = [to_dict(b) for b in bookings]
            return _resp({"count": len(data), "bookings": data})

    except Exception as e:
        traceback.print_exc()
        return _resp({"detail": str(e) if DEBUG else "Internal error."}, 500)

# ----------------------------------------------------------
# GET /v1/host/bookings - List bookings for my listings (Host)
# ----------------------------------------------------------
def list_host_bookings(event, _ctx):
    lang = get_requested_lang(event)

    try:
        sub, email = _get_sub_and_email(event)
        if not sub:
            return _resp({"detail": "Unauthorized"}, 401)

        qs = event.get("queryStringParameters") or {}
        status_filter = qs.get("status")

        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)

            q = db.query(BookingORM).filter(BookingORM.host_user_id == user.id)
            if status_filter:
                q = q.filter(BookingORM.status == status_filter)

            bookings: List[BookingORM] = q.order_by(BookingORM.created_at.desc()).all()

            def to_dict(b: BookingORM):
                listing = b.listing
                guest = b.guest
                today = date.today()
                effective_status = b.status

                if b.status == "cancelled":
                    effective_status = "cancelled"
                elif b.check_out <= today and b.status in ("confirmed", "completed"):
                    effective_status = "completed"

                guest_avatar_url = None
                if guest and guest.profile:
                    guest_avatar_url = guest.profile.avatar_url

                t = {"title": None, "location": None}
                if listing:
                    t = _translated_listing_fields(listing, lang)


                # ✅ Host-side: convert guest_name to local script
                guest_name = _to_local_script(b.guest_name, lang)

                return {
                    "id": b.id,
                    "booking_id": b.id,
                    "booking_code": b.booking_code,
                    "guest_name": guest_name or b.guest_name,
                    "guest_email": b.guest_email,
                    "guest_avatar_url": guest_avatar_url,
                    "listing_name": t["title"] or b.listing_name,
                    "listing_image": listing.photo_url if listing else None,
                    "listing_location": t["location"],
                    "check_in": b.check_in.isoformat(),
                    "check_out": b.check_out.isoformat(),
                    "guests": b.guests,
                    "total_paid": b.total_paid,
                    "status": effective_status,
                    "created_at": b.created_at.isoformat() if b.created_at else None,
                }

            items = [to_dict(b) for b in bookings]

            result = {
                "requests": [i for i in items if i["status"] == "pending"],
                "upcoming": [i for i in items if i["status"] == "confirmed"],
                "past": [i for i in items if i["status"] in ("completed", "cancelled")],
                "all": items,
            }

            return _resp(result)

    except Exception as e:
        traceback.print_exc()
        return _resp({"detail": str(e) if DEBUG else "Internal error."}, 500)


def update_host_booking(event, _ctx):
    try:
        sub, email = _get_sub_and_email(event)
        if not sub:
            return _resp({"detail": "Unauthorized"}, 401)

        path = event.get("pathParameters") or {}
        booking_id = path.get("booking_id") or path.get("id")
        if not booking_id:
            return _resp({"detail": "Missing booking_id"}, 400)

        action = "cancel"
        if event.get("body"):
            try:
                body = json.loads(event.get("body") or "{}")
            except Exception:
                return _resp({"detail": "Invalid JSON body"}, 400)

            if body.get("action"):
                action = (body.get("action") or "").strip().lower()

        if action != "cancel":
            return _resp({"detail": "Only action supported is: cancel"}, 400)

        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)

            booking = db.get(BookingORM, int(booking_id))
            if not booking:
                return _resp({"detail": "Booking not found"}, 404)

            if booking.host_user_id != user.id:
                return _resp({"detail": "Forbidden"}, 403)

            if booking.status == "cancelled":
                return _resp({"ok": True, "booking_id": booking.id, "status": booking.status})

            now = datetime.utcnow()
            booking.status = "cancelled"
            booking.cancelled_at = now
            booking.cancelled_by = user.id
            booking.updated_at = now
            db.commit()

            _mark_dates_available(booking.listing_id, booking.check_in, booking.check_out)

            return _resp({"ok": True, "booking_id": booking.id, "status": booking.status})

    except Exception as e:
        traceback.print_exc()
        return _resp({"detail": str(e) if DEBUG else "Internal error."}, 500)


def cancel_booking(event, _ctx):
    try:
        sub, email = _get_sub_and_email(event)
        if not sub:
            return _resp({"detail": "Unauthorized"}, 401)

        path = event.get("pathParameters") or {}
        booking_id = path.get("booking_id") or path.get("id")
        if not booking_id:
            return _resp({"detail": "Missing booking_id"}, 400)

        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)

            booking = db.get(BookingORM, int(booking_id))
            if not booking:
                return _resp({"detail": "Booking not found"}, 404)

            if booking.guest_user_id != user.id:
                return _resp({"detail": "Forbidden"}, 403)

            if booking.status == "cancelled":
                return _resp({"ok": True, "booking_id": booking.id, "status": booking.status})

            now = datetime.utcnow()
            booking.status = "cancelled"
            booking.cancelled_at = now
            booking.cancelled_by = user.id
            booking.updated_at = now
            db.commit()

            _mark_dates_available(booking.listing_id, booking.check_in, booking.check_out)

            return _resp({"ok": True, "booking_id": booking.id, "status": booking.status})

    except Exception as e:
        traceback.print_exc()
        return _resp({"detail": str(e) if DEBUG else "Internal error."}, 500)


def create_or_update_review(event, _ctx):
    try:
        sub, email = _get_sub_and_email(event)
        if not sub:
            return _resp({"detail": "Unauthorized"}, 401)

        path = event.get("pathParameters") or {}
        booking_id = path.get("booking_id") or path.get("id")
        if not booking_id:
            return _resp({"detail": "Missing booking_id"}, 400)

        try:
            body = json.loads(event.get("body") or "{}")
        except Exception:
            return _resp({"detail": "Invalid JSON body"}, 400)

        rating = body.get("rating")
        comment = (body.get("comment") or "").strip()

        if rating is None:
            return _resp({"detail": "rating is required"}, 400)

        try:
            rating = int(rating)
        except ValueError:
            return _resp({"detail": "rating must be an integer"}, 400)

        if rating < 1 or rating > 5:
            return _resp({"detail": "rating must be between 1 and 5"}, 400)

        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)

            booking = db.get(BookingORM, int(booking_id))
            if not booking:
                return _resp({"detail": "Booking not found"}, 404)

            if booking.guest_user_id != user.id:
                return _resp({"detail": "Forbidden"}, 403)

            today = date.today()
            if booking.check_out > today and booking.status not in ("completed", "cancelled"):
                return _resp({"detail": "You can review after your stay ends"}, 400)

            listing = booking.listing
            if not listing:
                return _resp({"detail": "Listing no longer exists"}, 400)

            review = (
                db.query(ReviewORM)
                .filter(ReviewORM.booking_id == booking.id)
                .one_or_none()
            )

            now = datetime.utcnow()
            if review:
                review.rating = rating
                review.comment = comment
                review.updated_at = now
            else:
                review = ReviewORM(
                    listing_id=listing.id,
                    booking_id=booking.id,
                    guest_user_id=user.id,
                    rating=rating,
                    comment=comment,
                    created_at=now,
                    updated_at=now,
                )
                db.add(review)

            _recalculate_listing_rating(db, listing.id)

            if booking.status == "confirmed" and booking.check_out <= today:
                booking.status = "completed"
                booking.completed_at = now
                booking.updated_at = now

            db.commit()
            db.refresh(review)
            db.refresh(listing)

            resp_review = {
                "id": review.id,
                "rating": review.rating,
                "comment": review.comment,
                "created_at": review.created_at.isoformat() if review.created_at else None,
            }

            return _resp(
                {
                    "ok": True,
                    "review": resp_review,
                    "listing": {
                        "id": listing.id,
                        "rating": listing.rating,
                        "review_count": listing.review_count,
                    },
                },
                201,
            )

    except Exception as e:
        traceback.print_exc()
        return _resp({"detail": str(e) if DEBUG else "Internal error."}, 500)
