# functions/listings/handler.py
import json
import os
from datetime import datetime
from typing import Any, List, Optional, Tuple

from common.db import SessionLocal, session
from common.i18n import get_requested_lang
from common.models import HotelRoomTypeORM, ListingORM, UserORM
from common.serializers import to_out
from common.translate import translate_text, translate_text_auto
from sqlalchemy import and_, desc, func, select, text
from sqlalchemy.exc import DataError, OperationalError, ProgrammingError

#from backend.apps.api.src.api.core import db

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Accept-Language,x-language",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}
DEBUG = os.environ.get("DEBUG_ERRORS", "false").lower() == "true"

ALLOWED_STATUSES = {"live", "review", "paused", "draft", "cancel"}


# -------------------------
# Hotel room types helpers
# -------------------------

def _normalize_room_types(room_types):
    if not room_types:
        return []
    if not isinstance(room_types, list):
        raise ValueError("room_types must be a list")

    cleaned = []
    for i, rt in enumerate(room_types):
        if not isinstance(rt, dict):
            raise ValueError(f"room_types[{i}] must be an object")

        name = (rt.get("name") or "").strip()
        if not name:
            raise ValueError(f"room_types[{i}].name is required")

        def _int_field(key, default=None, min_v=None):
            val = rt.get(key, default)
            if val is None:
                return None
            try:
                val = int(val)
            except Exception:
                raise ValueError(f"room_types[{i}].{key} must be an int")
            if min_v is not None and val < min_v:
                raise ValueError(f"room_types[{i}].{key} must be >= {min_v}")
            return val

        def _float_field(key):
            val = rt.get(key, None)
            if val is None:
                return None
            try:
                return float(val)
            except Exception:
                raise ValueError(f"room_types[{i}].{key} must be a number")

        floor = _int_field("floor", default=None, min_v=None)
        quantity = _int_field("quantity", default=1, min_v=1)
        max_guests = _int_field("max_guests", default=2, min_v=1)

        amenities = rt.get("amenities", None)
        if amenities is not None and not isinstance(amenities, list):
            raise ValueError(f"room_types[{i}].amenities must be a list")

        photos = rt.get("photos", None)
        if photos is not None and not isinstance(photos, list):
            raise ValueError(f"room_types[{i}].photos must be a list")

        cleaned.append(
            {
                "name": name,
                "floor": floor,
                "description": rt.get("description"),
                "quantity": quantity,
                "price": _float_field("price"),
                "max_guests": max_guests,
                "bedrooms": _int_field("bedrooms", default=None, min_v=0),
                "bathrooms": _int_field("bathrooms", default=None, min_v=0),
                "beds": _int_field("beds", default=None, min_v=0),
                "amenities": amenities,
                "photos": photos,
            }
        )

    return cleaned


def _set_hotel_room_types(db, listing: ListingORM, room_types_payload):
    # Replace-all strategy (simple + safe for MVP)
    listing.room_types = []
    for rt in room_types_payload:
        listing.room_types.append(
            HotelRoomTypeORM(
                name=rt["name"],
                floor=rt["floor"],
                description=rt.get("description"),
                quantity=rt["quantity"],
                price=rt.get("price"),
                max_guests=rt["max_guests"],
                bedrooms=rt.get("bedrooms"),
                bathrooms=rt.get("bathrooms"),
                beds=rt.get("beds"),
                amenities=rt.get("amenities"),
                photos=rt.get("photos"),
            )
        )
    db.add(listing)


def _ensure_room_types_i18n(db, listing, target_lang: str):
    target_lang = (target_lang or "en").strip().lower()
    if not target_lang:
        return

    src_lang = (getattr(listing, "source_language", None) or "en").strip().lower()
    if target_lang == src_lang:
        return

    if (getattr(listing, "property_type", "") or "").lower() != "hotel":
        return

    room_types = getattr(listing, "room_types", None) or []
    if not room_types:
        return

    i18n = listing.i18n or {}
    lang_cache = i18n.get(target_lang) or {}

    cached = lang_cache.get("room_types")
    # cache shape: list of {id, name, description}
    if isinstance(cached, list) and len(cached) == len(room_types):
        cached_ids = [c.get("id") for c in cached if isinstance(c, dict)]
        live_ids = [rt.id for rt in room_types]
        if cached_ids == live_ids:
            return

    out = []
    for rt in room_types:
        name = rt.name or ""
        desc = rt.description or ""
        t_name = name
        t_desc = desc

        if name.strip():
            try:
                t_name, _src = translate_text(name, target_lang)
            except Exception:
                t_name = name

        if desc and str(desc).strip():
            try:
                t_desc, _src = translate_text(str(desc), target_lang)
            except Exception:
                t_desc = desc

        out.append({"id": rt.id, "name": t_name, "description": t_desc})

    lang_cache["room_types"] = out
    i18n[target_lang] = lang_cache
    listing.i18n = i18n
    db.add(listing)


