import json

from common.db import session
from common.models import ListingORM
from common.serializers import to_out
from sqlalchemy import and_, desc, func, select


def _ok(body, status=200):
    return {"statusCode": status, "headers": {"Content-Type":"application/json"}, "body": json.dumps(body)}

def _parse_bbox(b):
    if not b: return None
    try:
        min_lon, min_lat, max_lon, max_lat = [float(x) for x in b.split(",")]
        return min_lon, min_lat, max_lon, max_lat
    except Exception:
        return None

def search(event, _ctx):
    qs = event.get("queryStringParameters") or {}
    q       = qs.get("q")
    bbox    = qs.get("bbox")
    min_price = qs.get("min_price")
    max_price = qs.get("max_price")
    min_rating= qs.get("min_rating")
    sort    = qs.get("sort")
    limit   = int(qs.get("limit", "20"))
    cursor  = int(qs.get("cursor", "0"))
    amenities_csv = qs.get("amenities")

    with session() as db:
        stmt = select(ListingORM)
        parsed = _parse_bbox(bbox)
        if parsed:
            min_lon, min_lat, max_lon, max_lat = parsed
            stmt = stmt.where(and_(
                ListingORM.longitude >= min_lon,
                ListingORM.longitude <= max_lon,
                ListingORM.latitude  >= min_lat,
                ListingORM.latitude  <= max_lat,
            ))
        if q:
            like = f"%{q.lower()}%"
            stmt = stmt.where(
                func.lower(ListingORM.title).like(like) |
                func.lower(ListingORM.city).like(like)  |
                func.lower(ListingORM.street).like(like)
            )
        if min_price is not None:
            stmt = stmt.where(ListingORM.price >= float(min_price))
        if max_price is not None:
            stmt = stmt.where(ListingORM.price <= float(max_price))
        if min_rating is not None:
            stmt = stmt.where(ListingORM.rating >= float(min_rating))

        if   sort == "price_asc":  stmt = stmt.order_by(ListingORM.price.asc())
        elif sort == "price_desc": stmt = stmt.order_by(ListingORM.price.desc())
        elif sort == "rating_desc":stmt = stmt.order_by(ListingORM.rating.desc())
        else:                      stmt = stmt.order_by(desc(ListingORM.created_at))

        rows = db.execute(stmt.offset(cursor).limit(limit)).scalars().all()

        # amenities CSV filter (same as current FastAPI)
        if amenities_csv:
            need = {a.strip().lower() for a in amenities_csv.split(",") if a.strip()}
            rows = [r for r in rows if need.issubset({(a or "").lower() for a in (r.amenities or [])})]

        out = [to_out(r) for r in rows]
        next_cursor = cursor + len(out)
        return _ok({"count": len(out), "results": out, "next_cursor": (next_cursor if len(out)==limit else None)})
