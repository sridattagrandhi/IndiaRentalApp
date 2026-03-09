"""add extended listing fields (idempotent)

Revision ID: 49bceed21a7f
Revises: 570e2f92b2bc
Create Date: 2025-11-14 13:13:28.921738
"""
from typing import Sequence, Union

from alembic import op

revision: str = "49bceed21a7f"
down_revision: Union[str, None] = "570e2f92b2bc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOTE: We use raw SQL with IF NOT EXISTS so this migration
    # can be applied even if some columns already exist.

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS location VARCHAR;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS max_guests INTEGER NOT NULL DEFAULT 1;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS description TEXT;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'live';
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS images JSON;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS rules JSON;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS building_label VARCHAR;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS building_key VARCHAR;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS unit_name VARCHAR;
    """)

    # Indexes – IF NOT EXISTS so we don't blow up if they were created earlier
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_listings_status
        ON listings (status);
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_listings_building_label
        ON listings (building_label);
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_listings_building_key
        ON listings (building_key);
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_listings_location
        ON listings (location);
    """)


def downgrade() -> None:
    # Drop indexes first (IF EXISTS so downgrade is also safe)
    op.execute("DROP INDEX IF EXISTS ix_listings_location;")
    op.execute("DROP INDEX IF EXISTS ix_listings_building_key;")
    op.execute("DROP INDEX IF EXISTS ix_listings_building_label;")
    op.execute("DROP INDEX IF EXISTS ix_listings_status;")

    # Then columns (also IF EXISTS so it won't error if something is missing)
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS unit_name;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS building_key;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS building_label;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS rules;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS images;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS status;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS description;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS max_guests;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS review_count;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS location;")
