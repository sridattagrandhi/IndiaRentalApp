# backend/functions/reviews/handler.py
import json
import os
from datetime import datetime, timezone
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

from common.db import SessionLocal
from common.i18n import SUPPORTED_LANGS, get_requested_lang
from common.models import (BookingORM, ListingORM, ProfileORM, ReviewORM,
                           UserORM)
from common.translate import translate_text, translate_text_auto
from sqlalchemy import desc, func

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Accept-Language,x-language",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}

DEBUG = os.environ.get("DEBUG_ERRORS", "false").lower() == "true"


def _resp(body, status=200):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, default=str)}


def _normalize_lang(code: str | None) -> str:
    code = (code or "").strip().lower()
    code = code.split("-")[0] if code else "en"
    return code if code in SUPPORTED_LANGS else "en"


def _get_sub_and_email(event) -> Tuple[Optional[str], Optional[str]]:
    claims = (
        (event.get("requestContext", {}) or {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    return claims.get("sub"), claims.get("email")


def _get_or_create_user(db, sub: str, email: str) -> UserORM:
    user = db.query(UserORM).filter(UserORM.cognito_sub == sub).one_or_none()
    if not user:
        user = UserORM(cognito_sub=sub, email=email)
        db.add(user)
        db.flush()
    return user


def _recompute_listing_rating(db, listing_id: int):
    agg = (
        db.query(
            func.count(ReviewORM.id).label("cnt"),
            func.avg(ReviewORM.rating).label("avg"),
        )
        .filter(ReviewORM.listing_id == listing_id)
        .one()
    )
    listing = db.get(ListingORM, listing_id)
    if listing:
        listing.review_count = int(agg.cnt or 0)
        listing.rating = float(agg.avg or 0.0)
        db.add(listing)


def _translate_if_needed(text: Optional[str], lang: str) -> Tuple[Optional[str], bool]:
    lang = _normalize_lang(lang)
    if not text or not isinstance(text, str) or not text.strip():
        return text, False
    if not lang or lang == "en":
        return text, False
    try:
        t, _src = translate_text(text, lang)
        return t, True
    except Exception:
        return text, False


def _translate_title_if_needed(title: Optional[str], lang: str) -> Tuple[Optional[str], bool]:
    lang = _normalize_lang(lang)
    if not title or not isinstance(title, str) or not title.strip():
        return title, False
    if not lang or lang == "en":
        return title, False
    try:
        t, _src = translate_text(title, lang)
        return t, True
    except Exception:
        return title, False


def _ensure_profile_name_i18n(db, prof: Optional[ProfileORM], target_lang: str):
    """
    Ensures prof.i18n[target_lang]["name"] exists (translated full_name).
    Best-effort; safe if migration not applied yet.
    """
    if not prof:
        return
    target_lang = _normalize_lang(target_lang)
    if not target_lang or target_lang == "en":
        return

    full_name = getattr(prof, "full_name", None)
    if not isinstance(full_name, str) or not full_name.strip():
        return

    try:
        i18n = prof.i18n or {}
        lang_cache = i18n.get(target_lang) or {}
        cached = lang_cache.get("name")
        if isinstance(cached, str) and cached.strip():
            return

        t, src = translate_text(full_name.strip(), target_lang)
        lang_cache["name"] = t
        if src and not getattr(prof, "source_language", None):
            prof.source_language = src

        i18n[target_lang] = lang_cache
        prof.i18n = i18n
        db.add(prof)
    except Exception:
        # if i18n column isn't present yet or translate fails, ignore
        return


def _get_profile_name_for_lang(prof: Optional[ProfileORM], lang: str) -> Optional[str]:
    if not prof:
        return None
    lang = _normalize_lang(lang)
    if not lang or lang == "en":
        return getattr(prof, "full_name", None)
    try:
        cache = (prof.i18n or {}).get(lang) or {}
        t = cache.get("name")
        if isinstance(t, str) and t.strip():
            return t
    except Exception:
        pass
    return getattr(prof, "full_name", None)


# -------------------------
# POST /v1/reviews
# -------------------------
def create_review(event, _ctx):
    sub, email = _get_sub_and_email(event)
    if not sub:
        return _resp({"detail": "Unauthorized"}, 401)

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp({"detail": "Invalid JSON body"}, 400)

    booking_id = body.get("booking_id")
    rating = body.get("rating")
    comment = body.get("comment")

    try:
        booking_id = int(booking_id)
    except Exception:
        return _resp({"detail": "booking_id must be an integer"}, 400)

    try:
        rating = float(rating)
    except Exception:
        return _resp({"detail": "rating must be a number"}, 400)

    if rating < 1 or rating > 5 or (rating * 2) % 1 != 0:
        return _resp({"detail": "rating must be between 1 and 5 in 0.5 increments"}, 400)

    try:
        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)

            booking = db.get(BookingORM, booking_id)
            if not booking:
                return _resp({"detail": "Booking not found"}, 404)

            if str(booking.guest_user_id) != str(user.id):
                return _resp({"detail": "Forbidden"}, 403)

            check_out = getattr(booking, "check_out", None)
            status = (getattr(booking, "status", None) or "").lower()
            completed_at = getattr(booking, "completed_at", None)

            ist_today = datetime.now(ZoneInfo("Asia/Kolkata")).date()

            if check_out and check_out < ist_today and completed_at is None and status != "cancelled":
                booking.status = "completed"
                booking.completed_at = datetime.now(timezone.utc)
                db.add(booking)
                db.flush()

            status = (getattr(booking, "status", None) or "").lower()
            completed_at = getattr(booking, "completed_at", None)
            if not (status == "completed" or completed_at is not None):
                return _resp({"detail": "You can only review a completed booking"}, 400)

            existing = db.query(ReviewORM).filter(ReviewORM.booking_id == booking_id).one_or_none()
            if existing:
                return _resp({"detail": "Review already exists for this booking"}, 409)

            _, src_lang = translate_text_auto(comment, "en")

            review = ReviewORM(
                listing_id=int(booking.listing_id),
                booking_id=int(booking.id),
                guest_user_id=str(user.id),
                rating=rating,
                comment=comment,                 # original text
                source_language=src_lang or "en" # 👈 IMPORTANT
            )
            db.add(review)
            db.flush()

            _recompute_listing_rating(db, int(booking.listing_id))

            db.commit()
            db.refresh(review)

            return _resp(
                {
                    "review": {
                        "id": review.id,
                        "listing_id": review.listing_id,
                        "booking_id": review.booking_id,
                        "guest_user_id": review.guest_user_id,
                        "rating": review.rating,
                        "comment": review.comment,
                        "created_at": review.created_at,
                    }
                },
                201,
            )
    except Exception as e:
        print("Unhandled error in create_review:", repr(e))
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)
    
def _ensure_review_i18n(db, review: ReviewORM, target_lang: str):
    """Cache review comment translations"""
    target_lang = _normalize_lang(target_lang)

    if (
        not review.comment or
        not target_lang or
        target_lang == review.source_language
    ):
        return
    
    i18n = review.i18n or {}
    lang_cache = i18n.get(target_lang) or {}
    
    # Check if already cached
    if lang_cache.get("comment"):
        return
    
    try:
        translated, src = translate_text(review.comment, target_lang)
        lang_cache["comment"] = translated
        
        if src and not review.source_language:
            review.source_language = src
        
        i18n[target_lang] = lang_cache
        review.i18n = i18n
        db.add(review)
    except Exception:
        pass


# -------------------------
# GET /v1/listings/{listing_id}/reviews
# -------------------------
def list_listing_reviews(event, _ctx):
    path = event.get("pathParameters") or {}
    pid = path.get("listing_id") or path.get("id")
    try:
        listing_id = int(pid)
    except Exception:
        return _resp({"detail": "Invalid listing id"}, 400)

    lang = _normalize_lang(get_requested_lang(event))

    try:
        with SessionLocal() as db:
            rows = (
                db.query(ReviewORM, UserORM, ProfileORM)
                .join(UserORM, UserORM.id == ReviewORM.guest_user_id)
                .outerjoin(ProfileORM, ProfileORM.user_id == UserORM.id)
                .filter(ReviewORM.listing_id == listing_id)
                .order_by(desc(ReviewORM.created_at))
                .limit(200)
                .all()
            )

            reviews = []
            for r, u, prof in rows:
                # Ensure translation cache exists
                _ensure_review_i18n(db, r, lang)

                # Get translated comment from cache
                comment = r.comment
                translated = False

                # If the requested language differs from the review's original language,
                # try to serve the cached translation (including English).
                if lang != (r.source_language or "en"):
                    cache = (r.i18n or {}).get(lang) or {}
                    cached_comment = cache.get("comment")
                    if isinstance(cached_comment, str) and cached_comment.strip():
                        comment = cached_comment
                        translated = True
                
                _ensure_profile_name_i18n(db, prof, lang)
                guest_name = _get_profile_name_for_lang(prof, lang)
                
                reviews.append({
                    "id": r.id,
                    "listing_id": r.listing_id,
                    "booking_id": r.booking_id,
                    "rating": r.rating,
                    "comment": comment,
                    "comment_original": r.comment if translated else None,
                    "translated": translated,
                    "lang": lang,
                    "created_at": r.created_at,
                    "guest": {
                        "id": u.id,
                        "name": guest_name,
                        "email": getattr(u, "email", None),
                    },
                })

            db.commit()
            return _resp({"count": len(reviews), "reviews": reviews})
    except Exception as e:
        print("Unhandled error in list_listing_reviews:", repr(e))
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)


