"""add source_language to profiles

Revision ID: 86af8aa4db35
Revises: ca77012d14d0
Create Date: 2026-01-08 19:26:14.217532

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '86af8aa4db35'
down_revision: Union[str, Sequence[str], None] = 'ca77012d14d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
