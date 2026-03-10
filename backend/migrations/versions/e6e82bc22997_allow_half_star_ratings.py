"""allow half star ratings

Revision ID: e6e82bc22997
Revises: 02ff41f7010c
Create Date: 2025-12-24 17:28:37.121027

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e6e82bc22997'
down_revision: Union[str, Sequence[str], None] = '02ff41f7010c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.execute("""
        ALTER TABLE reviews
        ALTER COLUMN rating TYPE FLOAT
        USING rating::FLOAT;
    """)

def downgrade():
    op.execute("""
        ALTER TABLE reviews
        ALTER COLUMN rating TYPE INTEGER
        USING FLOOR(rating);
    """)
