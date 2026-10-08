from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.v1.users import find_user_by_email
from app.core import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import validate_password_strength
from app.services.app_settings import registration_open, set_registration_open
from app.services.email_validation import (
    EmailNotAcceptedError,
    check_email_address,
)


# Addresses of this computer.
LOCAL_HOSTS = {"127.0.0.1", "::1", "localhost"}


def require_local_request(request: Request) -> None:
    """
    The admin API only answers requests made on this computer.
    """

    if not settings.ADMIN_LOCAL_ONLY:
        return

    host = request.client.host if request.client else None

    if host not in LOCAL_HOSTS:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "admin_local_only",
                "message": "The admin panel only works on this computer.",
            },
        )


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "not_admin",
                "message": "This account isn't an administrator.",
            },
        )

    return current_user


router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_local_request)],
)


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    is_admin: bool = False

    @field_validator("password")
    @classmethod
    def validate_password(cls, password: str) -> str:
        return validate_password_strength(password)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, name: str) -> str:
        name = name.strip()

        if not name:
            raise ValueError("This field can't be empty")

        return name


class AdminUserResponse(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    email_verified: bool
    is_admin: bool
    created_at: datetime


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Every account, newest first.
    """

    return db.scalars(select(User).order_by(User.created_at.desc(), User.id.desc())).all()


@router.post("/users", response_model=AdminUserResponse, status_code=201)
def create_user(
    user_data: AdminUserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create an account. It's active straight away (no confirmation email):
    the administrator vouches for the address.
    """

    try:
        email = check_email_address(user_data.email)
    except EmailNotAcceptedError as error:
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
            detail="An account with this email already exists",
        )

    user = User(
        email=email,
        password_hash=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email_verified_at=datetime.utcnow(),
        is_admin=user_data.is_admin,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


class AdminSettings(BaseModel):
    # People can create their own account at /register.
    registration_open: bool


@router.get("/settings", response_model=AdminSettings)
def get_settings(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return AdminSettings(registration_open=registration_open(db))


@router.put("/settings", response_model=AdminSettings)
def update_settings(
    changes: AdminSettings,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Change app-wide settings; they apply straight away.
    """

    set_registration_open(db, changes.registration_open)

    return AdminSettings(registration_open=registration_open(db))
