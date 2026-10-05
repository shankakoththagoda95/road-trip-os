"""
Create the administrator account, or update it (password, admin rights).

Run from the backend folder:

    .venv\\Scripts\\python -m scripts.create_admin

It asks for the email and password. To run it without prompts, set
ADMIN_EMAIL and ADMIN_PASSWORD for that one command. The password is only
stored as a hash in the database.
"""

import getpass
import os
import sys
from datetime import datetime

from app.api.v1.users import find_user_by_email
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import validate_password_strength


def main() -> int:
    email = (os.getenv("ADMIN_EMAIL") or input("Admin email: ")).strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Admin password: ")

    try:
        validate_password_strength(password)
    except ValueError as error:
        print(f"Password not accepted: {error}")
        return 1

    with SessionLocal() as db:
        user = find_user_by_email(db, email)

        if user is None:
            user = User(
                email=email,
                password_hash=hash_password(password),
                first_name="Admin",
                last_name="Road-Trip OS",
                email_verified_at=datetime.utcnow(),
                is_admin=True,
            )
            db.add(user)
            action = "Created"
        else:
            user.password_hash = hash_password(password)
            user.is_admin = True
            user.email_verified_at = user.email_verified_at or datetime.utcnow()
            action = "Updated"

        db.commit()
        print(f"{action} admin account {email} (user #{user.id}).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
