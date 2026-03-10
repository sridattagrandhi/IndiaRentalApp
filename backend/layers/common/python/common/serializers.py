# common/serializers.py
from typing import Optional

from .models import ListingORM


def to_out(listing: ListingORM) -> dict:
    return {
        "id": listing.id,
        "title": listing.title,
        "street": listing.street,
        "city": listing.city,
        # human-friendly location string if you’re storing it
        "location": getattr(listing, "location", None),

        # pricing + rating
        "price": listing.price,
        "rating": listing.rating,
        "review_count": getattr(listing, "review_count", 0),

        # photos
        "photo_url": listing.photo_url,
        "images": listing.images or [],  # S3 URLs array

        # details
        "amenities": listing.amenities or [],
        "rules": listing.rules or [],
        "offers": listing.offers or [],
        "max_guests": getattr(listing, "max_guests", None),

        # house rules times
        "check_in_time": listing.check_in_time,
        "check_out_time": listing.check_out_time,

        # building / unit info
        "building_label": getattr(listing, "building_label", None),
        "building_key": getattr(listing, "building_key", None),
        "unit_name": getattr(listing, "unit_name", None),

        # coordinates (for the map)
        "latitude": listing.latitude,
        "longitude": listing.longitude,

        # status + timestamps
        "status": listing.status,
        "created_at": listing.created_at.isoformat() if listing.created_at else None,
        "updated_at": listing.updated_at.isoformat() if listing.updated_at else None,
    }
