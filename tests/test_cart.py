"""
장바구니(Cart) API 테스트

- 장바구니 조회, 강의 추가, 삭제
- 중복 추가 방지
- 없는 강의 추가 방지
"""
import pytest


class TestCartGet:
    def test_get_empty_cart(self, client, test_user):
        res = client.get(f"/api/v1/users/{test_user.student_id}/cart")
        assert res.status_code == 200
        assert res.json() == []

    def test_get_cart_with_item(self, client, test_user, test_cart):
        res = client.get(f"/api/v1/users/{test_user.student_id}/cart")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["course_id"] == test_cart.course_id


class TestCartAdd:
    def test_add_to_cart(self, client, test_user, test_course):
        res = client.post(
            f"/api/v1/users/{test_user.student_id}/cart",
            json={"course_id": test_course.course_id},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["course_id"] == test_course.course_id
        assert data["student_id"] == test_user.student_id

    def test_add_duplicate_course(self, client, test_user, test_cart):
        """이미 담긴 강의를 다시 추가하면 409"""
        res = client.post(
            f"/api/v1/users/{test_user.student_id}/cart",
            json={"course_id": test_cart.course_id},
        )
        assert res.status_code == 409

    def test_add_nonexistent_course(self, client, test_user):
        """존재하지 않는 강의 추가 시 404"""
        res = client.post(
            f"/api/v1/users/{test_user.student_id}/cart",
            json={"course_id": 99999},
        )
        assert res.status_code == 404

    def test_add_two_different_courses(self, client, test_user, test_course, test_course2):
        client.post(
            f"/api/v1/users/{test_user.student_id}/cart",
            json={"course_id": test_course.course_id},
        )
        client.post(
            f"/api/v1/users/{test_user.student_id}/cart",
            json={"course_id": test_course2.course_id},
        )
        res = client.get(f"/api/v1/users/{test_user.student_id}/cart")
        assert len(res.json()) == 2


class TestCartRemove:
    def test_remove_from_cart(self, client, test_user, test_cart):
        res = client.delete(f"/api/v1/users/{test_user.student_id}/cart/{test_cart.id}")
        assert res.status_code == 204

        # 삭제 후 비어있어야 함
        res2 = client.get(f"/api/v1/users/{test_user.student_id}/cart")
        assert res2.json() == []

    def test_remove_nonexistent_cart_item(self, client, test_user):
        res = client.delete(f"/api/v1/users/{test_user.student_id}/cart/99999")
        assert res.status_code == 404


class TestCartJWT:
    """JWT 기반 장바구니 엔드포인트 (/api/v1/cart)"""

    def test_get_my_cart(self, client, test_user, test_cart, auth_headers):
        res = client.get("/api/v1/cart", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_add_to_my_cart(self, client, test_user, test_course, auth_headers):
        res = client.post(
            "/api/v1/cart",
            json={"course_id": test_course.course_id},
            headers=auth_headers,
        )
        assert res.status_code == 201

    def test_remove_from_my_cart(self, client, test_user, test_cart, auth_headers):
        res = client.delete(f"/api/v1/cart/{test_cart.id}", headers=auth_headers)
        assert res.status_code == 204

    def test_my_cart_unauthorized(self, client):
        res = client.get("/api/v1/cart")
        assert res.status_code == 401
