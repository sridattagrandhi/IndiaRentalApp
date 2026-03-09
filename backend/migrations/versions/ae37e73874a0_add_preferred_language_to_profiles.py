"""add preferred_language to profiles

Revision ID: ae37e73874a0
Revises: 0b5c7b7e9a46
Create Date: 2026-01-01 16:08:28.852884

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ae37e73874a0'
down_revision: Union[str, Sequence[str], None] = '0b5c7b7e9a46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Store the user's preferred UI language (used by Accept-Language and UI)
    # Keep it small + stable. Default to English.
    op.execute("""
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(8) NOT NULL DEFAULT 'en';
    """)

    # Optional index (useful if you ever segment users by language)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_profiles_preferred_language
        ON profiles (preferred_language);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_profiles_preferred_language;")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_language;")
