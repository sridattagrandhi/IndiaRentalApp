# common/models.py
import uuid  # <-- REQUIRED
from datetime import datetime

from sqlalchemy import (JSON, CheckConstraint, Column, Date, DateTime, Float,
                        ForeignKey, Index, Integer, String, Text,
                        UniqueConstraint, text)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class ListingORM(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)

    # Basic info
    title = Column(String, nullable=False)

    # Address pieces
    street = Column(String, index=True)
    city = Column(String, index=True)
    state = Column(String, index=True)  # ✅ ENSURE THIS EXISTS
    pincode = Column(String(12), index=True)  # ✅ ENSURE THIS EXISTS

    # Combined location string from frontend (e.g. "Bengaluru, Karnataka")
    location = Column(String, index=True)

    # Pricing & rating
    price = Column(Float, default=0.0, nullable=False)
    rating = Column(Float, default=0.0, nullable=False)
    review_count = Column(Integer, default=0, nullable=False)
    max_guests = Column(Integer, default=1, nullable=False)

    # ✅ Property details - ENSURE THESE EXIST
    bedrooms = Column(Integer, default=1, nullable=False)
    bathrooms = Column(Integer, default=1, nullable=False)
    beds = Column(Integer, default=1, nullable=False)

    # Coordinates
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Long-form description
    description = Column(Text)

    # live | paused | review | draft
    status = Column(String, default="live", nullable=False, index=True)

    # Media & structured extras
    photo_url = Column(String)
    images = Column(JSON)
    amenities = Column(JSON)

    # House rules + "What this place offers"
    rules = Column(JSON)
    offers = Column(JSON)
    check_in_time = Column(String)
    check_out_time = Column(String)

    # Building / unit metadata
    building_label = Column(String, index=True)
    building_key = Column(String, index=True)
    unit_name = Column(String)
    property_type = Column(String(16), default="home", nullable=False, index=True)

    # Hotel-specific: room type inventory (only used when property_type == "hotel")
    room_types = relationship(
        "HotelRoomTypeORM",
        back_populates="listing",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="HotelRoomTypeORM.id",
    )

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Language
    source_language = Column(String(16), nullable=True)  # detected at create/update
    i18n = Column(JSONB, nullable=False, server_default="{}")  # translation cache
    i18n_updated_at = Column(DateTime, nullable=False, server_default=text("now()"))

    # Canonical (English) fields for search/indexing (so Telugu/Hindi queries work)
    title_en = Column(Text)
    location_en = Column(Text)
    street_en = Column(Text)
    city_en = Column(Text)
    state_en = Column(Text)
    description_en = Column(Text)

    # Host that owns this listing
    host_user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    host = relationship("UserORM", back_populates="listings")

    # Relationships
    bookings = relationship("BookingORM", back_populates="listing", cascade="all, delete-orphan")
    reviews = relationship("ReviewORM", back_populates="listing", cascade="all, delete-orphan")


class HotelRoomTypeORM(Base):
    __tablename__ = "hotel_room_types"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)

    # Display
    name = Column(String(120), nullable=False)
    floor = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)

    # Inventory + pricing
    quantity = Column(Integer, nullable=False, server_default="1")
    price = Column(Float, nullable=True)  # optional override; else listing.price
    max_guests = Column(Integer, nullable=False, server_default="2")

    # Optional overrides for room specifics
    bedrooms = Column(Integer, nullable=True)
    bathrooms = Column(Integer, nullable=True)
    beds = Column(Integer, nullable=True)

    amenities = Column(JSONB, nullable=True)  # list[str]
    photos = Column(JSONB, nullable=True)     # list[str]

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    listing = relationship("ListingORM", back_populates="room_types")


