# DefectDojo MCP 서버

Claude Desktop / Claude Code 에 등록해 자연어로 DefectDojo 보안 데이터를 조회하는 MCP 서버.
서간표 admin/security 페이지가 보는 것과 동일한 데이터를 LLM이 도구로 호출 가능.

## 노출 도구 (read-only, 5개)

| 도구 | 설명 |
|------|------|
| `get_security_summary` | 심각도·카테고리별 카운트 (페이지 상단 카드와 동일) |
| `list_findings` | finding 리스트 (`severity` / `category` / `limit` 필터) |
| `get_finding_detail` | 특정 finding의 description / mitigation / refs |
| `get_health` | DefectDojo 연결 상태 진단 |
| `compare_with_last_week` | 최근 7일 신규/mitigated finding 트렌드 |

## 설치

```bash
cd mcp-servers/defectdojo
python -m venv .venv
.venv\Scripts\activate         # Windows
# source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
```

## Claude Desktop 등록

설정 파일 위치:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

`mcpServers`에 다음 항목 추가:

```json
{
  "mcpServers": {
    "seoganpyo-defectdojo": {
      "command": "C:\\절대경로\\Opensource_Project\\mcp-servers\\defectdojo\\.venv\\Scripts\\python.exe",
      "args": ["C:\\절대경로\\Opensource_Project\\mcp-servers\\defectdojo\\server.py"],
      "env": {
        "DEFECTDOJO_URL": "http://163.239.77.65:8888",
        "DEFECTDOJO_TOKEN": "<DefectDojo API token 40자>",
        "DEFECTDOJO_ENGAGEMENT": "1"
      }
    }
  }
}
```

저장 후 Claude Desktop 재시작.

## Claude Code 등록

`~/.claude/settings.json` 또는 `.claude/settings.json`에 동일한 `mcpServers` 블록 추가.
또는 CLI:
```bash
claude mcp add seoganpyo-defectdojo \
  --env DEFECTDOJO_URL=http://163.239.77.65:8888 \
  --env DEFECTDOJO_TOKEN=<TOKEN> \
  --env DEFECTDOJO_ENGAGEMENT=1 \
  -- python /abs/path/to/mcp-servers/defectdojo/server.py
```

## 동작 확인

등록 후 새 세션에서 자연어 질의:

- "지금 보안 모니터링 요약 알려줘"
- "Critical 취약점만 보여줘"
- "finding 100번 상세 알려줘"
- "이번 주에 새로 잡힌 취약점 몇 건이야?"
- "DefectDojo 연결 상태 확인해줘"

LLM이 적절한 도구를 자동 호출하고 결과를 한국어로 요약해줌.

## 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `DEFECTDOJO_URL` | ✅ | DefectDojo base URL (예: `http://163.239.77.65:8888`) |
| `DEFECTDOJO_TOKEN` | ✅ | DefectDojo API v2 token (User → API v2 Key) |
| `DEFECTDOJO_ENGAGEMENT` | ✅ | 대상 Engagement ID (예: `1`) |

토큰은 절대 코드에 하드코딩하지 말고 설정 파일의 `env` 블록으로만 주입.

## 보안 모니터링 페이지와의 관계

| 항목 | admin/security 페이지 | 이 MCP 서버 |
|------|---------------------|-----------|
| 소비자 | 관리자(사람) | LLM (Claude 등) |
| Transport | HTTP REST | MCP stdio |
| 같은 데이터 출처 | DefectDojo API | DefectDojo API |
| 인증 | 관리자 토큰 + admin role | env의 DD_TOKEN |

같은 DefectDojo 데이터를 두 인터페이스로 노출. 페이지를 대체하는 게 아니라 보완.

## 한계 (현재 1단계)

- **Read-only**: mark_mitigated / accept_risk 같은 상태 변경 도구는 미구현 (2단계)
- **stdio만 지원**: HTTP transport는 운영 어시스턴트 통합 시 추가
- 도구 응답이 길어질 수 있음 → `limit` 파라미터로 조절
