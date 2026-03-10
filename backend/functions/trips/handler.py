# functions/trips/handler.py
import json
from typing import Any, Dict, List

from common.db import session
from common.i18n import get_requested_lang
from common.localize import apply_cached_listing_i18n, translate_small_text
from common.models import ListingORM, TripListItemORM, TripListORM, UserORM
from common.serializers import to_out
from common.translate import translate_text

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Accept-Language",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def _resp(body: Any, status: int = 200) -> Dict[str, Any]:
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, default=str)}


def _get_claims(event: Dict[str, Any]) -> Dict[str, Any]:
    auth = (event.get("requestContext", {}).get("authorizer", {}) or {})

    jwt_claims = (auth.get("jwt") or {}).get("claims")
    if jwt_claims:
        return jwt_claims

    legacy_claims = auth.get("claims")
    if legacy_claims:
        return legacy_claims

    return {}


def _get_or_create_user(event, db) -> UserORM:
    claims = _get_claims(event)
    sub = claims.get("sub")
    if not sub:
        raise PermissionError("Missing Cognito sub")

    email = claims.get("email")

    user = db.query(UserORM).filter(UserORM.cognito_sub == sub).one_or_none()
    if user:
        if email and getattr(user, "email", None) != email:
            user.email = email
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    user = UserORM(cognito_sub=sub, email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _trip_list_to_dict(tl: TripListORM) -> Dict[str, Any]:
    count = len(tl.items)
    cover = tl.cover_image
    if not cover and tl.items:
        first_listing = tl.items[0].listing
        cover = getattr(first_listing, "photo_url", None)

    return {
        "id": tl.id,
        "name": tl.name,
        "description": tl.description,
        "count": count,
        "cover_image": cover,
        "created_at": tl.created_at.isoformat() if tl.created_at else None,
        "updated_at": tl.updated_at.isoformat() if tl.updated_at else None,
    }


def _translate_trip_meta(payload: Dict[str, Any], lang: str) -> Dict[str, Any]:
    payload = dict(payload or {})
    payload["name"] = translate_small_text(payload.get("name"), lang)
    payload["description"] = translate_small_text(payload.get("description"), lang)
    return payload

TRANSLATABLE_FIELDS = ["title", "location", "city", "street"]

def _ensure_listing_i18n(db, listing: ListingORM, payload: dict, lang: str) -> dict:
    if not lang or lang == "en":
        return payload

    i18n = listing.i18n or {}
    lang_map = i18n.get(lang) or {}

    updated = False
    for f in TRANSLATABLE_FIELDS:
        val = (payload.get(f) or "").strip()
        if not val:
            continue
        if lang_map.get(f):  # already cached
            continue

        try:
            translated, _src = translate_text(val, lang)
            lang_map[f] = translated
            updated = True
        except Exception:
            # don't break search if translate fails
            lang_map[f] = val

    if updated:
        i18n[lang] = lang_map
        listing.i18n = i18n
        db.add(listing)

    # apply cached result (now filled)
    return apply_cached_listing_i18n(payload, i18n, lang)


def list_trip_lists(event, context):
    if (event.get("requestContext") or {}).get("http", {}).get("method") == "OPTIONS":
        return _resp({}, 200)

    lang = get_requested_lang(event)
    try:
        with session() as db:
            user = _get_or_create_user(event, db)
            trip_lists = (
                db.query(TripListORM)
                .filter(TripListORM.user_id == user.id)
                .order_by(TripListORM.created_at.desc())
                .all()
            )

            data = []
            for tl in trip_lists:
                td = _trip_list_to_dict(tl)
                data.append(_translate_trip_meta(td, lang))

            return _resp({"trip_lists": data})
    except PermissionError:
        return _resp({"error": "Unauthorized"}, 401)
    except Exception as e:
        return _resp({"error": str(e)}, 500)


def get_trip_list(event, context):
    if (event.get("requestContext") or {}).get("http", {}).get("method") == "OPTIONS":
        return _resp({}, 200)

    lang = get_requested_lang(event)
    try:
        trip_list_id = int(event["pathParameters"]["trip_list_id"])
    except Exception:
        return _resp({"error": "Invalid trip_list_id"}, 400)

    try:
        with session() as db:
            user = _get_or_create_user(event, db)
            tl = (
                db.query(TripListORM)
                .filter(TripListORM.id == trip_list_id, TripListORM.user_id == user.id)
                .one_or_none()
            )
            if not tl:
                return _resp({"error": "Trip list not found"}, 404)

            items: List[Dict[str, Any]] = []
            for item in tl.items:
                listing = item.listing

                listing_payload = to_out(listing)
                listing_payload = _ensure_listing_i18n(db, listing, listing_payload, lang)


                items.append(
                    {
                        "id": listing.id,
                        "title": listing_payload.get("title"),
                        "street": listing_payload.get("street"),
                        "city": listing_payload.get("city"),
                        "location": listing_payload.get("location"),
                        "price": listing.price,
                        "rating": listing.rating,
                        "photo_url": listing.photo_url,
                        "trip_list_item_id": item.id,
                    }
                )
            db.commit()

            trip_list_out = _translate_trip_meta(_trip_list_to_dict(tl), lang)
            return _resp({"trip_list": trip_list_out, "items": items})
    except PermissionError:
        return _resp({"error": "Unauthorized"}, 401)
    except Exception as e:
        return _resp({"error": str(e)}, 500)


def create_trip_list(event, context):
    if (event.get("requestContext") or {}).get("http", {}).get("method") == "OPTIONS":
        return _resp({}, 200)

    lang = get_requested_lang(event)
    try:
        body = json.loads(event.get("body") or "{}")
        name = (body.get("name") or "").strip()
        description = (body.get("description") or "").strip()
        cover_image = body.get("cover_image")
        if not name:
            return _resp({"error": "name is required"}, 400)
    except Exception:
        return _resp({"error": "Invalid JSON body"}, 400)

    try:
        with session() as db:
            user = _get_or_create_user(event, db)

            tl = TripListORM(
                user_id=user.id,
                name=name,
                description=description or None,
                cover_image=cover_image,
            )
            db.add(tl)
            db.commit()
            db.refresh(tl)

            out = _translate_trip_meta(_trip_list_to_dict(tl), lang)
            return _resp({"trip_list": out}, 201)
    except PermissionError:
        return _resp({"error": "Unauthorized"}, 401)
    except Exception as e:
        return _resp({"error": str(e)}, 500)


def update_trip_list(event, context):
    if (event.get("requestContext") or {}).get("http", {}).get("method") == "OPTIONS":
        return _resp({}, 200)

    lang = get_requested_lang(event)
    try:
        trip_list_id = int(event["pathParameters"]["trip_list_id"])
    except Exception:
        return _resp({"error": "Invalid trip_list_id"}, 400)

    try:
        body = json.loads(event.get("body") or "{}")
        name = body.get("name")
        description = body.get("description")
        cover_image = body.get("cover_image")
    except Exception:
        return _resp({"error": "Invalid JSON body"}, 400)

    try:
        with session() as db:
            user = _get_or_create_user(event, db)
            tl = (
                db.query(TripListORM)
                .filter(TripListORM.id == trip_list_id, TripListORM.user_id == user.id)
                .one_or_none()
            )
            if not tl:
                return _resp({"error": "Trip list not found"}, 404)

            if isinstance(name, str) and name.strip():
                tl.name = name.strip()
            if description is not None:
                tl.description = description.strip() or None
            if cover_image is not None:
                tl.cover_image = cover_image or None

            db.commit()
            db.refresh(tl)

            out = _translate_trip_meta(_trip_list_to_dict(tl), lang)
            return _resp({"trip_list": out})
    except PermissionError:
        return _resp({"error": "Unauthorized"}, 401)
    except Exception as e:
        return _resp({"error": str(e)}, 500)


def delete_trip_list(event, context):
    if (event.get("requestContext") or {}).get("http", {}).get("method") == "OPTIONS":
        return _resp({}, 200)

    try:
        trip_list_id = int(event["pathParameters"]["trip_list_id"])
    except Exception:
        return _resp({"error": "Invalid trip_list_id"}, 400)

    try:
        with session() as db:
            user = _get_or_create_user(event, db)
            tl = (
                db.query(TripListORM)
                .filter(TripListORM.id == trip_list_id, TripListORM.user_id == user.id)
                .one_or_none()
            )
            if not tl:
                return _resp({"error": "Trip list not found"}, 404)

            db.delete(tl)
            db.commit()
            return _resp({"ok": True})
    except PermissionError:
        return _resp({"error": "Unauthorized"}, 401)
    except Exception as e:
        return _resp({"error": str(e)}, 500)


def add_item(event, context):
    if (event.get("requestContext") or {}).get("http", {}).get("method") == "OPTIONS":
        return _resp({}, 200)

    lang = get_requested_lang(event)
    try:
        trip_list_id = int(event["pathParameters"]["trip_list_id"])
    except Exception:
        return _resp({"error": "Invalid trip_list_id"}, 400)

    try:
        body = json.loads(event.get("body") or "{}")
        listing_id = int(body.get("listing_id"))
    except Exception:
        return _resp({"error": "listing_id is required"}, 400)

    try:
        with session() as db:
            user = _get_or_create_user(event, db)

            tl = (
                db.query(TripListORM)
                .filter(TripListORM.id == trip_list_id, TripListORM.user_id == user.id)
                .one_or_none()
            )
            if not tl:
                return _resp({"error": "Trip list not found"}, 404)

            listing = db.query(ListingORM).filter(ListingORM.id == listing_id).one_or_none()
            if not listing:
                return _resp({"error": "Listing not found"}, 404)

            existing = (
                db.query(TripListItemORM)
                .filter(
                    TripListItemORM.trip_list_id == tl.id,
                    TripListItemORM.listing_id == listing.id,
                )
                .one_or_none()
            )
            if not existing:
                item = TripListItemORM(trip_list_id=tl.id, listing_id=listing.id)
                db.add(item)
                db.commit()
                db.refresh(tl)
            else:
                db.commit()
                db.refresh(tl)

            out = _translate_trip_meta(_trip_list_to_dict(tl), lang)
            return _resp({"trip_list": out})
    except PermissionError:
        return _resp({"error": "Unauthorized"}, 401)
    except Exception as e:
        return _resp({"error": str(e)}, 500)


def remove_item(event, context):
    if (event.get("requestContext") or {}).get("http", {}).get("method") == "OPTIONS":
        return _resp({}, 200)

    lang = get_requested_lang(event)
    try:
        trip_list_id = int(event["pathParameters"]["trip_list_id"])
        listing_id = int(event["pathParameters"]["listing_id"])
    except Exception:
        return _resp({"error": "Invalid path parameters"}, 400)

    try:
        with session() as db:
            user = _get_or_create_user(event, db)

            tl = (
                db.query(TripListORM)
                .filter(TripListORM.id == trip_list_id, TripListORM.user_id == user.id)
                .one_or_none()
            )
            if not tl:
                return _resp({"error": "Trip list not found"}, 404)

            item = (
                db.query(TripListItemORM)
                .filter(
                    TripListItemORM.trip_list_id == tl.id,
                    TripListItemORM.listing_id == listing_id,
                )
                .one_or_none()
            )
            if not item:
                return _resp({"error": "Item not found"}, 404)

            db.delete(item)
            db.commit()
            db.refresh(tl)

            out = _translate_trip_meta(_trip_list_to_dict(tl), lang)
            return _resp({"trip_list": out})
    except PermissionError:
        return _resp({"error": "Unauthorized"}, 401)
    except Exception as e:
        return _resp({"error": str(e)}, 500)
