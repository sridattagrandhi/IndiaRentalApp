# common/db.py
import os
import ssl

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def create_db_engine():
    """Create a new database engine with proper SSL configuration"""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Configure SSL for pg8000
    connect_args = {}
    if "pg8000" in database_url:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        connect_args["ssl_context"] = ssl_context
    
    return create_engine(
        database_url,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=1,
        max_overflow=0
    )

# Create engine
_engine = create_db_engine()

# Create session factory
SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)

def engine():
    """Get the engine instance"""
    return _engine

def session():
    """Create and return a new session"""
    return SessionLocal()