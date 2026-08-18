"""Unit tests for onboarding status endpoint."""
from fastapi.testclient import TestClient

from auth import get_current_user
from database import RoomMemberRow, RoomRow, UserRow, get_db, init_db
from main import app

client = TestClient(app)


def _create_user(email: str, role: str = "student") -> UserRow:
    db = next(get_db())
    try:
        user = UserRow(
            email=email,
            password_hash="__zitadel_managed__",
            display_name="Test User",
            role=role,
            auth_provider="zitadel",
            auth_issuer="https://zitadel.nonprod.example",
            auth_subject=f"{role}:{email}",
            account_status="active",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def test_onboarding_status_new_student():
    init_db()
    user = _create_user("onboarding-new@test.com")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        res = client.get("/users/me/onboarding-status")
        assert res.status_code == 200
        data = res.json()
        assert data == {
            "has_policy_submission": False,
            "has_solo_season": False,
            "has_class_room": False,
            "has_teaching_room": False,
            "has_season": False,
        }
    finally:
        app.dependency_overrides.clear()


def test_onboarding_status_professor_with_room():
    init_db()
    user = _create_user("onboarding-prof@test.com", role="professor")
    db = next(get_db())
    try:
        room = RoomRow(name="Test Room", invite_code="ABCD1234", professor_id=user.id)
        db.add(room)
        db.flush()
        db.add(RoomMemberRow(user_id=user.id, room_id=room.id))
        db.commit()
    finally:
        db.close()

    app.dependency_overrides[get_current_user] = lambda: user
    try:
        res = client.get("/users/me/onboarding-status")
        assert res.status_code == 200
        data = res.json()
        assert data["has_teaching_room"] is True
        assert data["has_class_room"] is True
        assert data["has_season"] is False
    finally:
        app.dependency_overrides.clear()


def test_onboarding_status_requires_auth():
    res = client.get("/users/me/onboarding-status")
    assert res.status_code == 401
