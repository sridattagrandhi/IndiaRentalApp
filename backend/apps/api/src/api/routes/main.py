from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

router = APIRouter()

# === Unified MOCK_ITEMS shape (matches app/search.tsx Property) ===
MOCK_ITEMS: List[Dict[str, Any]] = [
    {
        "id": f"ls_{i}",
        "name": f"Cozy Stay #{i}",
        "location": "San Francisco, CA",
        "price": 3200 + i * 50,
        "rating": round(4.3 + (i % 4) * 0.2, 1),
        "distance": f"{0.8 + i * 0.3:.1f} km",
        "image": f"https://picsum.photos/seed/{i}/640/480",
        "features": ["WiFi", "AC", "Kitchen", "Parking"][: (i % 4) + 1],
        "type": ["room", "home", "hotel"][i % 3],
        "instantBook": (i % 2 == 0),
        "coordinates": {  # object with lat/lon -> matches your UI
            "latitude": 37.7749 + i * 0.005,
            "longitude": -122.4194 + i * 0.005,
        },
    }
    for i in range(1, 5)
]

PAGE_SIZE = 12

def slice_with_cursor(items: List[Dict[str, Any]], cursor: Optional[str]):
    # cursor format: "offset:<n>"
    offset = 0
    if cursor and cursor.startswith("offset:"):
        try:
            offset = int(cursor.split(":")[1])
        except Exception:
            offset = 0
    next_offset = offset + PAGE_SIZE
    page = items[offset: next_offset]
    next_cursor = f"offset:{next_offset}" if next_offset < len(items) else None
    return page, next_cursor

@router.get("/home")
def get_home(cursor: Optional[str] = Query(None)) -> Dict[str, Any]:
    page, next_cursor = slice_with_cursor(MOCK_ITEMS, cursor)
    return {
        "popular": ["San Francisco", "Oakland", "San Jose", "Berkeley"],
        "chips": ["Tonight", "Weekend", "₹ Budget", "Family", "Parking"],
        "items": page,           # <-- unified listing shape
        "next_cursor": next_cursor,
    }