# -------------------------
# GET /v1/reviews/mine
# -------------------------
def my_reviews(event, _ctx):
    sub, email = _get_sub_and_email(event)
    if not sub:
        return _resp({"detail": "Unauthorized"}, 401)

    try:
        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)
            rows = (
                db.query(ReviewORM)
                .filter(ReviewORM.guest_user_id == str(user.id))
                .order_by(desc(ReviewORM.created_at))
                .all()
            )
            return _resp(
                {
                    "count": len(rows),
                    "reviews": [
                        {
                            "id": r.id,
                            "booking_id": r.booking_id,
                            "listing_id": r.listing_id,
                            "rating": r.rating,
                            "created_at": r.created_at,
                        }
                        for r in rows
                    ],
                }
            )
    except Exception as e:
        print("Unhandled error in my_reviews:", repr(e))
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)


# -------------------------
# GET /v1/host/reviews
# -------------------------
def host_reviews(event, _ctx):
    sub, email = _get_sub_and_email(event)
    if not sub:
        return _resp({"detail": "Unauthorized"}, 401)

    lang = _normalize_lang(get_requested_lang(event))

    try:
        with SessionLocal() as db:
            host = _get_or_create_user(db, sub, email)

            rows = (
                db.query(ReviewORM, ListingORM, BookingORM, UserORM, ProfileORM)
                .join(ListingORM, ListingORM.id == ReviewORM.listing_id)
                .join(BookingORM, BookingORM.id == ReviewORM.booking_id)
                .join(UserORM, UserORM.id == ReviewORM.guest_user_id)
                .outerjoin(ProfileORM, ProfileORM.user_id == UserORM.id)
                .filter(ListingORM.host_user_id == str(host.id))
                .order_by(desc(ReviewORM.created_at))
                .limit(500)
                .all()
            )

            out = []
            for r, l, b, guest_user, guest_prof in rows:
                _ensure_review_i18n(db, r, lang)

                comment = r.comment
                translated = False

                # 🔹 Serve from cache if viewer language != original language
                if lang != (r.source_language or "en"):
                    cache = (r.i18n or {}).get(lang) or {}
                    cached_comment = cache.get("comment")
                    if isinstance(cached_comment, str) and cached_comment.strip():
                        comment = cached_comment
                        translated = True
                translated_title, did_translate_title = _translate_title_if_needed(l.title, lang)
                _ensure_profile_name_i18n(db, guest_prof, lang)
                guest_name = _get_profile_name_for_lang(guest_prof, lang)

                out.append(
                    {
                        "review": {
                            "id": r.id,
                            "rating": r.rating,
                            "comment": comment,
                            "comment_original": r.comment if translated else None,
                            "translated": translated,
                            "lang": lang or "en",
                            "created_at": r.created_at,
                        },
                        "listing": {
                            "id": l.id,
                            "title": translated_title,
                            "title_original": l.title if did_translate_title else None,
                        },
                        "booking": {"id": b.id, "check_in": b.check_in, "check_out": b.check_out},
                        "guest": {
                            "id": guest_user.id,
                            "name": guest_name,
                            "email": getattr(guest_user, "email", None),
                        },
                    }
                )

            db.commit()
            return _resp({"count": len(out), "reviews": out})
    except Exception as e:
        print("Unhandled error in host_reviews:", repr(e))
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)
