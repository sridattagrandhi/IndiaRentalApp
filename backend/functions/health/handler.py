# functions/health/handler.py
import json
import os
import socket

import boto3
import botocore
from common.db import session
from common.i18n import SUPPORTED_LANGS, get_requested_lang  # ✅ ADD THIS
from common.models import ListingORM  # ✅ ADD THIS
from common.translate import translate_text
from sqlalchemy import text

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Language",  # ✅ ADD
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
}

def _resp(body, status=200):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, default=str)}


def health(event, _ctx):
    """Basic health check"""
    return _resp({"status": "ok", "service": "india-rental-api"})


def health_db(event, _ctx):
    """Database connectivity check"""
    try:
        with session() as db:
            val = db.execute(text("SELECT 1")).scalar()
        return _resp({"ok": True, "select1": val})
    except Exception as e:
        print("Health DB error:", repr(e))
        return _resp({"ok": False, "error": str(e)}, 500)


def debug_env(event, _ctx):
    """Debug endpoint to check environment variables (REMOVE IN PRODUCTION!)"""
    db_url = os.environ.get("DATABASE_URL", "NOT_SET")
    
    # Mask the password in the URL
    if db_url and db_url != "NOT_SET":
        try:
            from sqlalchemy.engine import make_url
            u = make_url(db_url)
            
            # Show password length for debugging
            password_info = f"length={len(u.password)}" if u.password else "NOT_SET"
            
            masked_url = f"{u.drivername}://{u.username}:{password_info}@{u.host}:{u.port}/{u.database}"
        except Exception as e:
            masked_url = f"ERROR_PARSING_URL: {str(e)}"
    else:
        masked_url = "NOT_SET"
    
    return _resp({
        "DATABASE_URL": masked_url,
        "DB_USER": os.environ.get("DB_USER", "NOT_SET"),
        "DB_HOST": os.environ.get("DB_HOST", "NOT_SET"),
        "DB_NAME": os.environ.get("DB_NAME", "NOT_SET"),
        "DB_DRIVER": os.environ.get("DB_DRIVER", "NOT_SET"),
        "COGNITO_USER_POOL_ID": os.environ.get("COGNITO_USER_POOL_ID", "NOT_SET"),
        "python_version": os.sys.version,
        "working_directory": os.getcwd(),
        "cert_exists": os.path.exists("/opt/rds-combined-ca-bundle.pem"),
        "AWS_REGION": os.environ.get("AWS_REGION", "NOT_SET"),
        "AWS_DEFAULT_REGION": os.environ.get("AWS_DEFAULT_REGION", "NOT_SET"),
    })


def debug_connection(event, _ctx):
    """Test database connection and show detailed error (REMOVE IN PRODUCTION!)"""
    import ssl
    import sys
    import traceback

    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url
    
    db_url = os.environ.get("DATABASE_URL", "NOT_SET")
    
    if db_url == "NOT_SET":
        return _resp({"error": "DATABASE_URL not set"}, 500)
    
    try:
        # Parse URL
        u = make_url(db_url)
        
        info = {
            "driver": u.drivername,
            "username": u.username,
            "host": u.host,
            "port": u.port,
            "database": u.database,
            "password_length": len(u.password) if u.password else 0,
            "cert_exists": os.path.exists("/opt/rds-combined-ca-bundle.pem"),
        }
        
        # Setup SSL context
        connect_args = {}
        if u.drivername.endswith("pg8000"):
            ctx = ssl.create_default_context()
            
            if os.path.exists("/opt/rds-combined-ca-bundle.pem"):
                ctx.load_verify_locations("/opt/rds-combined-ca-bundle.pem")
                info["cert_loaded"] = True
            else:
                info["cert_loaded"] = False
            
            connect_args["ssl_context"] = ctx
        
        # Try to connect
        engine = create_engine(db_url, connect_args=connect_args)
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.scalar()
            
            return _resp({
                "success": True,
                "connection_info": info,
                "postgres_version": version
            })
    
    except Exception as e:
        return _resp({
            "success": False,
            "connection_info": info if 'info' in locals() else {},
            "error_type": type(e).__name__,
            "error_message": str(e),
            "traceback": traceback.format_exc()
        }, 500)


def me(event, _ctx):
    """Return current user info from Cognito JWT"""
    claims = (event.get("requestContext", {})
                    .get("authorizer", {})
                    .get("jwt", {})
                    .get("claims", {}))
    
    return _resp({
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "claims": claims
    })


def debug_translation(event, _ctx):
    """Temporary debug endpoint to test translation - REMOVE IN PRODUCTION!"""
    import traceback

    # 1. Check headers
    headers = event.get("headers") or {}
    accept_lang = headers.get("Accept-Language") or headers.get("accept-language") or "NOT_FOUND"
    
    # 2. Test get_requested_lang
    try:
        lang = get_requested_lang(event)
        lang_error = None
    except Exception as e:
        lang = "ERROR"
        lang_error = str(e)
    
    # 3. Test AWS Translate
    translate_result = None
    translate_error = None
    try:
        translated, detected = translate_text("Spacious 3 bedroom apartment with balcony", lang if lang != "ERROR" else "hi")
        translate_result = {
            "input": "Spacious 3 bedroom apartment with balcony",
            "output": translated,
            "detected_lang": detected,
            "target_lang": lang if lang != "ERROR" else "hi"
        }
    except Exception as e:
        translate_error = {
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }
    
    # 4. Check database
    db_check = None
    try:
        with session() as db:
            row = db.get(ListingORM, 1)
            if row:
                db_check = {
                    "id": row.id,
                    "title": row.title,
                    "has_i18n_column": hasattr(row, "i18n"),
                    "i18n_value": row.i18n if hasattr(row, "i18n") else "NO_COLUMN",
                    "source_language": getattr(row, "source_language", "NO_COLUMN")
                }
            else:
                db_check = {"error": "Listing with id=1 not found"}
    except Exception as e:
        db_check = {
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }
    
    # 5. Check AWS credentials and region
    aws_info = {
        "AWS_REGION": os.environ.get("AWS_REGION", "NOT_SET"),
        "AWS_DEFAULT_REGION": os.environ.get("AWS_DEFAULT_REGION", "NOT_SET"),
    }
    
    # Try to get boto3 session info
    try:
        import boto3
        session_obj = boto3.session.Session()
        aws_info["boto3_region"] = session_obj.region_name
        aws_info["available_regions_translate"] = session_obj.get_available_regions("translate")
    except Exception as e:
        aws_info["boto3_error"] = str(e)
    
    return _resp({
        "step1_headers": {
            "all_header_keys": list(headers.keys()),
            "accept_language_value": accept_lang
        },
        "step2_parsed_lang": {
            "result": lang,
            "error": lang_error
        },
        "step3_translate": translate_result if translate_result else {"error": translate_error},
        "step4_database": db_check,
        "step5_aws_config": aws_info,
        "supported_langs": sorted(list(SUPPORTED_LANGS))
    })