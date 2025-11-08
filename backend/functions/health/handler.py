# functions/health/handler.py  (add this alongside your existing health checks)

import json
import os
import traceback

from sqlalchemy import create_engine, text


def _ok(b, status=200):
    return {"statusCode": status, "headers": {"Content-Type":"application/json"}, "body": json.dumps(b)}

def health(event, _ctx):
    return _ok({"ok": True})

def me(event, _ctx):
    """
    Returns the Cognito-authenticated user's claims.
    API Gateway (HTTP API) puts them in requestContext.authorizer.jwt.claims
    """
    claims = (event.get("requestContext", {})
                   .get("authorizer", {})
                   .get("jwt", {})
                   .get("claims", {}))
    # You can map this to your own shape if you like:
    user = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "email_verified": claims.get("email_verified"),
        "username": claims.get("cognito:username"),
        "groups": claims.get("cognito:groups"),
    }
    return _ok({"user": user})

def db(event, context):
    url = os.environ.get("DATABASE_URL")
    try:
        eng = create_engine(url, pool_pre_ping=True, pool_recycle=300)
        with eng.begin() as cx:
            one = cx.execute(text("SELECT 1")).scalar()
        return {
            "statusCode": 200,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"ok": True, "select1": one})
        }
    except Exception as e:
        # Show the exact failure in CloudWatch
        print("DB ERROR:", e)
        print(traceback.format_exc())
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"ok": False, "error": str(e)})
        }
