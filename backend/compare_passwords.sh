#!/bin/bash
# Compare passwords and find discrepancies

echo "=== Password Comparison Tool ==="
echo ""

# Extract password from .env
if [ -f .env ]; then
    ENV_URL=$(grep "DATABASE_URL=" .env | cut -d'=' -f2-)
    ENV_PASS=$(echo "$ENV_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    echo "📄 .env DATABASE_URL password:"
    echo "  Length: ${#ENV_PASS} characters"
    echo "  First 3 chars: ${ENV_PASS:0:3}..."
    echo "  Last 3 chars: ...${ENV_PASS: -3}"
    
    # Check for special characters
    if echo "$ENV_PASS" | grep -q '[^a-zA-Z0-9]'; then
        echo "  ⚠️  Contains special characters!"
        echo "  Needs URL encoding: $(python3 -c "from urllib.parse import quote_plus; print(quote_plus('$ENV_PASS'))")"
    else
        echo "  ✅ Only alphanumeric (no encoding needed)"
    fi
    
    # Check for whitespace
    if echo "$ENV_PASS" | grep -q '[[:space:]]'; then
        echo "  ❌ Contains whitespace! This will cause auth failures!"
    fi
else
    echo "❌ .env file not found"
    exit 1
fi

echo ""

# Extract password from alembic.ini
if [ -f alembic.ini ]; then
    ALEMBIC_URL=$(grep "^sqlalchemy.url" alembic.ini | cut -d'=' -f2- | xargs)
    ALEMBIC_PASS=$(echo "$ALEMBIC_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    echo "📄 alembic.ini password:"
    echo "  Length: ${#ALEMBIC_PASS} characters"
    echo "  First 3 chars: ${ALEMBIC_PASS:0:3}..."
    echo "  Last 3 chars: ...${ALEMBIC_PASS: -3}"
else
    echo "⚠️  alembic.ini not found"
fi

echo ""
echo "=== Comparison ==="
if [ "$ENV_PASS" = "$ALEMBIC_PASS" ]; then
    echo "✅ Passwords match!"
else
    echo "❌ PASSWORDS DO NOT MATCH!"
    echo ""
    echo "This explains why migrations work but Lambda doesn't!"
    echo "Your Lambda uses .env, but migrations use alembic.ini"
fi

echo ""
echo "=== Testing with Python/SQLAlchemy ==="
python3 << 'PYEOF'
import os
from urllib.parse import urlparse, unquote

# Load .env
with open('.env') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            url = line.split('=', 1)[1].strip()
            break

parsed = urlparse(url)
print(f"Parsed URL:")
print(f"  Scheme: {parsed.scheme}")
print(f"  Username: {parsed.username}")
print(f"  Password (decoded): {unquote(parsed.password)}")
print(f"  Password (raw): {parsed.password}")
print(f"  Host: {parsed.hostname}")
print(f"  Port: {parsed.port}")
print(f"  Database: {parsed.path.lstrip('/')}")

if parsed.password != unquote(parsed.password):
    print(f"\n⚠️  Password is URL-encoded in DATABASE_URL")
    print(f"  This is correct if your actual password contains special characters")
else:
    print(f"\n✅ Password is not URL-encoded")
PYEOF

echo ""
echo "=== Next Steps ==="
echo "1. Verify you can connect with psql using india_rental_dev:"
echo "   psql \"host=database-1.cluster-ch0siyuuywgg.ap-south-1.rds.amazonaws.com port=5432 dbname=india_rental_dev user=sridattag sslmode=require\" -W"
echo ""
echo "2. If that works, copy the EXACT password (the one that works) into your .env:"
echo "   DATABASE_URL=postgresql+pg8000://sridattag:YOUR_ACTUAL_PASSWORD@database-1.cluster-ch0siyuuywgg.ap-south-1.rds.amazonaws.com:5432/india_rental_dev"
echo ""
echo "3. Test locally:"
echo "   python3 test_db_connection.py"
echo ""
echo "4. Deploy:"
echo "   sls deploy"