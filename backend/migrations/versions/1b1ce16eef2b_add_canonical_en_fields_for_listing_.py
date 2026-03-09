"""add canonical EN fields for listing search

Revision ID: 1b1ce16eef2b
Revises: 86af8aa4db35
Create Date: 2026-01-12 16:26:37.820044

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '1b1ce16eef2b'
down_revision: Union[str, Sequence[str], None] = '86af8aa4db35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Fast fuzzy search support
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    op.add_column("listings", sa.Column("title_en", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("location_en", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("street_en", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("city_en", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("state_en", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("description_en", sa.Text(), nullable=True))

    # Trigram indexes for query speed
    op.execute("CREATE INDEX IF NOT EXISTS ix_listings_title_en_trgm ON listings USING gin (lower(title_en) gin_trgm_ops);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_listings_city_en_trgm ON listings USING gin (lower(city_en) gin_trgm_ops);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_listings_street_en_trgm ON listings USING gin (lower(street_en) gin_trgm_ops);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_listings_location_en_trgm ON listings USING gin (lower(location_en) gin_trgm_ops);")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_listings_location_en_trgm;")
    op.execute("DROP INDEX IF EXISTS ix_listings_street_en_trgm;")
    op.execute("DROP INDEX IF EXISTS ix_listings_city_en_trgm;")
    op.execute("DROP INDEX IF EXISTS ix_listings_title_en_trgm;")

    op.drop_column("listings", "description_en")
    op.drop_column("listings", "state_en")
    op.drop_column("listings", "city_en")
    op.drop_column("listings", "street_en")
    op.drop_column("listings", "location_en")
    op.drop_column("listings", "title_en")
