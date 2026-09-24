from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.services.auth_emails import verification_email
from app.services.email_tokens import create_verification_token
from app.services.email_validation import (
    EmailNotAcceptedError,
    check_email_address,
)
from app.services.mailer import send_email


router = APIRouter(
    prefix="/users",
    tags=["users"],
)


@router.get("/test")
def test_users():
    return {"message": "Users API is working!"}


def find_user_by_email(db: Session, email: str) -> User | None:
    """
    Case-insensitive lookup (older accounts may have mixed-case emails).
    """

    return db.scalar(
        select(User).where(func.lower(User.email) == email.strip().lower())
    )


@router.post("/", response_model=UserResponse, status_code=201)
def create_user(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Create an unverified account and email a verification link. The user
    can sign in once they've clicked it.
    """

    try:
        email = check_email_address(user_data.email)
    except EmailNotAcceptedError as error:
        # Same shape as FastAPI validation errors, so clients can show the
        # message on the email field.
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "loc": ["body", "email"],
                    "msg": str(error),
                    "type": "value_error",
                }
            ],
        )

    if find_user_by_email(db, email):
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    new_user = User(
        email=email,
        password_hash=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        verification_email_sent_at=datetime.utcnow(),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    background_tasks.add_task(
        send_email,
        verification_email(new_user, create_verification_token(new_user)),
    )

    return new_user


@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user
