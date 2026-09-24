from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.users import find_user_by_email
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.core.settings import EMAIL_RESEND_COOLDOWN_SECONDS
from app.models.user import User
from app.schemas.user import (
    EmailRequest,
    PasswordResetRequest,
    TokenRequest,
    UserLogin,
)
from app.services.auth_emails import password_reset_email, verification_email
from app.services.email_tokens import (
    RESET_PASSWORD,
    VERIFY_EMAIL,
    EmailTokenError,
    check_password_reset_token,
    check_verification_token,
    create_password_reset_token,
    create_verification_token,
    read_token,
)
from app.services.mailer import send_email


router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)


def token_response(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
    }


def error(status_code: int, code: str, message: str) -> HTTPException:
    """
    Errors clients need to tell apart carry a machine-readable code.
    """

    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def cooldown_passed(sent_at: datetime | None) -> bool:
    return sent_at is None or datetime.utcnow() - sent_at >= timedelta(
        seconds=EMAIL_RESEND_COOLDOWN_SECONDS
    )


def user_from_token(db: Session, token: str, purpose: str) -> tuple[User, dict]:
    try:
        payload = read_token(token, purpose)
    except EmailTokenError as token_error:
        raise error(400, token_error.code, str(token_error))

    user = db.scalar(select(User).where(User.id == int(payload["sub"])))

    if user is None:
        raise error(400, "invalid_token", "This link is invalid.")

    return user, payload


@router.post("/login")
def login(
    user_data: UserLogin,
    db: Session = Depends(get_db),
):
    user = find_user_by_email(db, user_data.email)

    if not user or not verify_password(
        user_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    # Only after the password check, so this doesn't reveal which emails
    # are registered.
    if not user.email_verified:
        raise error(
            403,
            "email_not_verified",
            "Please confirm your email address before signing in. "
            "Check your inbox for the link we sent you.",
        )

    return token_response(user)


@router.post("/verify-email")
def verify_email(
    request: TokenRequest,
    db: Session = Depends(get_db),
):
    """
    Confirm an email address from the emailed link, and sign the user in.
    """

    user, payload = user_from_token(db, request.token, VERIFY_EMAIL)

    try:
        check_verification_token(payload, user)
    except EmailTokenError as token_error:
        raise error(400, token_error.code, str(token_error))

    if not user.email_verified:
        user.email_verified_at = datetime.utcnow()
        db.commit()

    return token_response(user)


@router.post("/resend-verification", status_code=202)
def resend_verification(
    request: EmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Send the verification email again. Always answers the same way so it
    can't be used to find out which emails have accounts.
    """

    user = find_user_by_email(db, request.email)

    if (
        user is not None
        and not user.email_verified
        and cooldown_passed(user.verification_email_sent_at)
    ):
        user.verification_email_sent_at = datetime.utcnow()
        db.commit()

        background_tasks.add_task(
            send_email,
            verification_email(user, create_verification_token(user)),
        )

    return {
        "message": (
            "If that account still needs confirming, we've sent a new link."
        ),
    }


@router.post("/forgot-password", status_code=202)
def forgot_password(
    request: EmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Email a password reset link. Always answers the same way so it can't be
    used to find out which emails have accounts.
    """

    user = find_user_by_email(db, request.email)

    if user is not None and cooldown_passed(user.password_reset_email_sent_at):
        user.password_reset_email_sent_at = datetime.utcnow()
        db.commit()

        background_tasks.add_task(
            send_email,
            password_reset_email(user, create_password_reset_token(user)),
        )

    return {
        "message": (
            "If an account exists for that email, we've sent a link to "
            "reset the password."
        ),
    }


@router.post("/reset-password")
def reset_password(
    request: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """
    Set a new password from the emailed link, and sign the user in.
    """

    user, payload = user_from_token(db, request.token, RESET_PASSWORD)

    try:
        check_password_reset_token(payload, user)
    except EmailTokenError as token_error:
        raise error(400, token_error.code, str(token_error))

    user.password_hash = hash_password(request.password)

    # Receiving the email proves the address works.
    if not user.email_verified:
        user.email_verified_at = datetime.utcnow()

    db.commit()

    return token_response(user)
