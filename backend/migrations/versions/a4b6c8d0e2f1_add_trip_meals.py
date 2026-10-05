"""Add trip meal plan

Revision ID: a4b6c8d0e2f1
Revises: 9e3c5a7b1d20
Create Date: 2026-10-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4b6c8d0e2f1'
down_revision: Union[str, Sequence[str], None] = '9e3c5a7b1d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'trip_meals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('trip_id', sa.Integer(), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=True),
        sa.Column('meal', sa.String(length=20), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('trip_id', 'day_number', 'meal', name='uq_trip_meal_slot'),
    )
    op.create_index(
        op.f('ix_trip_meals_trip_id'), 'trip_meals', ['trip_id'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_trip_meals_trip_id'), table_name='trip_meals')
    op.drop_table('trip_meals')
