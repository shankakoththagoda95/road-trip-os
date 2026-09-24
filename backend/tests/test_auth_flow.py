import re
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import unquote

import jwt
import pytest

from app.core.security import ALGORITHM, SECRET_KEY
from app.models.user import User
from app.services.auth_emails import verification_email
from app.services.email_tokens import create_password_reset_token
from app.services.email_validation import (
    EmailNotAcceptedError,
    check_email_address,
)


PASSWORD = "Roadtrip2026"
NEW_PASSWORD = "Scenic-route-99"


def register(client, email="Traveler@Example.org", password=PASSWORD):
    return client.post(
        "/users/",
        json={
            "email": email,
            "password": password,
            "first_name": "Ada",
            "last_name": "Lovelace",
        },
    )


def login(client, email="traveler@example.org", password=PASSWORD):
    return client.post("/auth/login", json={"email": email, "password": password})


def token_from(message):
    match = re.search(r"token=([^\s\"&]+)", message.text)
    assert match, message.text
    return unquote(match.group(1))


def age_timestamp(db, email, column):
    user = db.query(User).filter(User.email == email).one()
    setattr(user, column, datetime.utcnow() - timedelta(minutes=5))
    db.commit()


# --- Registration ---


def test_register_creates_unverified_user_and_sends_email(client, outbox):
    response = register(client)

    assert response.status_code == 201
    assert response.json()["email"] == "traveler@example.org"
    assert response.json()["email_verified"] is False

    assert len(outbox) == 1
    assert outbox[0].to == "traveler@example.org"
    assert "Confirm" in outbox[0].subject
    assert "/verify-email?token=" in outbox[0].text
    assert "/verify-email?token=" in outbox[0].html


def test_register_rejects_duplicate_email_in_any_case(client):
    register(client)

    response = register(client, email="TRAVELER@example.org")

    assert response.status_code == 409


def test_register_rejects_undeliverable_email(client, outbox, monkeypatch):
    def reject(email):
        raise EmailNotAcceptedError("This email domain can't receive mail.")

    monkeypatch.setattr("app.api.v1.users.check_email_address", reject)

    response = register(client)

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "email"]
    assert "can't receive mail" in response.json()["detail"][0]["msg"]
    assert outbox == []


@pytest.mark.parametrize(
    ("password", "message"),
    [
        ("short1", "at least 8 characters"),
        ("longpassword", "at least one number"),
        ("1234567890", "at least one letter"),
    ],
)
def test_register_enforces_password_rules(client, password, message):
    response = register(client, password=password)

    assert response.status_code == 422
    assert message in response.json()["detail"][0]["msg"]


# --- Login & verification ---


def test_unverified_user_cannot_log_in(client):
    register(client)

    response = login(client)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "email_not_verified"


def test_wrong_password_does_not_reveal_verification_state(client):
    register(client)

    response = login(client, password="Wrong-password-1")

    assert response.status_code == 401


def test_verification_link_activates_account_and_signs_in(client, outbox):
    register(client)

    response = client.post(
        "/auth/verify-email",
        json={"token": token_from(outbox[0])},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]

    me = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {response.json()['access_token']}"},
    )
    assert me.json()["email_verified"] is True

    assert login(client).status_code == 200
    # Login is case-insensitive.
    assert login(client, email="TRAVELER@EXAMPLE.ORG").status_code == 200


def test_verification_link_can_be_opened_twice(client, outbox):
    register(client)
    token = token_from(outbox[0])

    client.post("/auth/verify-email", json={"token": token})
    response = client.post("/auth/verify-email", json={"token": token})

    assert response.status_code == 200


def test_invalid_verification_token(client):
    response = client.post("/auth/verify-email", json={"token": "not-a-token"})

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_token"


