"""add bookings

Revision ID: 570e2f92b2bc
Revises: 4ada815c8531
Create Date: 2025-11-13 14:17:40.577158

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# NOTE:
# If you paste this into the file Alembic generated for you,
# KEEP the revision id it generated and just adjust down_revision.
revision: str = "570e2f92b2bc"           # or keep Alembic's value
down_revision: Union[str, Sequence[str], None] = "4ada815c8531"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------
    # BOOKINGS
    # -----------------
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("booking_code", sa.String(length=16), nullable=False),
        # Foreign keys
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("host_user_id", sa.String(length=36), nullable=False),
        sa.Column("guest_user_id", sa.String(length=36), nullable=False),
        # Booking details
        sa.Column("check_in", sa.Date(), nullable=False),
        sa.Column("check_out", sa.Date(), nullable=False),
        sa.Column("guests", sa.Integer(), nullable=False, server_default="1"),
        # Pricing
        sa.Column("total_paid", sa.Float(), nullable=False),
        sa.Column("payout_amount", sa.Float(), nullable=True),
        # Status
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="pending",
        ),
        # Guest info (cached)
        sa.Column("guest_name", sa.String(length=100), nullable=True),
        sa.Column("guest_email", sa.String(length=255), nullable=True),
        sa.Column("guest_phone", sa.String(length=20), nullable=True),
        # Listing info (cached)
        sa.Column("listing_name", sa.String(length=255), nullable=True),
        # Timestamps
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
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        # Cancellation + extra
        sa.Column("cancelled_by", sa.String(length=36), nullable=True),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        sa.Column("special_requests", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # Constraints
        sa.ForeignKeyConstraint(
            ["listing_id"], ["listings.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["host_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["guest_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["cancelled_by"], ["users.id"]),
        sa.UniqueConstraint(
            "booking_code", name="uq_bookings_booking_code"
        ),
        sa.CheckConstraint(
            "check_out > check_in", name="check_valid_dates"
        ),
        sa.CheckConstraint(
            "guests > 0", name="check_positive_guests"
        ),
        sa.CheckConstraint(
            "total_paid >= 0", name="check_positive_amount"
        ),
    )

    # ---- Indexes (match your SQL + BookingORM index flags) ----
    op.create_index(
        "ix_bookings_booking_code",
        "bookings",
        ["booking_code"],
        unique=False,
    )
    op.create_index(
        "ix_bookings_listing_id",
        "bookings",
        ["listing_id"],
        unique=False,
    )
    op.create_index(
        "ix_bookings_host_user_id",
        "bookings",
        ["host_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_bookings_guest_user_id",
        "bookings",
        ["guest_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_bookings_check_in",
        "bookings",
        ["check_in"],
        unique=False,
    )
    op.create_index(
        "ix_bookings_check_out",
        "bookings",
        ["check_out"],
        unique=False,
    )
    op.create_index(
        "ix_bookings_status",
        "bookings",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_bookings_created_at",
        "bookings",
        ["created_at"],
        unique=False,
    )

    # Composite partial index for overlap queries:
    # WHERE status IN ('pending','confirmed')
    op.create_index(
        "ix_bookings_listing_dates",
        "bookings",
        ["listing_id", "check_in", "check_out"],
        unique=False,
        postgresql_where=sa.text("status IN ('pending','confirmed')"),
    )


def downgrade() -> None:
    # Drop indexes first (reverse order is safest)
    op.drop_index("ix_bookings_listing_dates", table_name="bookings")
    op.drop_index("ix_bookings_created_at", table_name="bookings")
    op.drop_index("ix_bookings_status", table_name="bookings")
    op.drop_index("ix_bookings_check_out", table_name="bookings")
    op.drop_index("ix_bookings_check_in", table_name="bookings")
    op.drop_index("ix_bookings_guest_user_id", table_name="bookings")
    op.drop_index("ix_bookings_host_user_id", table_name="bookings")
    op.drop_index("ix_bookings_listing_id", table_name="bookings")
    op.drop_index("ix_bookings_booking_code", table_name="bookings")

    # Then drop table
    op.drop_table("bookings")
