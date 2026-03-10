# apps/api/src/api/routes/listings.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from api.core.db import Base, get_db  # your existing DB helpers
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (JSON, Column, DateTime, Float, Integer, String, and_,
                        desc, func, select)
from sqlalchemy.orm import Session

router = APIRouter(tags=["listings"])

# ---------- ORM ----------

class ListingORM(Base):  # type: ignore[misc]
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    # NEW: full street line (e.g., “12 MG Road, Ashok Nagar”)
    street = Column(String, nullable=True, index=True)  # <— added
    city = Column(String, nullable=True, index=True)

    price = Column(Float, nullable=False, default=0.0)
    rating = Column(Float, nullable=False, default=0.0)

    # latitude/longitude stored separately for easy spatial filters
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    photo_url = Column(String, nullable=True)
    amenities = Column(JSON, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


# ---------- Schemas ----------

class Coordinates(BaseModel):
    latitude: float
    longitude: float


class ListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    street: Optional[str] = None
    city: Optional[str] = None
    price: float
    rating: float
    photo_url: Optional[str] = None
    amenities: List[str] = Field(default_factory=list)
    coordinates: Coordinates
    # convenience string from query (e.g., “1.2 km”) – optional
    distance: Optional[str] = None


def _to_out(row: ListingORM, distance_km: Optional[float] = None) -> ListingOut:
    return ListingOut(
        id=row.id,
        title=row.title,
        street=row.street,
        city=row.city,
        price=row.price or 0.0,
        rating=row.rating or 0.0,
        photo_url=row.photo_url,
        amenities=(row.amenities or []),
        coordinates=Coordinates(latitude=row.latitude, longitude=row.longitude),
        distance=(f"{distance_km:.1f} km" if distance_km is not None else None),
    )


# ---------- Helpers ----------

def _parse_bbox(bbox: Optional[str]) -> Optional[Tuple[float, float, float, float]]:
    # expected: "minLon,minLat,maxLon,maxLat"
    if not bbox:
        return None
    try:
        min_lon, min_lat, max_lon, max_lat = [float(x) for x in bbox.split(",")]
        return (min_lon, min_lat, max_lon, max_lat)
    except Exception:
        return None


# ---------- Routes ----------

@router.get("/listings", response_model=Dict[str, Any])
def list_listings(
    db: Session = Depends(get_db),
    # text/city filters
    q: Optional[str] = Query(None, description="Text on title/street/city"),
    city: Optional[str] = Query(None, description="City name"),
    # price/rating
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    # map viewport (minLon,minLat,maxLon,maxLat)
    bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat"),
    # pagination
    limit: int = Query(20, ge=1, le=100),
    cursor: int = Query(0, ge=0),
    # sorting
    sort: Optional[str] = Query(
        None, description="price_asc|price_desc|rating_desc|newest"
    ),
) -> Dict[str, Any]:
    stmt = select(ListingORM)

    # viewport
    if _parse_bbox(bbox):
        min_lon, min_lat, max_lon, max_lat = _parse_bbox(bbox)  # type: ignore[misc]
        stmt = stmt.where(
            and_(
                ListingORM.longitude >= min_lon,
                ListingORM.longitude <= max_lon,
                ListingORM.latitude >= min_lat,
                ListingORM.latitude <= max_lat,
            )
        )

    # text filters
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            func.lower(ListingORM.title).like(like)
            | func.lower(ListingORM.city).like(like)
            | func.lower(ListingORM.street).like(like)
        )
    if city:
        stmt = stmt.where(func.lower(ListingORM.city) == city.lower())

    # price & rating
    if min_price is not None:
        stmt = stmt.where(ListingORM.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(ListingORM.price <= max_price)
    if min_rating is not None:
        stmt = stmt.where(ListingORM.rating >= min_rating)

    # sort
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

    out = [_to_out(r).model_dump() for r in rows]
    next_cursor = cursor + len(out)
    return {
        "count": len(out),
        "results": out,
        "next_cursor": (next_cursor if len(out) == limit else None),
    }


@router.get("/listings/{listing_id}", response_model=ListingOut)
def get_listing_by_id(listing_id: int, db: Session = Depends(get_db)) -> ListingOut:
    row = db.get(ListingORM, listing_id)
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    return _to_out(row)
