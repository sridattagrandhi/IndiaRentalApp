# common/models.py
from datetime import datetime

from sqlalchemy import (JSON, Column, Date, DateTime, Float, ForeignKey,
                        Integer, String, Text)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class ListingORM(Base):
    __tablename__ = "listings"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    street = Column(String, index=True)
    city = Column(String, index=True)
    price = Column(Float, default=0.0, nullable=False)
    rating = Column(Float, default=0.0, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    photo_url = Column(String)
    amenities = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

# ---------- NEW: users ----------
class UserORM(Base):
    __tablename__ = "users"

    # store UUIDs as 36-char strings; generate in Python
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cognito_sub = Column(Text, nullable=False, unique=True, index=True)
    email = Column(Text, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    profile = relationship("ProfileORM", uselist=False, back_populates="user", cascade="all, delete-orphan")

# ---------- NEW: profiles ----------
class ProfileORM(Base):
    __tablename__ = "profiles"

    # 1-1: primary key is also a foreign key to users.id
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    full_name = Column(Text)
    birthdate = Column(Date)
    gender = Column(String(32))
    phone = Column(Text)
    address = Column(Text)
    city = Column(Text)
    state = Column(Text)
    pincode = Column(String(12))
    country = Column(String(8))
    avatar_url = Column(Text)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("UserORM", back_populates="profile")
