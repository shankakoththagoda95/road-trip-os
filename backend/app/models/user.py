from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    # Null until the user clicks the link in the verification email.
    # Unverified users can't sign in.
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # When the last verification / password reset email was sent, used to
    # stop the "send again" buttons from spamming inboxes.
    verification_email_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    password_reset_email_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None