def _attach_room_types_to_response(listing: ListingORM, payload: dict, target_lang: str):
    if (getattr(listing, "property_type", "") or "").lower() != "hotel":
        payload["room_types"] = []
        return payload

    cache = (getattr(listing, "i18n", None) or {}).get((target_lang or "en").lower(), {}) or {}
    cached_room_types = cache.get("room_types") if isinstance(cache, dict) else None
    by_id = {}
    if isinstance(cached_room_types, list):
        for c in cached_room_types:
            if isinstance(c, dict) and c.get("id") is not None:
                by_id[c["id"]] = c

    room_types_out = []
    for rt in (getattr(listing, "room_types", None) or []):
        c = by_id.get(rt.id, {})
        room_types_out.append(
            {
                "id": rt.id,
                "name": c.get("name") or rt.name,
                "floor": rt.floor,
                "description": c.get("description") if "description" in c else rt.description,
                "quantity": rt.quantity,
                "price": rt.price,
                "max_guests": rt.max_guests,
                "bedrooms": rt.bedrooms,
                "bathrooms": rt.bathrooms,
                "beds": rt.beds,
                "amenities": rt.amenities or [],
                "photos": rt.photos or [],
            }
        )

    payload["room_types"] = room_types_out
    return payload


def _resp(body, status=200):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, default=str)}


def _parse_float(s: Optional[str]) -> Optional[float]:
    if not s:
        return None
    try:
        return float(s)
    except Exception:
        return None


def _parse_int(s: Optional[str], default: int) -> int:
    try:
        return int(s)
    except Exception:
        return default


