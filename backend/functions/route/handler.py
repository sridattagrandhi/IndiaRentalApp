import json
import math
from typing import List, Optional, Tuple

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


def _resp(body, status=200):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body)}


# --- geo helpers (no PostGIS needed) ---
R_EARTH_KM = 6371.0088


def _haversine_km(lat1, lon1, lat2, lon2):
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return 2 * R_EARTH_KM * math.asin(math.sqrt(a))


def _point_segment_distance_km(px, py, ax, ay, bx, by):
    lat0 = math.radians((ay + by) / 2.0)

    def xy(lon, lat):
        x = math.radians(lon) * math.cos(lat0) * R_EARTH_KM
        y = math.radians(lat) * R_EARTH_KM
        return (x, y)

    P = xy(px, py)
    A = xy(ax, ay)
    B = xy(bx, by)

    ABx, ABy = (B[0] - A[0], B[1] - A[1])
    APx, APy = (P[0] - A[0], P[1] - A[1])
    ab2 = ABx * ABx + ABy * ABy
    if ab2 == 0:
        dx, dy = APx, APy
    else:
        t = max(0.0, min(1.0, (APx * ABx + APy * ABy) / ab2))
        projx = A[0] + t * ABx
        projy = A[1] + t * ABy
        dx, dy = (P[0] - projx, P[1] - projy)
    return math.hypot(dx, dy)


def _min_distance_to_polyline_km(lat, lon, route: List[Tuple[float, float]]):
    best = float("inf")
    for i in range(len(route) - 1):
        a_lon, a_lat = route[i]
        b_lon, b_lat = route[i + 1]
        d = _point_segment_distance_km(lon, lat, a_lon, a_lat, b_lon, b_lat)
        if d < best:
            best = d
        if best == 0:
            break
    return best


def _parse_float(s: Optional[str], default: Optional[float] = None):
    try:
        return float(s) if s not in (None, "") else default
    except Exception:
        return default


def _parse_int(s: Optional[str], default: int):
    try:
        return int(s) if s not in (None, "") else default
    except Exception:
        return default


def _coerce_route(raw) -> List[Tuple[float, float]]:
    route = []
    for p in raw:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            route.append((float(p[0]), float(p[1])))
        elif isinstance(p, dict):
            if "lon" in p and "lat" in p:
                route.append((float(p["lon"]), float(p["lat"])))
            else:
                route.append((float(p.get("longitude")), float(p.get("latitude"))))

    if len(route) > 500:
        keep = max(1, len(route) // 500)
        route = [route[i] for i in range(0, len(route), keep)]

    return route


def _route_bbox(route: List[Tuple[float, float]], pad_km: float):
    lons = [p[0] for p in route]
    lats = [p[1] for p in route]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    mid_lat = math.radians((min_lat + max_lat) / 2 or 0.0)
    deg_lat = pad_km / 111.0
    deg_lon = pad_km / (111.320 * max(0.1, math.cos(mid_lat)))

    return (min_lon - deg_lon, min_lat - deg_lat, max_lon + deg_lon, max_lat + deg_lat)

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


def route_search(event, _ctx):
    lang = get_requested_lang(event)

    qs = event.get("queryStringParameters") or {}
    q = qs.get("q")
    try:
        coords_raw = qs.get("coords")
        if not coords_raw:
            return _resp({"detail": "coords is required (JSON array of [lon,lat] or objects)."}, 400)
        route = _coerce_route(json.loads(coords_raw))
        if len(route) < 2:
            return _resp({"detail": "coords must contain at least 2 points."}, 400)
    except Exception as e:
        return _resp({"detail": f"invalid coords: {str(e)}"}, 400)

    radius_km = _parse_float(qs.get("radius_km"), 5.0)
    limit = _parse_int(qs.get("limit"), 50)
    cursor = _parse_int(qs.get("cursor"), 0)

    min_price = _parse_float(qs.get("min_price"))
    max_price = _parse_float(qs.get("max_price"))
    min_rating = _parse_float(qs.get("min_rating"))

    amenities_csv = qs.get("amenities")
    property_types_csv = qs.get("property_types")

    limit = max(1, min(limit, 200))

    min_lon, min_lat, max_lon, max_lat = _route_bbox(route, pad_km=radius_km)

    stmt = select(ListingORM).where(and_(
        ListingORM.longitude >= min_lon,
        ListingORM.longitude <= max_lon,
        ListingORM.latitude >= min_lat,
        ListingORM.latitude <= max_lat
    ))

    if q:
        q_raw = str(q).strip()
        q_en = q_raw
        try:
            q_en, _src = translate_text_auto(q_raw, "en")
        except Exception:
            q_en = q_raw

        like_en = f"%{q_en.lower()}%"
        like_raw = f"%{q_raw.lower()}%"

        stmt = stmt.where(
            # canonical first (requires you add *_en columns)
            func.lower(func.coalesce(ListingORM.title_en, ListingORM.title)).like(like_en) |
            func.lower(func.coalesce(ListingORM.city_en, ListingORM.city)).like(like_en) |
            func.lower(func.coalesce(ListingORM.street_en, ListingORM.street)).like(like_en) |
            func.lower(func.coalesce(ListingORM.location_en, ListingORM.location)).like(like_en) |

            # raw fallback
            func.lower(ListingORM.title).like(like_raw) |
            func.lower(ListingORM.city).like(like_raw) |
            func.lower(ListingORM.street).like(like_raw) |
            func.lower(ListingORM.location).like(like_raw)
        )

    if min_price is not None:
        stmt = stmt.where(ListingORM.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(ListingORM.price <= max_price)
    if min_rating is not None:
        stmt = stmt.where(ListingORM.rating >= min_rating)

    if property_types_csv:
        types = [t.strip().lower() for t in property_types_csv.split(",") if t.strip()]
        if types:
            stmt = stmt.where(func.lower(ListingORM.property_type).in_(types))

    stmt = stmt.order_by(desc(ListingORM.created_at), ListingORM.id.asc())

    need_amenities = None
    if amenities_csv:
        need_amenities = {a.strip().lower() for a in amenities_csv.split(",") if a.strip()}

    overfetch = limit * 3

    with session() as db:
        rows = db.execute(stmt.offset(cursor).limit(overfetch)).scalars().all()

        kept = []
        for r in rows:
            if need_amenities:
                have = {(a or "").strip().lower() for a in (r.amenities or [])}
                if not need_amenities.issubset(have):
                    continue

            d_km = _min_distance_to_polyline_km(r.latitude, r.longitude, route)
            if d_km <= radius_km:
                out = to_out(r)
                out = _ensure_i18n(db, r, out, lang)
                out["distance_from_route_km"] = round(d_km, 2)
                kept.append(out)
                if len(kept) >= limit:
                    break
        db.commit()

    next_cursor = (cursor + len(rows)) if (len(rows) == overfetch and len(kept) == limit) else None
    return _resp({"count": len(kept), "results": kept, "next_cursor": next_cursor})
