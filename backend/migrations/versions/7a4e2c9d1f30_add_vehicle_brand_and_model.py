"""Add brand and model to vehicles

Revision ID: 7a4e2c9d1f30
Revises: 3c1f8a2d9b7e
Create Date: 2026-09-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a4e2c9d1f30'
down_revision: Union[str, Sequence[str], None] = '3c1f8a2d9b7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'vehicles',
        sa.Column('brand', sa.String(length=60), nullable=True),
    )
    op.add_column(
        'vehicles',
        sa.Column('model', sa.String(length=60), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('vehicles', 'model')
    op.drop_column('vehicles', 'brand')
