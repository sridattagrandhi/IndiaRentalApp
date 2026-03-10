# functions/ws/handler.py
import json
import os
import time
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from common.db import SessionLocal
from common.models import UserORM

dynamodb = boto3.resource("dynamodb")

CONNECTIONS_TABLE = os.environ["CHAT_CONNECTIONS_TABLE"]
connections_table = dynamodb.Table(CONNECTIONS_TABLE)


def _resp(status: int, body: Any = None):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": "" if body is None else json.dumps(body),
    }


def _get_user_id(event) -> str:
    """
    Preferred (production): WS authorizer -> requestContext.authorizer.{principalId|jwt.claims}
    MVP fallback: client passes ?user_id=...
    """
    rc = event.get("requestContext") or {}
    auth = rc.get("authorizer") or {}

    principal = auth.get("principalId")
    if principal:
        print(f"✅ Found principalId: {principal}")
        return str(principal)

    claims = auth.get("jwt", {}).get("claims") or auth.get("claims") or {}
    for k in ["custom:user_id", "sub", "email", "cognito:username", "username"]:
        v = claims.get(k)
        if v:
            print(f"✅ Found claim {k}: {v}")
            return str(v)

    qs = event.get("queryStringParameters") or {}
    user_id = (qs.get("user_id") or "").strip()
    if user_id:
        print(f"✅ Found user_id in query string: {user_id}")
        return user_id

    print("❌ ERROR: No user identity found in event")
    print(f"Event: {json.dumps(event, indent=2)}")
    raise ValueError("Unauthorized: missing user identity")

def _sub_to_db_user_id(sub: str) -> str:
    db = SessionLocal()
    try:
        user = db.query(UserORM).filter(UserORM.cognito_sub == sub).one_or_none()
        if not user:
            # If user doesn't exist yet, create it (same behavior as profile)
            user = UserORM(cognito_sub=sub)
            db.add(user)
            db.flush()
            db.commit()
        return str(user.id)
    finally:
        db.close()


def connect(event, context):
    try:
        connection_id = event["requestContext"]["connectionId"]
        print(f"🔌 WS Connect attempt - connection_id: {connection_id}")
        
        sub = _get_user_id(event)          # this returns sub/email/etc today
        user_id = _sub_to_db_user_id(sub)  # convert to DB UUID 
        print(f"✅ User authenticated: {user_id}")

        ttl = int(time.time()) + 2 * 60 * 60  # 2 hours

        print(f"💾 Writing to DynamoDB table: {CONNECTIONS_TABLE}")
        connections_table.put_item(
            Item={
                "user_id": str(user_id),
                "connection_id": str(connection_id),
                "connected_at": int(time.time()),
                "ttl": ttl,
            }
        )
        print(f"✅ Successfully stored connection for user {user_id}")

        # Accept connection
        return _resp(200, {"ok": True, "message": "Connected"})
    except ValueError as e:
        print(f"❌ Auth error: {str(e)}")
        return _resp(401, {"error": str(e)})
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        print(f"Event: {json.dumps(event, indent=2)}")
        return _resp(500, {"error": str(e)})


def disconnect(event, context):
    """
    Delete connection rows using the GSI (connection-index).
    Handles pagination.
    """
    connection_id = str(event["requestContext"]["connectionId"])
    print(f"🔌 WS Disconnect - connection_id: {connection_id}")

    try:
        start_key = None
        deleted_count = 0
        
        while True:
            kwargs = {
                "IndexName": "connection-index",
                "KeyConditionExpression": Key("connection_id").eq(connection_id),
            }
            if start_key:
                kwargs["ExclusiveStartKey"] = start_key

            res = connections_table.query(**kwargs)

            for item in res.get("Items", []):
                connections_table.delete_item(
                    Key={
                        "user_id": item["user_id"],
                        "connection_id": item["connection_id"],
                    }
                )
                deleted_count += 1
                print(f"🗑️  Deleted connection for user: {item['user_id']}")

            start_key = res.get("LastEvaluatedKey")
            if not start_key:
                break

        print(f"✅ Disconnected successfully (deleted {deleted_count} records)")
        return _resp(200)
    except Exception as e:
        print(f"❌ Disconnect error: {str(e)}")
        # Don't fail disconnect
        return _resp(200)


def ping(event, context):
    print("🏓 Ping received")
    return _resp(200, {"type": "pong", "timestamp": int(time.time())})


def default(event, context):
    print(f"📨 Default route - event: {json.dumps(event)}")
    # Later: typing events, read receipts, etc.
    return _resp(200, {"message": "Message received"})