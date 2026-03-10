#!/bin/bash
# Check if india_rental_dev database exists and has tables

echo "=== Checking RDS Database ==="
echo ""

# Connection details
HOST="database-1.cluster-ch0siyuuywgg.ap-south-1.rds.amazonaws.com"
PORT="5432"
USER="sridattag"

echo "Connecting to postgres database to check for india_rental_dev..."
echo ""

# List all databases
echo "📊 All databases:"
psql "host=$HOST port=$PORT dbname=postgres user=$USER sslmode=require" -c "\l" -W

echo ""
echo "🔍 Checking if india_rental_dev exists:"
DB_EXISTS=$(psql "host=$HOST port=$PORT dbname=postgres user=$USER sslmode=require" -t -c "SELECT 1 FROM pg_database WHERE datname = 'india_rental_dev';" -W 2>/dev/null | xargs)

if [ "$DB_EXISTS" = "1" ]; then
    echo "✅ Database 'india_rental_dev' EXISTS"
    echo ""
    echo "📋 Tables in india_rental_dev:"
    psql "host=$HOST port=$PORT dbname=india_rental_dev user=$USER sslmode=require" -c "\dt" -W
    
    echo ""
    echo "👥 Checking users table:"
    psql "host=$HOST port=$PORT dbname=india_rental_dev user=$USER sslmode=require" -c "SELECT COUNT(*) as user_count FROM users;" -W 2>&1
    
    echo ""
    echo "🏠 Checking listings table:"
    psql "host=$HOST port=$PORT dbname=india_rental_dev user=$USER sslmode=require" -c "SELECT COUNT(*) as listing_count FROM listings;" -W 2>&1
else
    echo "❌ Database 'india_rental_dev' DOES NOT EXIST"
    echo ""
    echo "You need to create it. Run:"
    echo "  psql \"host=$HOST port=$PORT dbname=postgres user=$USER sslmode=require\" -W"
    echo ""
    echo "Then execute:"
    echo "  CREATE DATABASE india_rental_dev;"
    echo "  GRANT ALL PRIVILEGES ON DATABASE india_rental_dev TO sridattag;"
fi

echo ""
echo "=== Recommendation ==="
echo "If the database doesn't exist or is empty:"
echo "  1. Create the database (see above)"
echo "  2. Run migrations: alembic upgrade head"
echo "  3. Deploy: sls deploy"
echo "  4. Test: curl https://<api-id>.execute-api.ap-south-1.amazonaws.com/v1/listings"