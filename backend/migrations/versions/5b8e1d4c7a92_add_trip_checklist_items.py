"""Add trip checklist items

Revision ID: 5b8e1d4c7a92
Revises: 7a4e2c9d1f30
Create Date: 2026-09-25 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b8e1d4c7a92'
down_revision: Union[str, Sequence[str], None] = '7a4e2c9d1f30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'trip_checklist_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('trip_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=20), nullable=True),
        sa.Column('required', sa.Boolean(), nullable=False),
        sa.Column('personal', sa.Boolean(), nullable=False),
        sa.Column('checked', sa.Boolean(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_trip_checklist_items_trip_id'),
        'trip_checklist_items',
        ['trip_id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f('ix_trip_checklist_items_trip_id'),
        table_name='trip_checklist_items',
    )
    op.drop_table('trip_checklist_items')