def _get_sub_and_email(event) -> Tuple[Optional[str], Optional[str]]:
    claims = (
        (event.get("requestContext", {}) or {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    return claims.get("sub"), claims.get("email")


def _get_or_create_user(db, sub: str, email: Optional[str]) -> UserORM:
    user = db.query(UserORM).filter(UserORM.cognito_sub == sub).one_or_none()
    if not user:
        user = UserORM(cognito_sub=sub, email=email)
        db.add(user)
        db.flush()
    else:
        # keep email fresh if it changes
        if email and getattr(user, "email", None) != email:
            user.email = email
            db.add(user)
    return user


# -------------------------
# i18n helpers (Listing dynamic translations)
# -------------------------

# ✅ translate string fields (single text fields)
TRANSLATABLE_STRING_FIELDS = [
    "title",
    "description",
    "location",
    "building_label",
    "unit_name",
]

# Some listings may include address parts; translate if present.
OPTIONAL_TRANSLATABLE_STRING_FIELDS = [
    "street",
    "city",
    "state",
    "pincode",
]

# ✅ translate list fields (every line / item)
TRANSLATABLE_LIST_FIELDS = [
    "amenities",
    "rules",
    "offers",
]


def _get_listing_text_fields(listing) -> dict:
    """
    Returns a dict of field -> text (str) or list[str] for all translatable fields
    that exist and are non-empty on the listing.

    - String fields are returned as trimmed strings
    - List fields are returned as cleaned list[str] (trimmed, non-empty)
    """
    out: dict = {}

    # string fields
    for f in TRANSLATABLE_STRING_FIELDS:
        val = getattr(listing, f, None)
        if isinstance(val, str) and val.strip():
            out[f] = val.strip()

    for f in OPTIONAL_TRANSLATABLE_STRING_FIELDS:
        val = getattr(listing, f, None)
        if isinstance(val, str) and val.strip():
            out[f] = val.strip()

    # list fields (amenities, rules, offers, etc.)
    for f in TRANSLATABLE_LIST_FIELDS:
        arr = getattr(listing, f, None)
        if isinstance(arr, list) and arr:
            cleaned = [x.strip() for x in arr if isinstance(x, str) and x.strip()]
            if cleaned:
                out[f] = cleaned

    return out

from typing import Optional


def _set_listing_canonical_fields(listing: ListingORM) -> Optional[str]:
    """Populate *_en canonical fields for cross-language search and return detected source lang."""
    detected: Optional[str] = None

    def _to_en(val: Optional[str]) -> Optional[str]:
        nonlocal detected
        if not isinstance(val, str) or not val.strip():
            return None
        try:
            t, src = translate_text_auto(val, "en")
            if src and not detected:
                detected = src
            return t
        except Exception:
            return val

    listing.title_en = _to_en(getattr(listing, "title", None))
    listing.location_en = _to_en(getattr(listing, "location", None))
    listing.street_en = _to_en(getattr(listing, "street", None))
    listing.city_en = _to_en(getattr(listing, "city", None))
    listing.state_en = _to_en(getattr(listing, "state", None))
    listing.description_en = _to_en(getattr(listing, "description", None))

    return detected




def _ensure_listing_i18n(db, listing, target_lang: str):
    """
    Ensures listing.i18n[target_lang] exists and contains translated values
    for all translatable fields.
    Best-effort: failures should not break the endpoint.
    """
    target_lang = (target_lang or "en").strip().lower()
    if not target_lang:
        return

    src_lang = (getattr(listing, "source_language", None) or "en").strip().lower()
    if target_lang == src_lang:
        return

    i18n = listing.i18n or {}
    lang_cache = i18n.get(target_lang) or {}

    source_texts = _get_listing_text_fields(listing)

    for k, v in source_texts.items():
        # ✅ list fields: translate every element
        if isinstance(v, list):
            cached_list = lang_cache.get(k)
            if (
                isinstance(cached_list, list)
                and len(cached_list) == len(v)
                and all(isinstance(x, str) for x in cached_list)
            ):
                continue

            translated_list = []
            source_lang = None
            for item in v:
                try:
                    t, src = translate_text(item, target_lang)
                    translated_list.append(t)
                    source_lang = source_lang or src
                except Exception:
                    translated_list.append(item)

            lang_cache[k] = translated_list
            if source_lang and not getattr(listing, "source_language", None):
                listing.source_language = source_lang
            continue

        # ✅ string fields
        if lang_cache.get(k):
            continue

        try:
            t, src = translate_text(v, target_lang)
            lang_cache[k] = t
            if src and not getattr(listing, "source_language", None):
                listing.source_language = src
        except Exception:
            # leave it uncached; don't break
            pass

    i18n[target_lang] = lang_cache
    listing.i18n = i18n
    db.add(listing)


def _apply_listing_i18n_to_payload(payload: dict, listing, target_lang: str) -> dict:
    """
    Mutates the output payload with translated strings if cache exists.
    """
    target_lang = (target_lang or "en").strip().lower()
    if not target_lang:
        target_lang = "en"

    i18n = (listing.i18n or {}).get(target_lang) or {}

    translated_any = False

    # Apply cached translations for string fields
    for f in TRANSLATABLE_STRING_FIELDS + OPTIONAL_TRANSLATABLE_STRING_FIELDS:
        if f in payload and isinstance(payload.get(f), str):
            t = i18n.get(f)
            if isinstance(t, str) and t.strip():
                payload[f] = t
                translated_any = True

    # Apply cached translations for list fields (amenities, rules, offers)
    for f in TRANSLATABLE_LIST_FIELDS:
        if f in payload and isinstance(payload.get(f), list):
            t_list = i18n.get(f)
            if isinstance(t_list, list) and t_list:
                payload[f] = t_list
                translated_any = True

    payload["lang"] = target_lang
    payload["translated"] = translated_any
    return payload


def _localize_listing(db, listing, event) -> dict:
    payload = to_out(listing)
    lang = (get_requested_lang(event) or "en").strip().lower()

    # Ensure cache for requested language (including "en" if source_language != "en")
    _ensure_listing_i18n(db, listing, lang)

    # Apply cached translations if available
    payload = _apply_listing_i18n_to_payload(payload, listing, lang)

    # If nothing was translated, translated flag will stay False
    if "lang" not in payload:
        payload["lang"] = lang
    return payload


# -------------------------
# GET /v1/listings (public)
# -------------------------
def list_listings(event, _ctx):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _resp({}, 200)

    qs = event.get("queryStringParameters") or {}
    min_price = _parse_float(qs.get("min_price"))
    max_price = _parse_float(qs.get("max_price"))
    min_rating = _parse_float(qs.get("min_rating"))
    limit = _parse_int(qs.get("limit"), 50)
    offset = _parse_int(qs.get("offset"), 0)

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    try:
        with session() as db:
            q = db.query(ListingORM).filter(ListingORM.status == "live")

            if min_price is not None:
                q = q.filter(ListingORM.price >= min_price)
            if max_price is not None:
                q = q.filter(ListingORM.price <= max_price)
            if min_rating is not None:
                q = q.filter(ListingORM.rating >= min_rating)

            total = q.count()
            rows = (
                q.order_by(desc(ListingORM.id))
                .offset(offset)
                .limit(limit)
                .all()
            )

            results = []
            for r in rows:
                payload = _localize_listing(db, r, event)
                payload = _attach_room_types_to_response(r, payload, (get_requested_lang(event) or "en"))
                results.append(payload)
            return _resp({"count": len(results), "total": total, "results": results})

    except (DataError, ProgrammingError) as e:
        print("Query/SQL error:", repr(e))
        return _resp({"detail": "Invalid query or database error." if not DEBUG else str(e)}, 400)
    except OperationalError as e:
        print("DB connectivity error:", repr(e))
        return _resp({"detail": "Database unavailable." if not DEBUG else str(e)}, 503)
    except Exception as e:
        print("Unhandled error in list_listings:", repr(e))
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)


# -------------------------
# GET /v1/listings/{id}
# -------------------------
def get_listing(event, _ctx):
    print(f"[get_listing] ====== START ======")

    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _resp({}, 200)

    try:
        pid = (event.get("pathParameters") or {}).get("listing_id") or (event.get("pathParameters") or {}).get("id")
        listing_id = int(pid)
        print(f"[get_listing] Listing ID: {listing_id}")
    except Exception:
        return _resp({"detail": "Invalid listing id."}, 400)

    # ✅ Get language BEFORE opening DB session
    lang = get_requested_lang(event)
    print(f"[get_listing] 🌐 Requested language: {lang}")

    try:
        with session() as db:
            row = db.get(ListingORM, listing_id)
            if not row:
                return _resp({"detail": "Listing not found"}, 404)

            print(f"[get_listing] Found listing: id={row.id}, title={row.title}")
            print(f"[get_listing] Current i18n cache: {row.i18n}")

            # ✅ Allow the listing's own host to view any status (needed by edit screen).
            # For everyone else, only live listings are visible.
            sub, _email = _get_sub_and_email(event)
            is_owner = False
            if sub and row.host_user_id:
                owner = db.query(UserORM).filter(UserORM.cognito_sub == sub).one_or_none()
                is_owner = owner is not None and owner.id == row.host_user_id

            if row.status != "live" and not is_owner:
                return _resp({"detail": "Listing not found"}, 404)

            # ✅ ALWAYS translate for non-English languages
            src_lang = (row.source_language or "en").lower()
            if lang and lang.lower() != src_lang:
                print(f"[get_listing] 🌐 Non-English language detected: {lang}")

                i18n = row.i18n or {}
                cached = i18n.get(lang) or {}

                print(f"[get_listing] Current cache for {lang}: {list(cached.keys())}")

                # Determine if any important translated fields are missing
                source_fields = _get_listing_text_fields(row)
                needs_any = False

                for k, v in source_fields.items():
                    cached_v = cached.get(k)

                    # list fields
                    if isinstance(v, list):
                        if not isinstance(cached_v, list) or len(cached_v) != len(v):
                            needs_any = True
                            break
                    else:
                        # string fields
                        if not isinstance(cached_v, str) or not cached_v.strip():
                            needs_any = True
                            break

                print(f"[get_listing] Translation needs_any={needs_any}")

                if needs_any:
                    print(f"[get_listing] 🔄 Calling _ensure_listing_i18n.")
                    _ensure_listing_i18n(db, row, lang)

                    print(f"[get_listing] 💾 Committing to database.")
                    db.commit()

                    print(f"[get_listing] 🔄 Refreshing row from DB.")
                    db.refresh(row)

                    print(f"[get_listing] ✅ After refresh, i18n: {row.i18n}")
                else:
                    print(f"[get_listing] ✅ Using cached translation")

            # ✅ Apply translations to output
            result = _localize_listing(db, row, event)
            result = _attach_room_types_to_response(row, result, lang)

            # ✅ Always ensure property_type is in the response (edit screen needs it)
            if "property_type" not in result or result["property_type"] is None:
                result["property_type"] = (row.property_type or "home").lower()

            print(f"[get_listing] 📋 Final result:")
            print(f"  - title: {result.get('title')}")
            d = result.get("description")
            print(f"  - description: {(d[:50] + '...') if isinstance(d,str) and len(d) > 50 else d}")
            print(f"  - lang: {result.get('lang')}")
            print(f"  - translated: {result.get('translated')}")
            print(f"[get_listing] ====== END ======")

            return _resp(result)

    except Exception as e:
        print(f"[get_listing] ❌ EXCEPTION: {repr(e)}")
        import traceback
        traceback.print_exc()
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)


# -------------------------
# POST /v1/listings (host)
# -------------------------
def create_listing(event, _ctx):
    sub, email = _get_sub_and_email(event)
    if not sub:
        return _resp({"detail": "Unauthorized"}, 401)

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp({"detail": "Invalid JSON body"}, 400)

    required = ["title", "street", "city", "price", "latitude", "longitude"]
    missing = [f for f in required if not body.get(f)]
    if missing:
        return _resp({"detail": f"Missing required fields: {', '.join(missing)}"}, 400)

    try:
        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)

            status = str(body.get("status") or "review").lower()
            if status not in ALLOWED_STATUSES:
                status = "review"

            # ✅ NEW: Get user's input language (from header or profile)
            viewer_lang = get_requested_lang(event)
            print(f"[create_listing] User input language: {viewer_lang}")

            # Create listing with original user input
            listing = ListingORM(
                title=body.get("title"),
                street=body.get("street"),
                city=body.get("city"),
                state=body.get("state"),
                pincode=body.get("pincode"),
                price=float(body.get("price")),
                latitude=float(body.get("latitude")),
                longitude=float(body.get("longitude")),
                description=body.get("description"),
                rules=body.get("rules"),
                offers=body.get("offers"),
                amenities=body.get("amenities") or [],
                images=body.get("images") or [],
                photo_url=body.get("photo_url"),
                bedrooms=body.get("bedrooms") or 1,
                bathrooms=body.get("bathrooms") or 1,
                beds=body.get("beds") or 1,
                max_guests=body.get("max_guests"),
                check_in_time=body.get("check_in_time"),
                check_out_time=body.get("check_out_time"),
                location=body.get("location"),
                building_key=body.get("building_key"),
                building_label=body.get("building_label"),
                unit_name=body.get("unit_name"),
                property_type=(body.get("property_type") or "home"),
                host_user_id=user.id,
                status=status,
            )
            db.add(listing)
            db.flush()  # ensure listing is attached/has pk

            # ✅ Hotel: validate + store room types
            if (listing.property_type or "").lower() == "hotel":
                try:
                    cleaned_room_types = _normalize_room_types(body.get("room_types") or [])
                except ValueError as ve:
                    return _resp({"detail": str(ve)}, 400)

                if not cleaned_room_types:
                    return _resp({"detail": "Hotels must include at least 1 room type."}, 400)

                _set_hotel_room_types(db, listing, cleaned_room_types)

            # ✅ NEW: Populate canonical English fields for search
            # This detects the source language and translates to English if needed
            detected_lang = _set_listing_canonical_fields(listing)
            
            # ✅ NEW: Store source language
            # Priority: detected from translation > user's header language > fallback to 'en'
            if detected_lang:
                listing.source_language = detected_lang
            elif not getattr(listing, "source_language", None):
                listing.source_language = "en"

            # Pre-cache English for non-English authored listings
            _ensure_listing_i18n(db, listing, "en")
            # pre-cache for the *requested* language (viewer language)
            _ensure_listing_i18n(db, listing, viewer_lang)

            db.commit()
            db.refresh(listing)

            # Return localized version so UI sees translated fields immediately (if cached)
            result = _localize_listing(db, listing, event)
            result = _attach_room_types_to_response(listing, result, viewer_lang)
            
            # ✅ NEW: Add source_language to response so frontend can show "Originally written in Hindi"
            result["source_language"] = listing.source_language
            
            return _resp(result, 201)

    except Exception as e:
        print("Unhandled error in create_listing:", repr(e))
        import traceback
        traceback.print_exc()
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)


