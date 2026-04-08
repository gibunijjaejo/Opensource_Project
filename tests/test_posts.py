"""
커뮤니티 게시판(Posts) API 테스트

- 게시글 목록 조회, 작성, 상세, 삭제
- 익명 게시글 작성자 이름 노출 여부
- 좋아요 토글 (추가/취소)
- 권한: 본인 글만 삭제 가능
"""
import pytest


class TestPostList:
    def test_get_posts_empty(self, client):
        res = client.get("/api/v1/community/general")
        assert res.status_code == 200
        assert res.json() == []

    def test_get_posts_returns_created_post(self, client, test_post):
        res = client.get("/api/v1/community/general")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["title"] == "테스트 게시글"

    def test_posts_filtered_by_category(self, client, test_post):
        res = client.get("/api/v1/community/notice")
        assert res.status_code == 200
        assert res.json() == []


class TestPostCreate:
    def test_create_post_success(self, client, test_user, auth_headers):
        res = client.post(
            "/api/v1/community/general",
            data={"title": "새 글", "content": "내용", "is_anonymous": "false"},
            headers=auth_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["title"] == "새 글"
        assert data["author_name"] == test_user.name

    def test_create_post_anonymous(self, client, auth_headers):
        res = client.post(
            "/api/v1/community/general",
            data={"title": "익명글", "content": "내용", "is_anonymous": "true"},
            headers=auth_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["is_anonymous"] is True
        assert data["author_name"] is None

    def test_create_post_unauthorized(self, client):
        res = client.post(
            "/api/v1/community/general",
            data={"title": "글", "content": "내용", "is_anonymous": "false"},
        )
        assert res.status_code == 401


class TestPostDetail:
    def test_get_post_detail(self, client, test_post):
        res = client.get(f"/api/v1/community/general/{test_post.id}")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == test_post.id
        assert "comments" in data

    def test_get_nonexistent_post(self, client):
        res = client.get("/api/v1/community/general/99999")
        assert res.status_code == 404


class TestPostDelete:
    def test_delete_own_post(self, client, test_post, auth_headers):
        res = client.delete(
            f"/api/v1/community/general/{test_post.id}",
            headers=auth_headers,
        )
        assert res.status_code == 204

        # 삭제 후 조회 시 404
        res2 = client.get(f"/api/v1/community/general/{test_post.id}")
        assert res2.status_code == 404

    def test_delete_others_post_forbidden(self, client, test_post, auth_headers2):
        """다른 유저가 삭제 시도하면 403"""
        res = client.delete(
            f"/api/v1/community/general/{test_post.id}",
            headers=auth_headers2,
        )
        assert res.status_code == 403

    def test_delete_nonexistent_post(self, client, auth_headers):
        res = client.delete("/api/v1/community/general/99999", headers=auth_headers)
        assert res.status_code == 404


class TestPostLike:
    def test_like_post(self, client, test_post, test_user2, auth_headers2):
        res = client.post(
            f"/api/v1/community/general/{test_post.id}/like",
            headers=auth_headers2,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["liked"] is True
        assert data["likes"] == 1

    def test_unlike_post(self, client, test_post, test_user2, auth_headers2):
        # 좋아요 추가 후 다시 누르면 취소
        client.post(f"/api/v1/community/general/{test_post.id}/like", headers=auth_headers2)
        res = client.post(
            f"/api/v1/community/general/{test_post.id}/like",
            headers=auth_headers2,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["liked"] is False
        assert data["likes"] == 0

    def test_like_nonexistent_post(self, client, auth_headers):
        res = client.post("/api/v1/community/general/99999/like", headers=auth_headers)
        assert res.status_code == 404
