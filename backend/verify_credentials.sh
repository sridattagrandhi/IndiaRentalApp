#!/bin/bash
# Verify database credentials work

echo "=== Database Credentials Verification ==="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Loaded .env file"
else
    echo "❌ No .env file found"
    exit 1
fi

# Parse DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    # Extract components
    PROTOCOL=$(echo $DATABASE_URL | grep -oP '^[^:]+')
    USER=$(echo $DATABASE_URL | grep -oP '://\K[^:]+')
    PASS=$(echo $DATABASE_URL | grep -oP ':[^@]+@' | sed 's/://;s/@//')
    HOST=$(echo $DATABASE_URL | grep -oP '@\K[^:]+')
    PORT=$(echo $DATABASE_URL | grep -oP ':[0-9]+/' | sed 's/://;s/\///')
    DB=$(echo $DATABASE_URL | grep -oP '/[^?]+$' | sed 's/\///')
    
    echo "📊 Parsed DATABASE_URL:"
    echo "  Protocol: $PROTOCOL"
    echo "  User: $USER"
    echo "  Password length: ${#PASS} characters"
    echo "  Host: $HOST"
    echo "  Port: $PORT"
    echo "  Database: $DB"
    echo ""
else
    echo "❌ DATABASE_URL not set in .env"
    exit 1
fi

# Test with psql if available
if command -v psql &> /dev/null; then
    echo "🔍 Testing connection with psql..."
    echo ""
    
    # Test connection (will prompt for password verification)
    PGPASSWORD="$PASS" psql -h "$HOST" -U "$USER" -d "$DB" -p "${PORT:-5432}" -c "SELECT version();" 2>&1
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ psql connection successful! Credentials are correct."
        echo ""
        echo "This means the issue is with how the password is being passed in DATABASE_URL."
        echo "The password might need URL encoding."
    else
        echo ""
        echo "❌ psql connection failed!"
        echo ""
        echo "This confirms the password in your .env is incorrect."
        echo "Please update the password in your .env file."
    fi
else
    echo "⚠️  psql not installed, cannot test connection directly"
    echo ""
    echo "Install with: brew install postgresql (macOS) or apt-get install postgresql-client (Linux)"
fi

echo ""
echo "=== Password encoding check ==="
echo "Your password contains these character types:"
if echo "$PASS" | grep -q '[^a-zA-Z0-9]'; then
    echo "  ⚠️  SPECIAL CHARACTERS DETECTED"
    echo "  Special characters need to be URL-encoded in DATABASE_URL"
    echo ""
    echo "  Current password: $PASS"
    echo "  Run this to get encoded version:"
    echo "  python3 -c \"from urllib.parse import quote_plus; print(quote_plus('$PASS'))\""
else
    echo "  ✅ Only alphanumeric characters (no encoding needed)"
fi