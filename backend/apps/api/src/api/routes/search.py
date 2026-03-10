# apps/api/src/api/routes/search.py
from __future__ import annotations

from typing import Any, Dict, Optional

from api.core.db import get_db
from api.routes.listings import ListingORM, ListingOut, _to_out
from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

router = APIRouter(tags=["search"])


@router.get("/search", response_model=Dict[str, Any])
def search_listings(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Search text on title/street/city"),
    bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat"),
    # optional booking filters (used by UI)
    start: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="YYYY-MM-DD"),
    guests: Optional[int] = Query(None, ge=1),
    amenities: Optional[str] = Query(None, description="comma-separated list"),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    sort: Optional[str] = Query(None),
    # pagination
    limit: int = Query(20, ge=1, le=100),
    cursor: int = Query(0, ge=0),
) -> Dict[str, Any]:
    """
    Note: start/end/guests are accepted for parity with the UI. Availability merging
    can be added later; for now we just return matching listings.
    """
    stmt = select(ListingORM)

    # viewport
    def parse_bbox(b: Optional[str]):
        if not b:
            return None
        try:
            min_lon, min_lat, max_lon, max_lat = [float(x) for x in b.split(",")]
            return min_lon, min_lat, max_lon, max_lat
        except Exception:
            return None

    parsed = parse_bbox(bbox)
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

    # text filter
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            func.lower(ListingORM.title).like(like)
            | func.lower(ListingORM.city).like(like)
            | func.lower(ListingORM.street).like(like)
        )

    # numeric filters
    if min_price is not None:
        stmt = stmt.where(ListingORM.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(ListingORM.price <= max_price)
    if min_rating is not None:
        stmt = stmt.where(ListingORM.rating >= min_rating)

    # order
    if sort == "price_asc":
        stmt = stmt.order_by(ListingORM.price.asc())
    elif sort == "price_desc":
        stmt = stmt.order_by(ListingORM.price.desc())
    elif sort == "rating_desc":
        stmt = stmt.order_by(ListingORM.rating.desc())
    else:
        stmt = stmt.order_by(desc(ListingORM.created_at))

    # pagination
    stmt = stmt.offset(cursor).limit(limit)
    rows = db.execute(stmt).scalars().all()

    # amenities (client sends CSV) – filter in Python for portability
    if amenities:
        need = {a.strip().lower() for a in amenities.split(",") if a.strip()}
        rows = [
            r
            for r in rows
            if need.issubset({(a or "").lower() for a in (r.amenities or [])})
        ]

    out = [_to_out(r).model_dump() for r in rows]
    next_cursor = cursor + len(out)
    return {
        "count": len(out),
        "results": out,
        "next_cursor": (next_cursor if len(out) == limit else None),
    }