# -------------------------
# PUT /v1/listings/{id} (host)
# -------------------------
def update_listing(event, _ctx):
    sub, email = _get_sub_and_email(event)
    if not sub:
        return _resp({"detail": "Unauthorized"}, 401)

    path_params = event.get("pathParameters") or {}
    pid = path_params.get("listing_id") or path_params.get("id")
    try:
        listing_id = int(pid)
    except Exception:
        return _resp({"detail": "Invalid listing id."}, 400)

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp({"detail": "Invalid JSON body"}, 400)

    try:
        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)
            listing = db.get(ListingORM, listing_id)
            if not listing:
                return _resp({"detail": "Listing not found"}, 404)
            if listing.host_user_id and listing.host_user_id != user.id:
                return _resp({"detail": "Forbidden"}, 403)

            changed_i18n = False

            # Basic fields
            if body.get("title") is not None:
                listing.title = body.get("title")
                changed_i18n = True
            if body.get("street") is not None:
                listing.street = body.get("street")
                changed_i18n = True  # street is now translatable
            if body.get("city") is not None:
                listing.city = body.get("city")
                changed_i18n = True
            if body.get("state") is not None:
                listing.state = body.get("state")
                changed_i18n = True
            if body.get("pincode") is not None:
                listing.pincode = body.get("pincode")
                changed_i18n = True

            if body.get("price") is not None:
                try:
                    listing.price = float(body.get("price"))
                except Exception:
                    return _resp({"detail": "Invalid price"}, 400)

            if body.get("rating") is not None:
                try:
                    listing.rating = float(body.get("rating"))
                except Exception:
                    return _resp({"detail": "Invalid rating"}, 400)

            if body.get("latitude") is not None:
                listing.latitude = float(body.get("latitude"))
            if body.get("longitude") is not None:
                listing.longitude = float(body.get("longitude"))

            if body.get("photo_url") is not None:
                listing.photo_url = body.get("photo_url")
            if body.get("images") is not None:
                listing.images = body.get("images")
            if body.get("amenities") is not None:
                listing.amenities = body.get("amenities")
                changed_i18n = True  # amenities is now translatable

            # Property details
            if body.get("bedrooms") is not None:
                listing.bedrooms = int(body.get("bedrooms"))
            if body.get("bathrooms") is not None:
                listing.bathrooms = int(body.get("bathrooms"))
            if body.get("beds") is not None:
                listing.beds = int(body.get("beds"))

            # Text fields that affect translation
            if body.get("description") is not None:
                listing.description = body.get("description")
                changed_i18n = True
            if body.get("rules") is not None:
                listing.rules = body.get("rules")
                changed_i18n = True
            if body.get("offers") is not None:
                listing.offers = body.get("offers")
                changed_i18n = True

            if body.get("check_in_time") is not None:
                listing.check_in_time = body.get("check_in_time")
            if body.get("check_out_time") is not None:
                listing.check_out_time = body.get("check_out_time")
            if body.get("max_guests") is not None:
                listing.max_guests = body.get("max_guests")
            if body.get("location") is not None:
                listing.location = body.get("location")
                changed_i18n = True

            if body.get("building_key") is not None:
                listing.building_key = body.get("building_key")
            if body.get("building_label") is not None:
                listing.building_label = body.get("building_label")
                changed_i18n = True
            if body.get("unit_name") is not None:
                listing.unit_name = body.get("unit_name")
                changed_i18n = True

            # ✅ property_type
            if body.get("property_type") is not None:
                listing.property_type = (body.get("property_type") or "home")

            # ✅ hotel room types
            if body.get("room_types") is not None:
                if (listing.property_type or "").lower() != "hotel":
                    return _resp({"detail": "room_types can only be set when property_type is 'hotel'."}, 400)
                try:
                    cleaned_room_types = _normalize_room_types(body.get("room_types") or [])
                except ValueError as ve:
                    return _resp({"detail": str(ve)}, 400)
                if not cleaned_room_types:
                    return _resp({"detail": "Hotels must include at least 1 room type."}, 400)
                _set_hotel_room_types(db, listing, cleaned_room_types)
                changed_i18n = True

            if body.get("status") is not None:
                new_status = str(body.get("status")).lower()
                if new_status in ALLOWED_STATUSES:
                    listing.status = new_status
                else:
                    return _resp({"detail": f"Invalid status '{new_status}'"}, 400)
            
            # Invalidate translation cache if source text changed
            # After all field updates
            if changed_i18n:
                detected_lang = _set_listing_canonical_fields(listing)
                listing.source_language = detected_lang or listing.source_language or "en"
                listing.i18n = {}  # invalidate stale translations
            elif not listing.source_language:
                listing.source_language = "en"

            _ensure_listing_i18n(db, listing, "en")

            # ✅ ensure i18n cache exists for requested language (no-op if already cached)
            lang = get_requested_lang(event)
            _ensure_listing_i18n(db, listing, lang)

            db.commit()
            db.refresh(listing)

            result = _localize_listing(db, listing, event)
            result = _attach_room_types_to_response(listing, result, lang)
            return _resp(result)

    except Exception as e:
        print("Unhandled error in update_listing:", repr(e))
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)


