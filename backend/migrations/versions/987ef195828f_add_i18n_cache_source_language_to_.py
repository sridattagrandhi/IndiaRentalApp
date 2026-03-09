"""add i18n cache + source_language to listings

Revision ID: 987ef195828f
Revises: ae37e73874a0
"""

from typing import Sequence, Union

from alembic import op

revision: str = "987ef195828f"
down_revision: Union[str, Sequence[str], None] = "ae37e73874a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS source_language VARCHAR(16);
    """)
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
    """)
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS i18n_updated_at TIMESTAMP NOT NULL DEFAULT NOW();
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_listings_source_language
        ON listings (source_language);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_listings_source_language;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS i18n_updated_at;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS i18n;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS source_language;")
