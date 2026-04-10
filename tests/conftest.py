"""
공통 픽스처 — 실제 DB(seoganpyo)를 사용합니다.
테스트 전용 계정(student_id=9999999)을 생성하고, 테스트 완료 후 삭제합니다.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.activity import Cart
from app.services.user_service import create_user, verify_password

TEST_STUDENT_ID = 9999999
TEST_EMAIL = "test9999999@sogang.ac.kr"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "테스트유저"


@pytest.fixture(scope="session")
def db() -> Session:
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="session")
def test_user(db: Session):
    """테스트 전용 유저 생성 → 세션 종료 후 삭제"""
    # 이미 있으면 재사용
    existing = db.query(User).filter(User.student_id == TEST_STUDENT_ID).first()
    if not existing:
        user = create_user(
            db,
            student_id=TEST_STUDENT_ID,
            name=TEST_NAME,
            email=TEST_EMAIL,
            password=TEST_PASSWORD,
        )
    else:
        user = existing
    yield user
    # 테스트 유저는 삭제하지 않음 — Playwright E2E 테스트가 동일 계정을 사용


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def auth_token(client: TestClient, test_user):
    """테스트 유저 로그인 후 JWT 토큰 반환"""
    res = client.post("/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
    })
    assert res.status_code == 200, f"로그인 실패: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token: str) -> dict:
    return {"Authorization": f"Bearer {auth_token}"}