class UserORM(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cognito_sub = Column(Text, nullable=False, unique=True, index=True)
    email = Column(Text, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    profile = relationship("ProfileORM", uselist=False, back_populates="user", cascade="all, delete-orphan")
    listings = relationship("ListingORM", back_populates="host")
    hosted_bookings = relationship(
        "BookingORM",
        foreign_keys="BookingORM.host_user_id",
        back_populates="host",
    )
    guest_bookings = relationship(
        "BookingORM",
        foreign_keys="BookingORM.guest_user_id",
        back_populates="guest",
    )

    reviews_written = relationship("ReviewORM", back_populates="guest")

    wishlists = relationship(
        "WishlistORM",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    trip_lists = relationship("TripListORM", back_populates="user", cascade="all, delete-orphan")

class ProfileORM(Base):
    __tablename__ = "profiles"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    full_name = Column(Text)
    birthdate = Column(Date)
    gender = Column(String(32))
    phone = Column(Text)
    address = Column(Text)
    city = Column(Text)
    state = Column(Text)
    pincode = Column(String(12))
    country = Column(String(64))  # was 8; enlarge or switch to ISO-2 if you prefer
    avatar_url = Column(Text)
    preferred_language = Column(String(16), nullable=False, server_default="en")
    source_language = Column(String(16), nullable=True)
    i18n = Column(JSONB, nullable=False, server_default="{}")
    i18n_updated_at = Column(DateTime, nullable=False, server_default=text("now()"))

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("UserORM", back_populates="profile")


class BookingORM(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_code = Column(String(16), unique=True, nullable=False, index=True)
    
    # Relationships
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False, index=True)
    host_user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    guest_user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Booking details
    check_in = Column(Date, nullable=False, index=True)
    check_out = Column(Date, nullable=False, index=True)
    guests = Column(Integer, nullable=False, default=1)
    
    # Pricing
    total_paid = Column(Float, nullable=False)
    payout_amount = Column(Float)  # Amount host receives (after commission)
    
    # Status: pending, confirmed, cancelled, completed
    status = Column(String(16), nullable=False, default="pending", index=True)
    
    # Guest info (cached for quick display)
    guest_name = Column(String(100))
    guest_email = Column(String(255))
    guest_phone = Column(String(20))
    
    # Listing info (cached)
    listing_name = Column(String(255))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Cancellation details
    cancelled_by = Column(String(36), ForeignKey("users.id"))  # user_id who cancelled
    cancellation_reason = Column(Text)
    
    # Additional metadata
    special_requests = Column(Text)
    notes = Column(Text)  # Host notes

    room_type_id = Column(
        Integer,
        ForeignKey("hotel_room_types.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    room_type_name = Column(String(120), nullable=True)
    
    # Relationships
    listing = relationship("ListingORM", back_populates="bookings")
    host = relationship("UserORM", foreign_keys=[host_user_id], back_populates="hosted_bookings")
    guest = relationship("UserORM", foreign_keys=[guest_user_id], back_populates="guest_bookings")
    room_type = relationship("HotelRoomTypeORM")

    review = relationship("ReviewORM", uselist=False, back_populates="booking")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('check_out > check_in', name='check_valid_dates'),
        CheckConstraint('guests > 0', name='check_positive_guests'),
        CheckConstraint('total_paid >= 0', name='check_positive_amount'),
    )

class ReviewORM(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)

    # Each review is linked to a listing and a specific booking
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Guest who wrote the review
    guest_user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    rating = Column(Float, nullable=False)   # 1–5
    comment = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    listing = relationship("ListingORM", back_populates="reviews")
    booking = relationship("BookingORM", back_populates="review")
    guest = relationship("UserORM", back_populates="reviews_written")

    source_language = Column(String(16), nullable=True)
    i18n = Column(JSONB, nullable=False, server_default="{}")


class WishlistORM(Base):
    __tablename__ = "wishlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(100), nullable=False)
    description = Column(Text)
    cover_image = Column(String)  # optional, can store a photo_url

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = relationship("UserORM", back_populates="wishlists")
    items = relationship(
        "WishlistItemORM",
        back_populates="wishlist",
        cascade="all, delete-orphan",
    )


class WishlistItemORM(Base):
    __tablename__ = "wishlist_items"

    id = Column(Integer, primary_key=True, index=True)
    wishlist_id = Column(
        Integer,
        ForeignKey("wishlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    listing_id = Column(
        Integer,
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    wishlist = relationship("WishlistORM", back_populates="items")
    listing = relationship("ListingORM")

    __table_args__ = (
        UniqueConstraint(
            "wishlist_id",
            "listing_id",
            name="uq_wishlist_items_wishlist_listing",
        ),
    )

class TripListORM(Base):
    __tablename__ = "trip_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(100), nullable=False)
    description = Column(Text)
    cover_image = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("UserORM", back_populates="trip_lists")
    items = relationship(
        "TripListItemORM",
        back_populates="trip_list",
        cascade="all, delete-orphan",
    )


class TripListItemORM(Base):
    __tablename__ = "trip_list_items"

    id = Column(Integer, primary_key=True, index=True)
    trip_list_id = Column(
        Integer,
        ForeignKey("trip_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    listing_id = Column(
        Integer,
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    trip_list = relationship("TripListORM", back_populates="items")
    listing = relationship("ListingORM")

    __table_args__ = (
        UniqueConstraint(
            "trip_list_id",
            "listing_id",
            name="uq_trip_list_items_trip_listing",
        ),
    )



