# scripts/seed_listings.py
import datetime
import os
import random

from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url

N = int(os.environ.get("N", "40"))
DATABASE_URL = os.environ["DATABASE_URL"]
url = make_url(DATABASE_URL)

connect_args = {}
if url.drivername.startswith("postgresql+pg8000"):
    connect_args["ssl_context"] = True

engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True, future=True)

CITIES = [
    ("Koramangala, Bengaluru", 12.934, 77.615),
    ("HSR Layout, Bengaluru", 12.91, 77.64),
    ("Andheri West, Mumbai", 19.13, 72.83),
    ("Powai, Mumbai", 19.11, 72.90),
    ("Hauz Khas, Delhi", 28.55, 77.20),
    ("Gachibowli, Hyderabad", 17.44, 78.35),
    ("Koregaon Park, Pune", 18.54, 73.90),
    ("T. Nagar, Chennai", 13.04, 80.23),
]

AMENITY_POOL = [
    "WiFi","Air Conditioning","Kitchen","Washing Machine","TV","Parking","Elevator","Workspace",
    "24x7 Security","Power Backup","Pet Friendly","Gym","Pool"
]

IMG = [
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200",
  "https://images.unsplash.com/photo-1505691723518-36a5ac3b2b8f?w=1200",
  "https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?w=1200",
  "https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=1200",
  "https://images.unsplash.com/photo-1560448075-bb4caa6cfc6f?w=1200"
]

def jitter(lat, lon, d=0.02):
    return (lat + (random.random()-0.5)*d, lon + (random.random()-0.5)*d)

rows = []
for i in range(1, N+1):
    city_label, base_lat, base_lon = random.choice(CITIES)
    lat, lon = jitter(base_lat, base_lon)
    title = random.choice(["Modern Studio","Sunny Apartment","Cozy Room","City View Flat","Quiet Home"])
    title = f"{title} #{i}"
    price = random.randint(1200, 5500)           # INR per night / or monthly as you prefer
    rating = round(random.uniform(3.6, 4.9), 1)
    amen_count = random.randint(4, 8)
    amenities = random.sample(AMENITY_POOL, amen_count)
    photo_url = IMG[i % len(IMG)]
    street = f"{random.randint(1, 250)} Test Road, Block {random.randint(1, 20)}"

    rows.append(dict(
        id=i,
        title=title,
        street=street,
        city=city_label,
        price=price,
        rating=rating,
        amenities=amenities,                # TEXT[] in Postgres
        photo_url=photo_url,
        latitude=lat,
        longitude=lon,
        images=IMG,
        thumbnails=[u.replace("w=1200","w=200") for u in IMG],
        description=f"{title} in {city_label}. Fast Wi-Fi, great location, seeded test data.",
    ))

with engine.begin() as conn:
    # Ensure table exists
    try:
        conn.execute(text("SELECT 1 FROM listings LIMIT 1"))
    except Exception as e:
        raise SystemExit("Table 'listings' missing. Run `alembic upgrade head` first.") from e

    # Insert
    insert_sql = """
    INSERT INTO listings
      (id, title, street, city, price, rating, amenities, photo_url, latitude, longitude, images, thumbnails, description)
    VALUES
      (:id, :title, :street, :city, :price, :rating, :amenities, :photo_url, :latitude, :longitude, :images, :thumbnails, :description)
    ON CONFLICT (id) DO NOTHING
    """
    for r in rows:
        conn.execute(text(insert_sql), r)

print(f"✅ Seeded {len(rows)} listings.")
