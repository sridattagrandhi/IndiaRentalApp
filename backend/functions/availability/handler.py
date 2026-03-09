"""
Lambda handlers to manage per-listing availability using DynamoDB.

GET  /v1/listings/{listing_id}/availability
    Query params:
      - start_date (YYYY-MM-DD, optional)
      - end_date   (YYYY-MM-DD, optional)
    Returns: { "results": [ { "date", "status", "price", "guest_name" }, ... ] }

PUT  /v1/listings/{listing_id}/availability
    Body: { "dates": [ { "date": "YYYY-MM-DD", "status"?, "price"?, "guest_name"? }, ... ] }
"""

import json
import os
import traceback
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple

import boto3
from boto3.dynamodb.conditions import Key
from common.db import SessionLocal
from common.models import ListingORM, UserORM

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
}

DEBUG = os.environ.get("DEBUG_ERRORS", "false").lower() == "true"

TABLE_NAME = os.environ.get("AVAILABILITY_TABLE")

# Initialize DynamoDB resource
_dynamodb = None
_table = None

try:
    _dynamodb = boto3.resource("dynamodb")
    if TABLE_NAME:
        _table = _dynamodb.Table(TABLE_NAME)
        print(f"DynamoDB table initialized: {TABLE_NAME}")
    else:
        print("WARNING: AVAILABILITY_TABLE environment variable not set")
except Exception as e:
    print(f"ERROR initializing DynamoDB: {repr(e)}")


def _resp(body: Dict, status: int = 200) -> Dict:
    return {
        "statusCode": status,
        "headers": CORS,
        "body": json.dumps(body, default=str),
    }


def _get_sub_and_email(event) -> Tuple[Optional[str], Optional[str]]:
    try:
        claims = (
            event.get("requestContext", {})
            .get("authorizer", {})
            .get("jwt", {})
            .get("claims", {})
        )
        return claims.get("sub"), claims.get("email")
    except Exception as e:
        print(f"ERROR extracting claims: {repr(e)}")
        return None, None


def _get_or_create_user(db, sub: str, email: str) -> UserORM:
    user = db.query(UserORM).filter(UserORM.cognito_sub == sub).one_or_none()
    if not user:
        user = UserORM(cognito_sub=sub, email=email or f"{sub}@example.com")
        db.add(user)
        db.flush()
    return user


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception as e:
        print(f"ERROR parsing date '{s}': {repr(e)}")
        return None


def _date_range(start: date, end: date) -> List[date]:
    out = []
    cur = start
    while cur <= end:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def _format_guest_name(full_name: str) -> str:
    """Format guest name as 'FirstName L.' """
    if not full_name or not full_name.strip():
        return "Guest"
    
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0]
    
    # First name + Last initial
    first = parts[0]
    last_initial = parts[-1][0].upper() + "."
    return f"{first} {last_initial}"


# ----------------------------------------------------------
# GET /v1/listings/{listing_id}/availability
# ----------------------------------------------------------
def get_availability(event, _ctx):
    try:
        print(f"get_availability called with event: {json.dumps(event, default=str)}")
        
        if _table is None:
            print("ERROR: DynamoDB table not initialized")
            return _resp({"detail": "Availability table is not configured."}, 500)

        path = event.get("pathParameters") or {}
        listing_id = path.get("listing_id") or path.get("id")
        if not listing_id:
            return _resp({"detail": "Missing listing_id in path."}, 400)

        print(f"Processing availability for listing_id: {listing_id}")

        qs = event.get("queryStringParameters") or {}

        start = _parse_date(qs.get("start_date"))
        end = _parse_date(qs.get("end_date"))

        # Default to current month if not provided
        today = date.today()
        if not start:
            start = date(today.year, today.month, 1)
        if not end:
            # last day of month
            next_month = date(today.year, today.month + 1, 1) if today.month < 12 else date(today.year + 1, 1, 1)
            end = next_month - timedelta(days=1)

        if end < start:
            return _resp({"detail": "end_date must be >= start_date"}, 400)

        print(f"Date range: {start} to {end}")

        # Get the listing to know its base price
        base_price = 2200.0  # default
        try:
            with SessionLocal() as db:
                pk = int(listing_id) if str(listing_id).isdigit() else listing_id
                listing = db.get(ListingORM, pk)
                if not listing:
                    return _resp({"detail": "Listing not found"}, 404)
                base_price = float(listing.price or 2200.0)
                print(f"Listing found, base_price: {base_price}")
        except Exception as e:
            print(f"ERROR querying listing: {repr(e)}")
            traceback.print_exc()
            # Continue with default price

        # Fetch overrides from DynamoDB
        items = []
        try:
            print(f"Querying DynamoDB for listing_id={listing_id}, date range {start.isoformat()} to {end.isoformat()}")
            response = _table.query(
                KeyConditionExpression=Key("listing_id").eq(str(listing_id))
                & Key("date").between(start.isoformat(), end.isoformat())
            )
            items = response.get("Items", [])
            print(f"DynamoDB returned {len(items)} items")
        except Exception as e:
            print(f"ERROR querying DynamoDB: {repr(e)}")
            traceback.print_exc()
            return _resp(
                {"detail": str(e) if DEBUG else "Failed to load availability."},
                500,
            )

        by_date = {item["date"]: item for item in items}

        results = []
        for d in _date_range(start, end):
            iso = d.isoformat()
            item = by_date.get(iso)
            if item:
                result = {
                    "date": iso,
                    "status": item.get("status", "available"),
                    "price": float(item.get("price", base_price)),
                }
                # Add guest_name if it's a booking
                if item.get("guest_name"):
                    result["guest_name"] = item.get("guest_name")
                results.append(result)
            else:
                # default: available at base price
                results.append(
                    {
                        "date": iso,
                        "status": "available",
                        "price": base_price,
                    }
                )

        print(f"Returning {len(results)} availability records")
        return _resp({"results": results})

    except Exception as e:
        print(f"UNEXPECTED error in get_availability: {repr(e)}")
        traceback.print_exc()
        return _resp(
            {"detail": str(e) if DEBUG else "Internal error."},
            500,
        )


