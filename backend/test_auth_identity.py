from __future__ import annotations

import uuid

from auth import (
    AuthIdentity,
    EXTERNAL_AUTH_PASSWORD_SENTINEL,
    _resolve_user_for_identity,
    user_has_role,
)
from database import UserRow, get_db, init_db


def _unique_email() -> str:
    return f"auth-test-{uuid.uuid4().hex[:8]}@example.com"


def test_external_identity_does_not_link_existing_user_by_email():
    init_db()
    email = _unique_email()
    subject = f"zitadel-subject-{uuid.uuid4().hex[:8]}"
    db = next(get_db())
    try:
        user = UserRow(
            email=email,
            password_hash=EXTERNAL_AUTH_PASSWORD_SENTINEL,
            display_name="Existing User",
            role="student",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        identity = AuthIdentity(
            subject=subject,
            issuer="https://zitadel.nonprod.example",
            email=email,
            display_name="Existing User Renamed",
            roles=["professor"],
            claims={"email": email, "role": ["professor"]},
        )

        created = _resolve_user_for_identity(identity, db)

        assert created.id != user.id
        assert created.email == email
        assert created.auth_provider == "zitadel"
        assert created.auth_issuer == "https://zitadel.nonprod.example"
        assert created.auth_subject == subject
        assert created.role == "professor"
        assert created.display_name == "Existing User Renamed"
    finally:
        db.close()


def test_external_identity_provisions_new_local_user():
    init_db()
    email = _unique_email()
    subject = f"zitadel-subject-{uuid.uuid4().hex[:8]}"
    db = next(get_db())
    try:
        identity = AuthIdentity(
            subject=subject,
            issuer="https://zitadel.nonprod.example",
            email=email,
            display_name="Brand New User",
            roles=["student"],
            claims={"email": email, "role": ["student"]},
        )

        created = _resolve_user_for_identity(identity, db)

        assert created.email == email
        assert created.auth_provider == "zitadel"
        assert created.auth_issuer == "https://zitadel.nonprod.example"
        assert created.auth_subject == subject
        assert created.role == "student"
        assert created.display_name == "Brand New User"
        assert created.account_status == "active"
    finally:
        db.close()


def test_user_has_role_prefers_attached_auth_roles():
    init_db()
    db = next(get_db())
    try:
        user = UserRow(
            email=_unique_email(),
            password_hash=EXTERNAL_AUTH_PASSWORD_SENTINEL,
            display_name="Role User",
            role="student",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        setattr(user, "auth_roles", ["student", "professor"])

        assert user_has_role(user, "professor") is True
        assert user_has_role(user, "student") is True
    finally:
        db.close()
