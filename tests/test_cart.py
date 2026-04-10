"""
시나리오 3: 장바구니 흐름 (JWT 인증 필요)
- 장바구니 조회
- 과목 추가
- 중복 추가 → 409
- 존재하지 않는 과목 추가 → 404
- 장바구니 삭제
"""
import pytest
from fastapi.testclient import TestClient


VALID_COURSE_ID = None  # setup에서 DB에서 첫 번째 과목 ID를 가져옴


class TestCart:
    @pytest.fixture(autouse=True)
    def setup_course_id(self, client: TestClient):
        """테스트용 실제 course_id 확보"""
        res = client.get("/api/v1/courses", params={"year": 2026, "semester": 1, "limit": 1})
        assert res.status_code == 200
        self.course_id = res.json()[0]["course_id"]

    def test_get_cart_empty_or_list(self, client: TestClient, auth_headers: dict):
        res = client.get("/api/v1/cart", headers=auth_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_add_to_cart(self, client: TestClient, auth_headers: dict):
        # 혹시 이미 있으면 먼저 정리
        cart_res = client.get("/api/v1/cart", headers=auth_headers)
        for item in cart_res.json():
            if item["course_id"] == self.course_id:
                client.delete(f"/api/v1/cart/{item['id']}", headers=auth_headers)

        res = client.post("/api/v1/cart", json={"course_id": self.course_id}, headers=auth_headers)
        assert res.status_code == 201
        body = res.json()
        assert body["course_id"] == self.course_id
        self.cart_item_id = body["id"]

        # 정리
        client.delete(f"/api/v1/cart/{self.cart_item_id}", headers=auth_headers)

    def test_add_duplicate_returns_409(self, client: TestClient, auth_headers: dict):
        # 첫 번째 추가
        res1 = client.post("/api/v1/cart", json={"course_id": self.course_id}, headers=auth_headers)
        assert res1.status_code == 201
        cart_item_id = res1.json()["id"]

        # 중복 추가
        res2 = client.post("/api/v1/cart", json={"course_id": self.course_id}, headers=auth_headers)
        assert res2.status_code == 409

        # 정리
        client.delete(f"/api/v1/cart/{cart_item_id}", headers=auth_headers)

    def test_add_nonexistent_course_returns_404(self, client: TestClient, auth_headers: dict):
        res = client.post("/api/v1/cart", json={"course_id": 99999999}, headers=auth_headers)
        assert res.status_code == 404

    def test_remove_from_cart(self, client: TestClient, auth_headers: dict):
        # 추가 후 삭제
        add_res = client.post("/api/v1/cart", json={"course_id": self.course_id}, headers=auth_headers)
        assert add_res.status_code == 201
        cart_item_id = add_res.json()["id"]

        del_res = client.delete(f"/api/v1/cart/{cart_item_id}", headers=auth_headers)
        assert del_res.status_code == 204

    def test_cart_requires_auth(self, client: TestClient):
        res = client.get("/api/v1/cart")
        assert res.status_code == 401 or res.status_code == 403
