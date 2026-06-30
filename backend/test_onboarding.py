"""Unit tests for onboarding status endpoint."""
from fastapi.testclient import TestClient

from database import RoomMemberRow, RoomRow, get_db, init_db
from main import app

client = TestClient(app)


def _register(email: str, role: str = "student") -> tuple[str, str]:
    res = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "test123",
            "display_name": "Test User",
            "role": role,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    return data["access_token"], data["user_id"]


def test_onboarding_status_new_student():
    init_db()
    token, _user_id = _register("onboarding-new@test.com")
    res = client.get(
        "/users/me/onboarding-status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data == {
        "has_policy_submission": False,
        "has_solo_season": False,
        "has_class_room": False,
        "has_teaching_room": False,
        "has_season": False,
    }


def test_onboarding_status_professor_with_room():
    init_db()
    token, user_id = _register("onboarding-prof@test.com", role="professor")
    db = next(get_db())
    try:
        room = RoomRow(name="Test Room", invite_code="ABCD1234", professor_id=user_id)
        db.add(room)
        db.flush()
        db.add(RoomMemberRow(user_id=user_id, room_id=room.id))
        db.commit()
    finally:
        db.close()

    res = client.get(
        "/users/me/onboarding-status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["has_teaching_room"] is True
    assert data["has_class_room"] is True
    assert data["has_season"] is False


def test_onboarding_status_requires_auth():
    res = client.get("/users/me/onboarding-status")
    assert res.status_code == 401
