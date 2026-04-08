"""
인증(Auth) API 테스트

- 회원가입: 정상 등록, 중복 이메일, 중복 학번
- 로그인: 정상 로그인, 잘못된 비밀번호, 없는 이메일
"""
import pytest


class TestRegister:
    def test_register_success(self, client):
        res = client.post("/auth/register", json={
            "student_id": 20201111,
            "name": "홍길동",
            "email": "hong@sogang.ac.kr",
            "password": "securepass",
            "current_semester": 4,
            "major_credits": 40,
            "common_credits": 20,
            "total_credits": 60,
            "total_english": 2,
        })
        assert res.status_code == 201
        data = res.json()
        assert data["student_id"] == 20201111
        assert data["name"] == "홍길동"
        assert data["email"] == "hong@sogang.ac.kr"

    def test_register_duplicate_email(self, client, test_user):
        res = client.post("/auth/register", json={
            "student_id": 20209999,
            "name": "중복이메일",
            "email": test_user.email,  # 이미 존재하는 이메일
            "password": "pass",
            "current_semester": 1,
            "major_credits": 0,
            "common_credits": 0,
            "total_credits": 0,
            "total_english": 0,
        })
        assert res.status_code == 409

    def test_register_duplicate_student_id(self, client, test_user):
        res = client.post("/auth/register", json={
            "student_id": test_user.student_id,  # 이미 존재하는 학번
            "name": "중복학번",
            "email": "new@sogang.ac.kr",
            "password": "pass",
            "current_semester": 1,
            "major_credits": 0,
            "common_credits": 0,
            "total_credits": 0,
            "total_english": 0,
        })
        assert res.status_code == 409


class TestLogin:
    def test_login_success(self, client, test_user):
        res = client.post("/auth/login", json={
            "email": test_user.email,
            "password": "password123",
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, test_user):
        res = client.post("/auth/login", json={
            "email": test_user.email,
            "password": "wrongpassword",
        })
        assert res.status_code == 401

    def test_login_nonexistent_email(self, client):
        res = client.post("/auth/login", json={
            "email": "nobody@sogang.ac.kr",
            "password": "anypass",
        })
        assert res.status_code == 401
