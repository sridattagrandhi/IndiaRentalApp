import json
import os

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from common.db import \
    engine as get_engine  # ✅ uses SSL-configured pg8000 connection
from sqlalchemy import text


def _resp(status: int, body):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


def handler(event, context):
    expected = os.environ.get("MIGRATE_KEY", "")
    headers = event.get("headers") or {}
    got = headers.get("x-migrate-key") or headers.get("X-Migrate-Key") or ""

    if expected and got != expected:
        return _resp(401, {"ok": False, "error": "Unauthorized"})

    stage = os.environ.get("STAGE", os.environ.get("SLS_STAGE", "dev"))
    if stage != "dev":
        return _resp(403, {"ok": False, "error": f"Migrations disabled for stage={stage}"})

    try:
        cfg = Config("alembic.ini")

        eng = get_engine()
        with eng.connect() as conn:
            # ✅ prove DB connectivity inside VPC
            conn.execute(text("SELECT 1"))

            # ✅ force Alembic to use THIS connection (not alembic.ini url)
            cfg.attributes["connection"] = conn
            command.upgrade(cfg, "head")

            # ✅ prove what revision DB is on
            ctx = MigrationContext.configure(conn)
            current_rev = ctx.get_current_revision()

            # ✅ prove the column exists now
            has_source_language = conn.execute(
                text("""
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name='profiles' AND column_name='source_language'
                    LIMIT 1
                """)
            ).first() is not None

        return _resp(200, {
            "ok": True,
            "message": "alembic upgrade head completed",
            "current_rev": current_rev,
            "has_profiles_source_language": has_source_language,
        })

    except Exception as e:
        print("migrate error:", repr(e))
        return _resp(500, {"ok": False, "error": repr(e)})
