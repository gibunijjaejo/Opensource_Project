# vX.Y.Z — <릴리스 한 줄 요약>

> 비교: v<이전> → v<이번>
> 릴리스 날짜: YYYY-MM-DD

<!-- 한 문단으로 이번 릴리스의 핵심 가치/방향을 적어주세요. 사용자 관점에서 무엇이 달라지는지. -->

## 새 기능 (Features)

<!-- 도메인 단위로 묶어 작성. 사용자가 체감하는 변화 위주. PR 번호는 끝에 (#123) -->

### <영역 1: 예) 강의/시간표>
- 기능 A 설명 (#PR)
- 기능 B 설명 (#PR)

### <영역 2: 예) 관리자>
- 기능 C 설명 (#PR)

### <영역 3: 예) 인프라/관측>
- 기능 D 설명 (#PR)

## 개선 (Improvements)

<!-- 기존 기능의 UX/성능/안정성 개선 -->
- 개선 항목 1 (#PR)
- 개선 항목 2 (#PR)

## 버그 수정 (Fixes)

- 수정 항목 1 (#PR)
- 수정 항목 2 (#PR)

## UX / 디자인

- 디자인 변경 1
- 디자인 변경 2

## 인프라 / DX

- 빌드/배포/개발환경 변경 1
- 빌드/배포/개발환경 변경 2

## Breaking Changes

<!-- 사용자/운영자가 반드시 인지해야 할 호환성 깨지는 변경. 없으면 "없음"이라고 명시 -->
- **<변경 제목>**: 어떤 게 어떻게 바뀌는지, 왜 호환되지 않는지

### 새/변경된 환경변수
- `NEW_VAR` (필수): 설명
- `OPTIONAL_VAR` (선택, 기본값): 설명

### 제거된 기능
- 기능 X — 대체: 기능 Y

## 마이그레이션 가이드

<!-- 업그레이드할 때 반드시 실행해야 할 작업. 없으면 "별도 조치 불필요" -->

### DB 스키마
```sql
-- 예시
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_col BOOLEAN NOT NULL DEFAULT TRUE;
```

### 데이터/파일 경로
- 변경 항목 (또는 "변경 없음")

### 의존성
```bash
# 예시
pip install -r requirements.txt
pnpm install
```

## 보안

<!-- 보안 관련 변경, CVE 패치, 권한 정책 변경 등. 해당 없으면 섹션 삭제 -->
- 항목 1

## 문서

- 추가/갱신된 문서 링크

## Contributors

<!-- gh release create 시 자동 첨부될 수도 있으니 중복 시 삭제 -->
- @username1 — 작업 내용
- @username2 — 작업 내용

## 통계

- N commits, M PRs (#xx ~ #yy)
- 신규 페이지 N개
- 새 API 엔드포인트 N개

---

**전체 변경 이력**: https://github.com/<owner>/<repo>/compare/v<이전>...v<이번>
**Docker 이미지**: `<registry>/<image>:vX.Y.Z`
