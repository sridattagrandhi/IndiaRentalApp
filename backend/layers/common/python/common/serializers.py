# common/serializers.py
from typing import Optional

from .models import ListingORM


def to_out(listing: ListingORM) -> dict:
    return {
        "id": listing.id,
        "title": listing.title,
        "street": listing.street,
        "city": listing.city,
        "price": listing.price,
        "rating": listing.rating,
        "amenities": listing.amenities or [],
        "photo_url": listing.photo_url,
        "latitude": listing.latitude,
        "longitude": listing.longitude,
        "coordinates": {  # <-- ADD THIS
            "latitude": listing.latitude,
            "longitude": listing.longitude
        },
        "created_at": listing.created_at.isoformat() if listing.created_at else None,
        "updated_at": listing.updated_at.isoformat() if listing.updated_at else None,
    }
