"""add property_type to listings

Revision ID: 792c9a1373b9
Revises: e6e82bc22997
Create Date: 2025-12-25 14:42:14.145343

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '792c9a1373b9'
down_revision: Union[str, Sequence[str], None] = 'e6e82bc22997'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column (safe even if re-run)
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS property_type VARCHAR(16) NOT NULL DEFAULT 'home';
    """)

    # Index for fast filtering in search
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_listings_property_type
        ON listings (property_type);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_listings_property_type;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS property_type;")
