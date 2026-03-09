import json

from common.db import session
from common.i18n import get_requested_lang
from common.localize import apply_cached_listing_i18n
from common.models import ListingORM
from common.serializers import to_out
from common.translate import translate_text, translate_text_auto
from sqlalchemy import and_, desc, func, select

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Accept-Language,x-language",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}


def _ok(body, status=200):
    return {
        "statusCode": status,
        "headers": CORS,
        "body": json.dumps(body),
    }


def _parse_bbox(b):
    if not b:
        return None
    try:
        min_lon, min_lat, max_lon, max_lat = [float(x) for x in b.split(",")]
        return min_lon, min_lat, max_lon, max_lat
    except Exception:
        return None


def _parse_types_csv(s: str | None):
    """
    Accepts "home,room,hotel" and returns a validated list.
    """
    if not s:
        return None
    allowed = {"home", "room", "hotel"}
    types = [t.strip().lower() for t in s.split(",") if t.strip()]
    types = [t for t in types if t in allowed]
    return types or None

TRANSLATABLE_FIELDS = ["title", "location", "city", "street"]

def _ensure_i18n(db, listing: ListingORM, payload: dict, lang: str) -> dict:
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


def search(event, _ctx):
    lang = get_requested_lang(event)

    qs = event.get("queryStringParameters") or {}
    q = qs.get("q")
    bbox = qs.get("bbox")
    min_price = qs.get("min_price")
    max_price = qs.get("max_price")
    min_rating = qs.get("min_rating")
    sort = qs.get("sort")
    limit = int(qs.get("limit", "20"))
    cursor = int(qs.get("cursor", "0"))
    amenities_csv = qs.get("amenities")

    property_types_csv = qs.get("property_types") or qs.get("property_type")
    types_list = _parse_types_csv(property_types_csv)

    with session() as db:
        stmt = select(ListingORM)

        parsed = _parse_bbox(bbox)
        if parsed:
            min_lon, min_lat, max_lon, max_lat = parsed
            stmt = stmt.where(
                and_(
                    ListingORM.longitude >= min_lon,
                    ListingORM.longitude <= max_lon,
                    ListingORM.latitude >= min_lat,
                    ListingORM.latitude <= max_lat,
                )
            )

        if q:
            q_raw = str(q).strip()
            q_en = q_raw

            # Translate query to canonical English so Telugu/Hindi searches work
            try:
                q_en, _src = translate_text_auto(q_raw, "en")
            except Exception:
                q_en = q_raw

            like_en = f"%{q_en.lower()}%"
            like_raw = f"%{q_raw.lower()}%"

            stmt = stmt.where(
                (
                    # Canonical EN fields (primary)
                    func.lower(func.coalesce(ListingORM.title_en, ListingORM.title)).like(like_en)
                    | func.lower(func.coalesce(ListingORM.city_en, ListingORM.city)).like(like_en)
                    | func.lower(func.coalesce(ListingORM.street_en, ListingORM.street)).like(like_en)
                    | func.lower(func.coalesce(ListingORM.location_en, ListingORM.location)).like(like_en)
                )
                |
                (
                    # Raw fallback (helps when listing was authored in Telugu too)
                    func.lower(ListingORM.title).like(like_raw)
                    | func.lower(ListingORM.city).like(like_raw)
                    | func.lower(ListingORM.street).like(like_raw)
                    | func.lower(ListingORM.location).like(like_raw)
                )
            )

        if min_price is not None:
            stmt = stmt.where(ListingORM.price >= float(min_price))
        if max_price is not None:
            stmt = stmt.where(ListingORM.price <= float(max_price))
        if min_rating is not None:
            stmt = stmt.where(ListingORM.rating >= float(min_rating))

        if types_list:
            stmt = stmt.where(ListingORM.property_type.in_(types_list))

        if sort == "price_asc":
            stmt = stmt.order_by(ListingORM.price.asc())
        elif sort == "price_desc":
            stmt = stmt.order_by(ListingORM.price.desc())
        elif sort == "rating_desc":
            stmt = stmt.order_by(ListingORM.rating.desc())
        else:
            stmt = stmt.order_by(desc(ListingORM.created_at))

        rows = db.execute(stmt.offset(cursor).limit(limit)).scalars().all()

        if amenities_csv:
            need = {a.strip().lower() for a in amenities_csv.split(",") if a.strip()}
            rows = [
                r
                for r in rows
                if need.issubset({(a or "").lower() for a in (r.amenities or [])})
            ]

        out = []
        for r in rows:
            payload = to_out(r)
            payload = _ensure_i18n(db, r, payload, lang)
            out.append(payload)
        db.commit()

        next_cursor = cursor + len(out)
        return _ok(
            {
                "count": len(out),
                "results": out,
                "next_cursor": (next_cursor if len(out) == limit else None),
            }
        )
