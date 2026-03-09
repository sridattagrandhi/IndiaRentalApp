"""add i18n cache to profiles

Revision ID: ca77012d14d0
Revises: 987ef195828f
Create Date: 2026-01-08 18:13:37.538515

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ca77012d14d0'
down_revision: Union[str, Sequence[str], None] = '987ef195828f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) preferred_language: migration created VARCHAR(8), model uses String(16)
    op.execute("""
        ALTER TABLE profiles
        ALTER COLUMN preferred_language TYPE VARCHAR(16);
    """)

    # 2) country: ensure it can store full country names (model uses String(64))
    # If your DB already has VARCHAR(64), this is harmless.
    op.execute("""
        ALTER TABLE profiles
        ALTER COLUMN country TYPE VARCHAR(64);
    """)

    # 3) Ensure i18n columns exist (idempotent safety; no-op if already there)
    op.execute("""
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS source_language VARCHAR(16);
    """)
    op.execute("""
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
    """)
    op.execute("""
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS i18n_updated_at TIMESTAMP NOT NULL DEFAULT NOW();
    """)

    # Optional helpful indexes (safe)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_profiles_preferred_language
        ON profiles (preferred_language);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_profiles_source_language
        ON profiles (source_language);
    """)


def downgrade() -> None:
    # Downgrade types back to smaller sizes (only if you really want rollback).
    # Note: shrinking can fail if data doesn't fit.
    op.execute("DROP INDEX IF EXISTS ix_profiles_source_language;")
    op.execute("DROP INDEX IF EXISTS ix_profiles_preferred_language;")

    op.execute("""
        ALTER TABLE profiles
        ALTER COLUMN preferred_language TYPE VARCHAR(8);
    """)
    op.execute("""
        ALTER TABLE profiles
        ALTER COLUMN country TYPE VARCHAR(8);
    """)
