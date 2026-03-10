"""add offers, times, reviews

Revision ID: 06d11c9e4fd9
Revises: 49bceed21a7f
Create Date: 2025-11-22 18:00:49.966627

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "06d11c9e4fd9"   # KEEP Alembic's value
down_revision: Union[str, None] = "49bceed21a7f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- listings extra columns ----
    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS offers JSON;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS check_in_time VARCHAR;
    """)

    op.execute("""
        ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS check_out_time VARCHAR;
    """)

    # ---- reviews table ----
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=False),
        sa.Column("guest_user_id", sa.String(length=36), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["listing_id"], ["listings.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["bookings.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["guest_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("booking_id", name="uq_reviews_booking_id"),
    )

    op.create_index(
        "ix_reviews_listing_id", "reviews", ["listing_id"], unique=False
    )
    op.create_index(
        "ix_reviews_guest_user_id", "reviews", ["guest_user_id"], unique=False
    )
    op.create_index(
        "ix_reviews_created_at", "reviews", ["created_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_reviews_created_at", table_name="reviews")
    op.drop_index("ix_reviews_guest_user_id", table_name="reviews")
    op.drop_index("ix_reviews_listing_id", table_name="reviews")
    op.drop_table("reviews")

    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS check_out_time;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS check_in_time;")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS offers;")
