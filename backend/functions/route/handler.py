# functions/route/handler.py
import json
import math
from typing import List, Optional, Tuple

from common.db import session
from common.models import ListingORM
from common.serializers import to_out
from sqlalchemy import and_, desc, func, select

CORS = {
    "Content-Type":"application/json",
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Headers":"Content-Type,Authorization",
    "Access-Control-Allow-Methods":"GET,OPTIONS",
}

def _resp(body, status=200):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body)}

# --- geo helpers (no PostGIS needed) ---
R_EARTH_KM = 6371.0088

def _haversine_km(lat1, lon1, lat2, lon2):
    # all args in degrees
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2)
    return 2 * R_EARTH_KM * math.asin(math.sqrt(a))

def _point_segment_distance_km(px, py, ax, ay, bx, by):
    # point P to segment AB distance on a sphere ~ project in lat/lon plane with small-segment assumption
    # Convert to meters-scale vector math by approximate equirectangular projection around segment mid
    lat0 = math.radians((ay + by) / 2.0)
    def xy(lon, lat):
        x = math.radians(lon) * math.cos(lat0) * R_EARTH_KM
        y = math.radians(lat) * R_EARTH_KM
        return (x, y)
    P = xy(px, py); A = xy(ax, ay); B = xy(bx, by)

    # projection of AP onto AB, clamped to segment
    ABx, ABy = (B[0]-A[0], B[1]-A[1])
    APx, APy = (P[0]-A[0], P[1]-A[1])
    ab2 = ABx*ABx + ABy*ABy
    if ab2 == 0:
        dx, dy = APx, APy
    else:
        t = max(0.0, min(1.0, (APx*ABx + APy*ABy) / ab2))
        projx = A[0] + t*ABx; projy = A[1] + t*ABy
        dx, dy = (P[0]-projx, P[1]-projy)
    return math.hypot(dx, dy)  # already in km due to scaling above

def _min_distance_to_polyline_km(lat, lon, route: List[Tuple[float,float]]):
    best = float("inf")
    for i in range(len(route)-1):
        a_lon, a_lat = route[i]
        b_lon, b_lat = route[i+1]
        d = _point_segment_distance_km(lon, lat, a_lon, a_lat, b_lon, b_lat)
        if d < best: best = d
        if best == 0: break
    return best

def _parse_float(s: Optional[str], default: Optional[float]=None):
    try:
        return float(s) if s not in (None,"") else default
    except:
        return default

def _parse_int(s: Optional[str], default: int):
    try:
        return int(s) if s not in (None,"") else default
    except:
        return default

def _coerce_route(raw) -> List[Tuple[float,float]]:
    """
    Accepts:
    - [[lon,lat], [lon,lat], ...] OR
    - [{"lon":..., "lat":...}, ...] OR
    - [{"longitude":..., "latitude":...}, ...]
    Returns list of (lon,lat) tuples.
    """
    route = []
    for p in raw:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            route.append((float(p[0]), float(p[1])))
        elif isinstance(p, dict):
            if "lon" in p and "lat" in p:
                route.append((float(p["lon"]), float(p["lat"])))
            else:
                route.append((float(p.get("longitude")), float(p.get("latitude"))))
    # optional thinning for very dense polylines
    if len(route) > 500:  # keep every Nth to reduce CPU
        keep = max(1, len(route)//500)
        route = [route[i] for i in range(0, len(route), keep)]
        if route[-1] != route[-1]: pass
    return route

def _route_bbox(route: List[Tuple[float,float]], pad_km: float):
    lons = [p[0] for p in route]; lats = [p[1] for p in route]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    # pad degrees ~ km; 1 deg lat ~ 111 km; lon depends on latitude so take worst-case at mid-lat
    mid_lat = math.radians((min_lat + max_lat)/2 or 0.0)
    deg_lat = pad_km / 111.0
    deg_lon = pad_km / (111.320 * max(0.1, math.cos(mid_lat)))
    return (min_lon - deg_lon, min_lat - deg_lat, max_lon + deg_lon, max_lat + deg_lon)

def route_search(event, _ctx):
    qs = event.get("queryStringParameters") or {}
    try:
        coords_raw = qs.get("coords")
        if not coords_raw:
            return _resp({"detail": "coords is required (JSON array of [lon,lat] or objects)."}, 400)
        route = _coerce_route(json.loads(coords_raw))
        if len(route) < 2:
            return _resp({"detail": "coords must contain at least 2 points."}, 400)
    except Exception as e:
        return _resp({"detail": f"invalid coords: {str(e)}"}, 400)

    radius_km  = _parse_float(qs.get("radius_km"), 5.0)
    limit      = _parse_int(qs.get("limit"), 50)
    cursor     = _parse_int(qs.get("cursor"), 0)
    min_price  = _parse_float(qs.get("min_price"))
    max_price  = _parse_float(qs.get("max_price"))
    min_rating = _parse_float(qs.get("min_rating"))
    limit = max(1, min(limit, 200))

    # fast pre-filter: listings within bbox padded by radius
    min_lon, min_lat, max_lon, max_lat = _route_bbox(route, pad_km=radius_km)

    stmt = select(ListingORM).where(and_(
        ListingORM.longitude >= min_lon,
        ListingORM.longitude <= max_lon,
        ListingORM.latitude  >= min_lat,
        ListingORM.latitude  <= max_lat
    ))

    if min_price is not None:  stmt = stmt.where(ListingORM.price  >= min_price)
    if max_price is not None:  stmt = stmt.where(ListingORM.price  <= max_price)
    if min_rating is not None: stmt = stmt.where(ListingORM.rating >= min_rating)

    # order newest then id for stable paging (same as your feed)  # :contentReference[oaicite:4]{index=4}
    stmt = stmt.order_by(desc(ListingORM.created_at), ListingORM.id.asc())

    with session() as db:
        rows = db.execute(stmt.offset(cursor).limit(limit*3)).scalars().all()  # overfetch a bit; we'll filter in Python
        kept = []
        for r in rows:
            d_km = _min_distance_to_polyline_km(r.latitude, r.longitude, route)
            if d_km <= radius_km:
                out = to_out(r)
                out["distance_from_route_km"] = round(d_km, 2)
                kept.append(out)
                if len(kept) >= limit:
                    break

    next_cursor = cursor + len(rows) if len(kept) == limit else None
    return _resp({"count": len(kept), "results": kept, "next_cursor": next_cursor})
