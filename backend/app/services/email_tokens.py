"""
Signed, expiring tokens for links sent by email.

Tokens are stateless JWTs with a `purpose`, so a verification link can't be
used to reset a password and vice versa. Password reset tokens also carry a
fingerprint of the current password hash: once the password changes, every
older reset link stops working (single use).
"""

import hashlib
from datetime import datetime, timedelta, timezone

import jwt

from app.core.security import ALGORITHM, SECRET_KEY
from app.core.settings import (
    EMAIL_VERIFICATION_TOKEN_HOURS,
    PASSWORD_RESET_TOKEN_MINUTES,
)
from app.models.user import User


VERIFY_EMAIL = "verify_email"
RESET_PASSWORD = "reset_password"


class EmailTokenError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _password_fingerprint(user: User) -> str:
    return hashlib.sha256(user.password_hash.encode()).hexdigest()[:16]


def _encode(payload: dict, lifetime: timedelta) -> str:
    return jwt.encode(
        {**payload, "exp": datetime.now(timezone.utc) + lifetime},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_verification_token(user: User) -> str:
    return _encode(
        {"sub": str(user.id), "purpose": VERIFY_EMAIL, "email": user.email},
        timedelta(hours=EMAIL_VERIFICATION_TOKEN_HOURS),
    )


def create_password_reset_token(user: User) -> str:
    return _encode(
        {
            "sub": str(user.id),
            "purpose": RESET_PASSWORD,
            "pwd": _password_fingerprint(user),
        },
        timedelta(minutes=PASSWORD_RESET_TOKEN_MINUTES),
    )


def read_token(token: str, purpose: str) -> dict:
    """
    Decode a token and check its purpose. Raises EmailTokenError.
    """

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as error:
        raise EmailTokenError(
            "token_expired",
            "This link has expired.",
        ) from error
    except jwt.InvalidTokenError as error:
        raise EmailTokenError(
            "invalid_token",
            "This link is invalid.",
        ) from error

    if payload.get("purpose") != purpose or "sub" not in payload:
        raise EmailTokenError("invalid_token", "This link is invalid.")

    return payload


def check_verification_token(payload: dict, user: User) -> None:
    # The link belongs to the address it was sent to.
    if payload.get("email") != user.email:
        raise EmailTokenError("invalid_token", "This link is invalid.")


def check_password_reset_token(payload: dict, user: User) -> None:
    if payload.get("pwd") != _password_fingerprint(user):
        raise EmailTokenError(
            "token_used",
            "This link has already been used.",
        )
