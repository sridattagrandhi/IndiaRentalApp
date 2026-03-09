"""add wishlists

Revision ID: 8d99ae4f4168
Revises: 06d11c9e4fd9
Create Date: 2025-12-18 11:53:15.103575

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '8d99ae4f4168'
down_revision: Union[str, Sequence[str], None] = '06d11c9e4fd9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- wishlists ----
    op.create_table(
        "wishlists",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_image", sa.String(), nullable=True),
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
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
    )

    op.create_index(
        "ix_wishlists_user_id",
        "wishlists",
        ["user_id"],
        unique=False,
    )

    # ---- wishlist_items ----
    op.create_table(
        "wishlist_items",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("wishlist_id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["wishlist_id"],
            ["wishlists.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["listing_id"],
            ["listings.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "wishlist_id",
            "listing_id",
            name="uq_wishlist_items_wishlist_listing",
        ),
    )

    op.create_index(
        "ix_wishlist_items_wishlist_id",
        "wishlist_items",
        ["wishlist_id"],
        unique=False,
    )
    op.create_index(
        "ix_wishlist_items_listing_id",
        "wishlist_items",
        ["listing_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_wishlist_items_listing_id", table_name="wishlist_items")
    op.drop_index("ix_wishlist_items_wishlist_id", table_name="wishlist_items")
    op.drop_table("wishlist_items")

    op.drop_index("ix_wishlists_user_id", table_name="wishlists")
    op.drop_table("wishlists")