"""add translation caching to reviews

Revision ID: 9a04a0aaf6a0
Revises: 1b1ce16eef2b
Create Date: 2026-01-26 15:46:31.011965

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9a04a0aaf6a0'
down_revision: Union[str, Sequence[str], None] = '1b1ce16eef2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE reviews
        ADD COLUMN IF NOT EXISTS source_language VARCHAR(16);
    """)
    op.execute("""
        ALTER TABLE reviews
        ADD COLUMN IF NOT EXISTS i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_reviews_source_language
        ON reviews (source_language);
    """)

def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_reviews_source_language;")
    op.execute("ALTER TABLE reviews DROP COLUMN IF EXISTS i18n;")
    op.execute("ALTER TABLE reviews DROP COLUMN IF EXISTS source_language;")

