"""adding my trips tab in booking

Revision ID: 02ff41f7010c
Revises: 8d99ae4f4168
Create Date: 2025-12-18 15:12:29.589960

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '02ff41f7010c'
down_revision: Union[str, Sequence[str], None] = '8d99ae4f4168'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "trip_lists",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_image", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_trip_lists_user_id", "trip_lists", ["user_id"], unique=False)

    op.create_table(
        "trip_list_items",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("trip_list_id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["trip_list_id"], ["trip_lists.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("trip_list_id", "listing_id", name="uq_trip_list_items_trip_listing"),
    )
    op.create_index("ix_trip_list_items_trip_list_id", "trip_list_items", ["trip_list_id"], unique=False)
    op.create_index("ix_trip_list_items_listing_id", "trip_list_items", ["listing_id"], unique=False)

def downgrade():
    op.drop_index("ix_trip_list_items_listing_id", table_name="trip_list_items")
    op.drop_index("ix_trip_list_items_trip_list_id", table_name="trip_list_items")
    op.drop_table("trip_list_items")

    op.drop_index("ix_trip_lists_user_id", table_name="trip_lists")
    op.drop_table("trip_lists")