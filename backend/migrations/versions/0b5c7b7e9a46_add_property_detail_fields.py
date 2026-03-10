"""add property detail fields

Revision ID: 0b5c7b7e9a46
Revises: 792c9a1373b9
Create Date: 2025-12-30 12:27:04.069498

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0b5c7b7e9a46'
down_revision: Union[str, Sequence[str], None] = '792c9a1373b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add state, pincode, bedrooms, bathrooms, beds columns to listings table."""
    
    # Add state column with index
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS state VARCHAR;
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_listings_state
        ON listings (state);
    """)
    
    # Add pincode column with index
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS pincode VARCHAR(12);
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_listings_pincode
        ON listings (pincode);
    """)
    
    # Add property detail columns (bedrooms, bathrooms, beds)
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS bedrooms INTEGER NOT NULL DEFAULT 1;
    """)
    
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS bathrooms INTEGER NOT NULL DEFAULT 1;
    """)
    
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS beds INTEGER NOT NULL DEFAULT 1;
    """)


def downgrade() -> None:
    """Remove state, pincode, bedrooms, bathrooms, beds columns from listings table."""
    
    # Drop indexes first
    op.execute("DROP INDEX IF EXISTS ix_listings_pincode;")
    op.execute("DROP INDEX IF EXISTS ix_listings_state;")
    
    # Then drop columns
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS beds;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS bathrooms;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS bedrooms;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS pincode;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS state;")
