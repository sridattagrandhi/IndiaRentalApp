"""add hotel room types to booking

Revision ID: c2062e7b4b22
Revises: ac49d3ccc098
Create Date: 2026-03-08 13:05:49.917234

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c2062e7b4b22'
down_revision: Union[str, Sequence[str], None] = 'ac49d3ccc098'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE bookings
            ADD COLUMN IF NOT EXISTS room_type_id INTEGER
                REFERENCES hotel_room_types(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS room_type_name VARCHAR(120) NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_bookings_room_type_id
        ON bookings (room_type_id);
    """)

def downgrade() -> None:
    op.execute("ALTER TABLE bookings DROP COLUMN IF EXISTS room_type_id;")
    op.execute("ALTER TABLE bookings DROP COLUMN IF EXISTS room_type_name;")