def test_expired_verification_token(client):
    user_id = register(client).json()["id"]
    expired = jwt.encode(
        {
            "sub": str(user_id),
            "purpose": "verify_email",
            "email": "traveler@example.org",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    response = client.post("/auth/verify-email", json={"token": expired})

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "token_expired"


def test_reset_token_cannot_verify_email(client, db):
    register(client)
    user = db.query(User).one()

    response = client.post(
        "/auth/verify-email",
        json={"token": create_password_reset_token(user)},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_token"


# --- Resending the verification email ---


def test_resend_verification_respects_cooldown(client, outbox, db):
    register(client)

    # Just registered: too soon to send again.
    response = client.post(
        "/auth/resend-verification",
        json={"email": "traveler@example.org"},
    )
    assert response.status_code == 202
    assert len(outbox) == 1

    age_timestamp(db, "traveler@example.org", "verification_email_sent_at")

    client.post("/auth/resend-verification", json={"email": "Traveler@example.org"})
    assert len(outbox) == 2


def test_resend_verification_gives_same_answer_for_unknown_or_verified(
    client,
    outbox,
    test_user,
):
    unknown = client.post(
        "/auth/resend-verification",
        json={"email": "nobody@example.org"},
    )
    verified = client.post(
        "/auth/resend-verification",
        json={"email": test_user.email},
    )

    assert unknown.status_code == verified.status_code == 202
    assert unknown.json() == verified.json()
    assert outbox == []


# --- Password reset ---


def test_forgot_password_sends_reset_link(client, outbox, test_user):
    response = client.post(
        "/auth/forgot-password",
        json={"email": "TEST@example.com"},
    )

    assert response.status_code == 202
    assert len(outbox) == 1
    assert outbox[0].to == test_user.email
    assert "/reset-password?token=" in outbox[0].text


def test_forgot_password_unknown_email_looks_the_same(client, outbox, test_user):
    unknown = client.post(
        "/auth/forgot-password",
        json={"email": "nobody@example.org"},
    )
    known = client.post("/auth/forgot-password", json={"email": test_user.email})

    assert unknown.status_code == known.status_code == 202
    assert unknown.json() == known.json()
    assert len(outbox) == 1


def test_forgot_password_cooldown(client, outbox, test_user):
    client.post("/auth/forgot-password", json={"email": test_user.email})
    client.post("/auth/forgot-password", json={"email": test_user.email})

    assert len(outbox) == 1


def test_reset_password_changes_password_once(client, outbox, test_user):
    client.post("/auth/forgot-password", json={"email": test_user.email})
    token = token_from(outbox[0])

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "password": NEW_PASSWORD},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert login(client, test_user.email, "password123").status_code == 401
    assert login(client, test_user.email, NEW_PASSWORD).status_code == 200

    reused = client.post(
        "/auth/reset-password",
        json={"token": token, "password": "Another-pass-1"},
    )

    assert reused.status_code == 400
    assert reused.json()["detail"]["code"] == "token_used"


def test_reset_password_enforces_password_rules(client, outbox, test_user):
    client.post("/auth/forgot-password", json={"email": test_user.email})

    response = client.post(
        "/auth/reset-password",
        json={"token": token_from(outbox[0]), "password": "weak"},
    )

    assert response.status_code == 422


def test_reset_password_also_verifies_email(client, outbox, db):
    register(client)
    age_timestamp(db, "traveler@example.org", "password_reset_email_sent_at")
    client.post("/auth/forgot-password", json={"email": "traveler@example.org"})

    client.post(
        "/auth/reset-password",
        json={"token": token_from(outbox[-1]), "password": NEW_PASSWORD},
    )

    assert login(client, password=NEW_PASSWORD).status_code == 200


# --- Email checks & templates ---


def fake_result(domain):
    return SimpleNamespace(domain=domain, normalized=f"Someone@{domain}")


def test_check_email_address_rejects_disposable_domains():
    with patch(
        "app.services.email_validation.validate_email",
        return_value=fake_result("mailinator.com"),
    ):
        with pytest.raises(EmailNotAcceptedError, match="Disposable"):
            check_email_address("someone@mailinator.com")


def test_check_email_address_normalises():
    with patch(
        "app.services.email_validation.validate_email",
        return_value=fake_result("Gmail.com"),
    ):
        assert check_email_address("Someone@Gmail.com") == "someone@gmail.com"


def test_verification_email_escapes_names():
    user = User(id=1, email="a@b.org", first_name="<script>", last_name="X")

    message = verification_email(user, "abc")

    assert "<script>" not in message.html
    assert "&lt;script&gt;" in message.html
    assert "token=abc" in message.text
