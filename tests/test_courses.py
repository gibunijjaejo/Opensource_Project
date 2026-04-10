"""
시나리오 2: 과목 검색
- 전체 목록 조회
- year/semester 필터
- 키워드 검색 (과목명, 교수명, 과목코드)
- 존재하지 않는 과목 ID → 404
"""
from fastapi.testclient import TestClient


class TestCourseList:
    def test_get_courses_returns_list(self, client: TestClient):
        res = client.get("/api/v1/courses", params={"year": 2026, "semester": 1, "limit": 10})
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body, list)
        assert len(body) > 0

    def test_filter_by_year_semester(self, client: TestClient):
        res = client.get("/api/v1/courses", params={"year": 2026, "semester": 1})
        assert res.status_code == 200
        courses = res.json()
        for c in courses:
            assert c["year"] == 2026
            assert c["semester"] == 1

    def test_search_by_course_name(self, client: TestClient):
        res = client.get("/api/v1/courses", params={"q": "컴퓨터", "year": 2026, "semester": 1})
        assert res.status_code == 200
        courses = res.json()
        assert len(courses) > 0
        for c in courses:
            assert "컴퓨터" in c["course_name"]

    def test_search_by_professor_name(self, client: TestClient):
        res = client.get("/api/v1/courses", params={"q": "문의현", "year": 2026, "semester": 1})
        assert res.status_code == 200
        courses = res.json()
        assert len(courses) > 0

    def test_search_by_course_code(self, client: TestClient):
        res = client.get("/api/v1/courses", params={"q": "CSE2003", "year": 2026, "semester": 1})
        assert res.status_code == 200
        courses = res.json()
        assert len(courses) > 0
        for c in courses:
            assert "CSE2003" in c["course_code"]


class TestCourseDetail:
    def test_get_course_by_id(self, client: TestClient):
        # 먼저 목록에서 첫 번째 과목 ID 확인
        res = client.get("/api/v1/courses", params={"year": 2026, "semester": 1, "limit": 1})
        assert res.status_code == 200
        course_id = res.json()[0]["course_id"]

        res = client.get(f"/api/v1/courses/{course_id}")
        assert res.status_code == 200
        assert res.json()["course_id"] == course_id

    def test_get_course_not_found(self, client: TestClient):
        res = client.get("/api/v1/courses/99999999")
        assert res.status_code == 404
