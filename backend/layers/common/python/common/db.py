# common/db.py
import os

from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker

_DATABASE_URL = os.environ["DATABASE_URL"]

# pg8000 specific SSL configuration
connect_args = {}
url = make_url(_DATABASE_URL)

if url.drivername == "postgresql+pg8000":
    # pg8000 expects 'ssl_context' as a boolean or SSL context dict
    connect_args = {"ssl_context": True}

_engine = create_engine(
    _DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=1,
    max_overflow=0,
    future=True,
)
SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)

def session():
    return SessionLocal()  # caller closes