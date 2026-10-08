from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User


def make_user(db, email, is_admin=False):
    user = User(
        email=email,
        password_hash=hash_password("password123"),
        first_name="First",
        last_name="Last",
        email_verified_at=datetime.utcnow(),
        is_admin=is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def headers_for(user):
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
def local_client(client):
    # The shared `client` fixture sets up the test database; this one
    # connects from this computer's address.
    with TestClient(app, client=("127.0.0.1", 50000)) as local:
        yield local


@pytest.fixture
def admin(db):
    return make_user(db, "admin@example.com", is_admin=True)


NEW_USER = {
    "email": "  Traveller@Example.com ",
    "password": "Roadtrip2026",
    "first_name": " Ada ",
    "last_name": "Lovelace",
}


def test_admin_creates_an_active_account(local_client, admin):
    response = local_client.post("/admin/users", json=NEW_USER, headers=headers_for(admin))

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "traveller@example.com"
    assert body["first_name"] == "Ada"
    assert body["email_verified"] is True
    assert body["is_admin"] is False

    # The new account can sign in straight away.
    login = local_client.post(
        "/auth/login",
        json={"email": "traveller@example.com", "password": "Roadtrip2026"},
    )
    assert login.status_code == 200


def test_admin_can_create_another_admin(local_client, admin):
    response = local_client.post(
        "/admin/users",
        json={**NEW_USER, "is_admin": True},
        headers=headers_for(admin),
    )

    assert response.json()["is_admin"] is True


def test_admin_lists_accounts_newest_first(local_client, admin, db):
    make_user(db, "someone@example.com")

    response = local_client.get("/admin/users", headers=headers_for(admin))

    assert response.status_code == 200
    emails = [user["email"] for user in response.json()]
    assert set(emails) == {"admin@example.com", "someone@example.com"}
    assert "password_hash" not in response.json()[0]


def test_duplicate_email_is_rejected(local_client, admin):
    response = local_client.post(
        "/admin/users",
        json={**NEW_USER, "email": "ADMIN@example.com"},
        headers=headers_for(admin),
    )

    assert response.status_code == 409


@pytest.mark.parametrize(
    "changes",
    [{"password": "short1"}, {"password": "lettersonly"}, {"first_name": "  "}, {"email": "nope"}],
)
def test_invalid_accounts_are_rejected(local_client, admin, changes):
    response = local_client.post(
        "/admin/users", json={**NEW_USER, **changes}, headers=headers_for(admin)
    )

    assert response.status_code == 422


def test_regular_users_cannot_use_the_admin_api(local_client, db):
    user = make_user(db, "regular@example.com")

    listed = local_client.get("/admin/users", headers=headers_for(user))
    created = local_client.post("/admin/users", json=NEW_USER, headers=headers_for(user))

    assert listed.status_code == 403
    assert listed.json()["detail"]["code"] == "not_admin"
    assert created.status_code == 403


def test_admin_api_needs_login(local_client):
    assert local_client.get("/admin/users").status_code == 401


def test_admin_api_refuses_other_computers(client, admin):
    # The shared client connects as "testclient", not a local address.
    response = client.get("/admin/users", headers=headers_for(admin))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "admin_local_only"


def test_me_says_whether_the_user_is_an_admin(local_client, admin):
    assert local_client.get("/users/me", headers=headers_for(admin)).json()["is_admin"] is True


def test_sign_up_is_closed_by_default(client, monkeypatch):
    monkeypatch.setattr("app.core.settings.REGISTRATION_OPEN", False)

    response = client.post("/users/", json=NEW_USER)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "registration_closed"


def test_registration_is_closed_unless_switched_on(monkeypatch):
    import importlib

    import app.core.settings as settings_module

    try:
        monkeypatch.delenv("REGISTRATION_OPEN", raising=False)
        assert importlib.reload(settings_module).REGISTRATION_OPEN is False

        monkeypatch.setenv("REGISTRATION_OPEN", "true")
        assert importlib.reload(settings_module).REGISTRATION_OPEN is True
    finally:
        monkeypatch.undo()
        importlib.reload(settings_module)


def test_registration_status_endpoint(client, monkeypatch):
    monkeypatch.setattr("app.core.settings.REGISTRATION_OPEN", False)
    assert client.get("/users/registration").json() == {"open": False}

    monkeypatch.setattr("app.core.settings.REGISTRATION_OPEN", True)
    assert client.get("/users/registration").json() == {"open": True}


def test_admin_toggles_registration(local_client, admin, client):
    headers = headers_for(admin)
    new_user = {**NEW_USER, "email": "selfsignup@example.com"}

    closed = local_client.put("/admin/settings", json={"registration_open": False}, headers=headers)
    assert closed.json() == {"registration_open": False}
    assert local_client.get("/admin/settings", headers=headers).json() == {"registration_open": False}
    assert client.get("/users/registration").json() == {"open": False}
    assert client.post("/users/", json=new_user).status_code == 403

    opened = local_client.put("/admin/settings", json={"registration_open": True}, headers=headers)
    assert opened.json() == {"registration_open": True}
    assert client.get("/users/registration").json() == {"open": True}
    assert client.post("/users/", json=new_user).status_code == 201


def test_registration_follows_the_environment_until_an_admin_sets_it(client, monkeypatch):
    monkeypatch.setattr("app.core.settings.REGISTRATION_OPEN", False)
    assert client.get("/users/registration").json() == {"open": False}


def test_settings_need_an_admin_on_this_computer(local_client, client, admin, db):
    user = make_user(db, "regular2@example.com")

    assert local_client.get("/admin/settings", headers=headers_for(user)).status_code == 403
    assert (
        local_client.put(
            "/admin/settings", json={"registration_open": True}, headers=headers_for(user)
        ).status_code
        == 403
    )
    assert client.get("/admin/settings", headers=headers_for(admin)).status_code == 403
