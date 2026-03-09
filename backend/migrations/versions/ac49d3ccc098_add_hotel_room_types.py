"""add hotel room types

Revision ID: ac49d3ccc098
Revises: 9a04a0aaf6a0
Create Date: 2026-02-15 10:49:26.526807

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ac49d3ccc098'
down_revision: Union[str, Sequence[str], None] = '9a04a0aaf6a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hotel_room_types (
            id SERIAL PRIMARY KEY,
            listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            floor INTEGER NULL,
            description TEXT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            price DOUBLE PRECISION NULL,
            max_guests INTEGER NOT NULL DEFAULT 2,
            bedrooms INTEGER NULL,
            bathrooms INTEGER NULL,
            beds INTEGER NULL,
            amenities JSONB NULL,
            photos JSONB NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        );
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_hotel_room_types_listing_id
        ON hotel_room_types (listing_id);
        """
    )



def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS hotel_room_types;")
