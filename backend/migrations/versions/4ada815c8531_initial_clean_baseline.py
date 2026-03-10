"""initial clean baseline (models-aligned)

Revision ID: 4ada815c8531
Revises:
Create Date: 2025-11-11 15:28:20.729760
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "4ada815c8531"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------
    # USERS
    # -----------------
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("cognito_sub", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_cognito_sub", "users", ["cognito_sub"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    # -----------------
    # PROFILES (1–1 with users)
    # -----------------
    op.create_table(
        "profiles",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("full_name", sa.Text(), nullable=True),
        sa.Column("birthdate", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(length=32), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=True),
        sa.Column("pincode", sa.String(length=12), nullable=True),
        sa.Column("country", sa.String(length=64), nullable=True),  # match models
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    # -----------------
    # LISTINGS (exactly as in models)
    # -----------------
    op.create_table(
        "listings",
        sa.Column("id", sa.Integer, primary_key=True),                   # Integer PK
        sa.Column("title", sa.String(), nullable=False),

        sa.Column("street", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=True),

        sa.Column("latitude", sa.Float(), nullable=True),                # nullable in models
        sa.Column("longitude", sa.Float(), nullable=True),

        sa.Column("price", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("rating", sa.Float(), nullable=False, server_default=sa.text("0")),

        sa.Column("photo_url", sa.String(), nullable=True),
        sa.Column("images", sa.JSON(), nullable=True),                   # JSON (not ARRAY)
        sa.Column("amenities", sa.JSON(), nullable=True),                # JSON (not ARRAY)

        sa.Column("building_key", sa.String(), nullable=True),
        sa.Column("building_label", sa.String(), nullable=True),
        sa.Column("unit_name", sa.String(), nullable=True),

        sa.Column("host_user_id", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(["host_user_id"], ["users.id"], ondelete="SET NULL"),

        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),

        sa.Column("status", sa.String(length=16), nullable=False, server_default="live"),
    )

    # helpful indexes (match models)
    op.create_index("ix_listings_city", "listings", ["city"], unique=False)
    op.create_index("ix_listings_street", "listings", ["street"], unique=False)
    op.create_index("ix_listings_host_user_id", "listings", ["host_user_id"], unique=False)
    op.create_index("ix_listings_building_city", "listings", ["building_key", "city"], unique=False)
    op.create_index("ix_listings_status", "listings", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_listings_status", table_name="listings")
    op.drop_index("ix_listings_building_city", table_name="listings")
    op.drop_index("ix_listings_host_user_id", table_name="listings")
    op.drop_index("ix_listings_street", table_name="listings")
    op.drop_index("ix_listings_city", table_name="listings")
    op.drop_table("listings")

    op.drop_table("profiles")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_cognito_sub", table_name="users")
    op.drop_table("users")
