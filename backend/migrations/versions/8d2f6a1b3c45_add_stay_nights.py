"""Add nights spent at each stop

Revision ID: 8d2f6a1b3c45
Revises: 5b8e1d4c7a92
Create Date: 2026-09-25 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d2f6a1b3c45'
down_revision: Union[str, Sequence[str], None] = '5b8e1d4c7a92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'trip_destinations',
        sa.Column('nights', sa.Integer(), nullable=False, server_default='0'),
    )
    op.add_column(
        'trips',
        sa.Column(
            'destination_nights',
            sa.Integer(),
            nullable=False,
            server_default='0',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('trips', 'destination_nights')
    op.drop_column('trip_destinations', 'nights')
