"""Add email verification and password reset tracking

Revision ID: 3c1f8a2d9b7e
Revises: ba2449df3282
Create Date: 2026-09-24 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c1f8a2d9b7e'
down_revision: Union[str, Sequence[str], None] = 'ba2449df3282'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column('email_verified_at', sa.DateTime(), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('verification_email_sent_at', sa.DateTime(), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('password_reset_email_sent_at', sa.DateTime(), nullable=True),
    )

    # Accounts created before verification existed stay usable.
    op.execute(
        "UPDATE users SET email_verified_at = created_at "
        "WHERE email_verified_at IS NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'password_reset_email_sent_at')
    op.drop_column('users', 'verification_email_sent_at')
    op.drop_column('users', 'email_verified_at')