# -------------------------
# DELETE /v1/listings/{id} (host)
# -------------------------
def delete_listing(event, _ctx):
    sub, email = _get_sub_and_email(event)
    if not sub:
        return _resp({"detail": "Unauthorized"}, 401)

    path_params = event.get("pathParameters") or {}
    pid = path_params.get("listing_id") or path_params.get("id")
    try:
        listing_id = int(pid)
    except Exception:
        return _resp({"detail": "Invalid listing id."}, 400)

    try:
        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)

            listing = db.get(ListingORM, listing_id)
            if not listing:
                return _resp({"detail": "Listing not found"}, 404)

            if listing.host_user_id and listing.host_user_id != user.id:
                return _resp({"detail": "Forbidden"}, 403)

            db.delete(listing)
            db.commit()

            return _resp({"ok": True})

    except Exception as e:
        print("Unhandled error in delete_listing:", repr(e))
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)


# -------------------------
# GET /v1/my/listings (host)
# -------------------------
def list_my_listings(event, _ctx):
    sub, email = _get_sub_and_email(event)
    if not sub:
        return _resp({"detail": "Unauthorized"}, 401)

    try:
        with SessionLocal() as db:
            user = _get_or_create_user(db, sub, email)
            rows = db.query(ListingORM).filter(ListingORM.host_user_id == user.id).all()
            lang = (get_requested_lang(event) or "en")
            results = []
            for r in rows:
                payload = _localize_listing(db, r, event)
                payload = _attach_room_types_to_response(r, payload, lang)
                results.append(payload)
            return _resp({"count": len(results), "results": results})

    except Exception as e:
        print("Unhandled error in list_my_listings:", repr(e))
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)


# -------------------- HEALTH (optional) --------------------
def health_db(event, _ctx):
    try:
        with session() as db:
            val = db.execute(text("SELECT 1")).scalar()
        return _resp({"ok": True, "select1": val})
    except Exception as e:
        print("Health DB error:", repr(e))
        return _resp({"ok": False, "error": None if not DEBUG else str(e)}, 500)


def health_listings(event, _ctx):
    try:
        with session() as s:
            cols = s.execute(
                text(
                    """
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name='listings' ORDER BY ordinal_position
                    """
                )
            ).scalars().all()
            cnt = s.execute(text("SELECT COUNT(*) FROM listings")).scalar()
            row = s.execute(text("SELECT id,title FROM listings ORDER BY id LIMIT 1")).mappings().first()
        return _resp({"ok": True, "columns": cols, "count": cnt, "sample": dict(row) if row else None})
    except Exception as e:
        print("health_listings error:", repr(e))
        return _resp({"ok": False, "error": str(e)}, 500)