# ----------------------------------------------------------
# PUT /v1/listings/{listing_id}/availability
# ----------------------------------------------------------
def update_availability(event, _ctx):
    try:
        print(f"update_availability called with event: {json.dumps(event, default=str)}")
        
        if _table is None:
            print("ERROR: DynamoDB table not initialized")
            return _resp({"detail": "Availability table is not configured."}, 500)

        sub, email = _get_sub_and_email(event)
        if not sub:
            print("ERROR: No sub found in JWT claims")
            return _resp({"detail": "Unauthorized"}, 401)

        print(f"Authenticated user: sub={sub}, email={email}")

        path = event.get("pathParameters") or {}
        listing_id = path.get("listing_id") or path.get("id")
        if not listing_id:
            return _resp({"detail": "Missing listing_id in path."}, 400)

        print(f"Processing update for listing_id: {listing_id}")

        try:
            body = json.loads(event.get("body") or "{}")
        except Exception as e:
            print(f"ERROR parsing JSON body: {repr(e)}")
            return _resp({"detail": "Invalid JSON body"}, 400)

        dates: List[Dict] = body.get("dates") or []
        if not isinstance(dates, list) or not dates:
            return _resp(
                {"detail": "Body must contain a non-empty 'dates' array."}, 400
            )

        print(f"Received {len(dates)} dates to update")

        # Verify the listing belongs to the current user
        try:
            with SessionLocal() as db:
                user = _get_or_create_user(db, sub, email)
                print(f"User ID: {user.id}")

                pk = int(listing_id) if str(listing_id).isdigit() else listing_id
                listing = db.get(ListingORM, pk)
                if not listing:
                    print(f"ERROR: Listing {listing_id} not found")
                    return _resp({"detail": "Listing not found"}, 404)

                print(f"Listing host_user_id: {listing.host_user_id}, current user_id: {user.id}")

                # Only host can edit
                if listing.host_user_id and listing.host_user_id != user.id:
                    print(f"ERROR: User {user.id} is not the host of listing {listing_id}")
                    return _resp({"detail": "Forbidden"}, 403)
        except Exception as e:
            print(f"ERROR verifying listing ownership: {repr(e)}")
            traceback.print_exc()
            return _resp(
                {"detail": str(e) if DEBUG else "Failed to verify listing ownership."},
                500,
            )

        # Apply updates into DynamoDB
        updated_count = 0
        for entry in dates:
            d = entry.get("date")
            if not d:
                print(f"WARNING: Skipping entry without date: {entry}")
                continue

            # Default to 'blocked' if no status provided (for backward compatibility)
            status = entry.get("status")
            if status is None and entry.get("price") is None:
                status = "blocked"
            elif status is None:
                status = "available"  # If only price is being updated

            item = {
                "listing_id": str(listing_id),
                "date": d,
                "status": status,
            }

            # Add price if provided
            if entry.get("price") is not None:
                raw_price = entry.get("price")
                try:
                    # DynamoDB requires Decimal, not float
                    item["price"] = Decimal(str(raw_price))
                except (InvalidOperation, TypeError) as e:
                    print(f"ERROR: Invalid price for date {d}: {repr(e)}")
                    return _resp(
                        {"detail": f"Invalid price for date {d}"},
                        400,
                    )

            # Add guest_name if provided (for bookings)
            if entry.get("guest_name"):
                guest_name = entry.get("guest_name").strip()
                if guest_name:
                    item["guest_name"] = _format_guest_name(guest_name)

            try:
                print(f"Writing to DynamoDB: {item}")
                _table.put_item(Item=item)
                updated_count += 1
            except Exception as e:
                print(f"ERROR writing to DynamoDB: {repr(e)}")
                traceback.print_exc()
                return _resp(
                    {
                        "detail": str(e)
                        if DEBUG
                        else "Failed to update availability."
                    },
                    500,
                )

        print(f"Successfully updated {updated_count} dates")
        return _resp({"ok": True, "updated": updated_count})

    except Exception as e:
        print(f"UNEXPECTED error in update_availability: {repr(e)}")
        traceback.print_exc()
        return _resp(
            {"detail": str(e) if DEBUG else "Internal error."},
            500,
        )