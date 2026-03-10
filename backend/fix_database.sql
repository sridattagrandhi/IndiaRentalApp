-- First, connect to the postgres database, then run these commands:

-- Check if india_rental_dev database exists
SELECT datname FROM pg_database WHERE datname = 'india_rental_dev';

-- If it doesn't exist, create it:
CREATE DATABASE india_rental_dev;

-- Grant all privileges to sridattag
GRANT ALL PRIVILEGES ON DATABASE india_rental_dev TO sridattag;

-- Connect to india_rental_dev and grant schema privileges
\c india_rental_dev

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO sridattag;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sridattag;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sridattag;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sridattag;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sridattag;

-- Verify the database and tables exist
\l india_rental_dev
\dt