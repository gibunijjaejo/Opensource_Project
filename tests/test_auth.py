"""
시나리오 1: 로그인 흐름
- 정상 로그인 → JWT 토큰 반환
- 잘못된 비밀번호 → 401
- 존재하지 않는 이메일 → 401
- 서강대 이메일이 아닌 경우 이메일 전송 → 400
"""
from fastapi.testclient import TestClient
from tests.conftest import TEST_EMAIL, TEST_PASSWORD


class TestLogin:
    def test_login_success(self, client: TestClient, test_user):
        res = client.post("/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient, test_user):
        res = client.post("/auth/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpassword!",
        })
        assert res.status_code == 401

    def test_login_nonexistent_email(self, client: TestClient):
        res = client.post("/auth/login", json={
            "email": "nobody@sogang.ac.kr",
            "password": "any_password",
        })
        assert res.status_code == 401


class TestEmailValidation:
    def test_send_email_non_sogang_rejected(self, client: TestClient):
        res = client.post("/auth/send-email", json={
            "email": "test@gmail.com",
        })
        assert res.status_code == 400
        assert "서강대학교" in res.json()["message"]

    def test_send_email_sogang_accepted(self, client: TestClient):
        # 실제 이메일 발송 없이 요청만 수락되는지 확인 (202/200)
        res = client.post("/auth/send-email", json={
            "email": "check_only@sogang.ac.kr",
        })
        assert res.status_code == 200
