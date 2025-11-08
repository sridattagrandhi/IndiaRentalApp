# functions/listing/handler.py
import json
import os
from typing import Optional, Tuple

from common.db import session
from common.models import ListingORM
from common.serializers import to_out
from sqlalchemy import and_, desc, func, select, text
from sqlalchemy.exc import DataError, OperationalError, ProgrammingError

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}
DEBUG = os.environ.get("DEBUG_ERRORS", "false").lower() == "true"

def _resp(body, status=200):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body)}

def _parse_float(s: Optional[str]) -> Optional[float]:
    if not s: return None
    try: return float(s)
    except: return None

def _parse_int(s: Optional[str], default: int) -> int:
    try: return int(s) if s not in (None, "") else default
    except: return default

def _parse_bbox(bbox: Optional[str]) -> Optional[Tuple[float,float,float,float]]:
    if not bbox: return None
    try:
        parts = [float(x.strip()) for x in bbox.split(",")]
        if len(parts) != 4: return None
        min_lon, min_lat, max_lon, max_lat = parts
        if min_lon > max_lon or min_lat > max_lat: return None
        return (min_lon, min_lat, max_lon, max_lat)
    except:
        return None

def list_listings(event, _ctx):
    try:
        qs = event.get("queryStringParameters") or {}
        q          = (qs.get("q") or "").strip() or None
        city       = (qs.get("city") or "").strip() or None
        bbox       = qs.get("bbox")
        min_price  = _parse_float(qs.get("min_price"))
        max_price  = _parse_float(qs.get("max_price"))
        min_rating = _parse_float(qs.get("min_rating"))
        sort       = (qs.get("sort") or "").strip().lower() or None
        limit      = _parse_int(qs.get("limit"), 20)
        cursor     = _parse_int(qs.get("cursor"), 0)
        limit = max(1, min(limit, 100))

        stmt = select(ListingORM)

        # bbox filter
        parsed = _parse_bbox(bbox)
        if parsed:
            min_lon, min_lat, max_lon, max_lat = parsed
            stmt = stmt.where(and_(
                ListingORM.longitude >= min_lon,
                ListingORM.longitude <= max_lon,
                ListingORM.latitude  >= min_lat,
                ListingORM.latitude  <= max_lat,
            ))

        # free-text search
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                ListingORM.title.ilike(like) |
                ListingORM.city.ilike(like)  |
                ListingORM.street.ilike(like)
            )

        if city:
            stmt = stmt.where(func.lower(ListingORM.city) == city.lower())

        if min_price is not None:  stmt = stmt.where(ListingORM.price  >= min_price)
        if max_price is not None:  stmt = stmt.where(ListingORM.price  <= max_price)
        if min_rating is not None: stmt = stmt.where(ListingORM.rating >= min_rating)

        if   sort == "price_asc":   stmt = stmt.order_by(ListingORM.price.asc(), ListingORM.id.asc())
        elif sort == "price_desc":  stmt = stmt.order_by(ListingORM.price.desc(), ListingORM.id.asc())
        elif sort == "rating_desc": stmt = stmt.order_by(ListingORM.rating.desc(), ListingORM.id.asc())
        else:                       stmt = stmt.order_by(desc(ListingORM.created_at), ListingORM.id.asc())

        with session() as db:
            rows = db.execute(stmt.offset(cursor).limit(limit)).scalars().all()
            results = [to_out(r) for r in rows]

        next_cursor = cursor + len(results) if len(results) == limit else None
        return _resp({"count": len(results), "results": results, "next_cursor": next_cursor})

    except (DataError, ProgrammingError) as e:
        print("Query/SQL error:", repr(e))
        return _resp({"detail": "Invalid query or database error." if not DEBUG else str(e)}, 400)
    except (OperationalError,) as e:
        print("DB connectivity error:", repr(e))
        return _resp({"detail": "Database unavailable." if not DEBUG else str(e)}, 503)
    except Exception as e:
        print("Unhandled error in list_listings:", repr(e))
        return _resp({"detail": "Internal error." if not DEBUG else str(e)}, 500)

def get_listing(event, _ctx):
    try:
        pid = (event.get("pathParameters") or {}).get("listing_id") or (event.get("pathParameters") or {}).get("id")
        listing_id = int(pid)
    except Exception:
        return _resp({"detail":"Invalid listing id."}, 400)

    try:
        with session() as db:
            row = db.get(ListingORM, listing_id)
            if not row:
                return _resp({"detail":"Listing not found"}, 404)
            return _resp(to_out(row))
    except Exception as e:
        print("Unhandled error in get_listing:", repr(e))
        return _resp({"detail":"Internal error." if not DEBUG else str(e)}, 500)

# Optional: simple DB health
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
            cols = s.execute(text("""
              SELECT column_name FROM information_schema.columns
              WHERE table_name='listings' ORDER BY ordinal_position
            """)).scalars().all()
            cnt = s.execute(text("SELECT COUNT(*) FROM listings")).scalar()
            row = s.execute(text("SELECT id,title FROM listings ORDER BY id LIMIT 1")).mappings().first()
        return _resp({"ok": True, "columns": cols, "count": cnt, "sample": dict(row) if row else None})
    except Exception as e:
        print("health_listings error:", repr(e))
        return _resp({"ok": False, "error": str(e)}, 500)
