#!/usr/bin/env python3
"""
Test database connection locally to verify credentials work
Run this from your local machine to test if credentials are valid
"""
import os
import ssl

# Load from .env file
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

print(f"Testing connection with DATABASE_URL...")
print(f"Parsed URL: {DATABASE_URL[:50]}...")

try:
    # Parse URL
    u = make_url(DATABASE_URL)
    print(f"\nConnection details:")
    print(f"  Driver: {u.drivername}")
    print(f"  User: {u.username}")
    print(f"  Host: {u.host}")
    print(f"  Port: {u.port}")
    print(f"  Database: {u.database}")
    print(f"  Password length: {len(u.password) if u.password else 0}")
    
    # Setup SSL context for pg8000
    connect_args = {}
    if u.drivername.endswith("pg8000"):
        ctx = ssl.create_default_context()
        connect_args["ssl_context"] = ctx
        print(f"  SSL: enabled (pg8000)")
    
    # Create engine
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        echo=True  # This will show us the actual SQL being executed
    )
    
    # Test connection
    print("\nAttempting to connect...")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        version = result.scalar()
        print(f"\n✅ SUCCESS! Connected to PostgreSQL")
        print(f"Version: {version}")
        
        # Test users table
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        print(f"Users table count: {count}")
        
        # Test listings table
        result = conn.execute(text("SELECT COUNT(*) FROM listings"))
        count = result.scalar()
        print(f"Listings table count: {count}")
        
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print(f"\nError type: {type(e).__name__}")
    import traceback
    traceback.print_exc()