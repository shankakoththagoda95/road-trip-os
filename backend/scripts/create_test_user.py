"""
Create (or reset) a verified test account in the local database.

Development only: it skips the email-domain check and the verification
email. Running it again resets the password and marks the email verified.

Usage (from the backend folder):
    .venv/Scripts/python -m scripts.create_test_user
    .venv/Scripts/python -m scripts.create_test_user you@example.dev "Password123"
"""

import sys
from datetime import datetime

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import validate_password_strength


DEFAULT_EMAIL = "tester@roadtripos.dev"
DEFAULT_PASSWORD = "RoadTrip2026!"
FIRST_NAME = "Test"
LAST_NAME = "Driver"


def create_test_user(email: str, password: str) -> tuple[User, bool]:
    email = email.strip().lower()
    validate_password_strength(password)

    with SessionLocal() as db:
        user = db.scalar(select(User).where(func.lower(User.email) == email))
        created = user is None

        if created:
            user = User(
                email=email,
                first_name=FIRST_NAME,
                last_name=LAST_NAME,
                password_hash="",
            )
            db.add(user)

        user.password_hash = hash_password(password)

        if user.email_verified_at is None:
            user.email_verified_at = datetime.utcnow()

        db.commit()
        db.refresh(user)

        return user, created


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EMAIL
    password = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PASSWORD

    user, created = create_test_user(email, password)

    print(
        f"{'Created' if created else 'Reset'} verified test user "
        f"#{user.id}: {user.email}"
    )
