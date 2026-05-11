# 보안 스캐너 통합 셋업 가이드

Jenkins CI 에 **Trivy + Snyk Code + OWASP ZAP** 세 스캐너를 연결해 결과를 **DefectDojo** 로 통합한다.
운영자가 `/admin/security` 페이지와 AI 채팅으로 한 곳에서 보안 현황을 볼 수 있는 게 목표.

```
[Trivy]      ──┐   dev push 마다
[Snyk Code]  ──┼──→ DefectDojo (163.239.77.65:8888) ──→ /admin/security 페이지 + AI 채팅
[ZAP]        ──┘   nightly cron
```

## 1. Snyk 토큰 발급 + Jenkins Credentials 등록

### 1-1. 토큰 발급 (무료 계정)

1. https://snyk.io 접속 → Sign up (GitHub 계정 연동 권장 — 무료)
2. 로그인 후 우측 상단 아바타 → **Account Settings**
3. 좌측 **General** → **Auth Token** 섹션 → **Click to show** 클릭
4. 40자 토큰 복사 (이후 다시 노출 안 됨, 메모해두기)

> 무료 티어 한도: **월 100 Snyk Code 테스트**. dev push 빈도가 그 이상이면 별도 트리거 조건 (예: PR open/sync 시만) 으로 조정 권장.

### 1-2. Jenkins Credentials 등록

1. Jenkins 좌측 메뉴 → **Manage Jenkins** → **Credentials**
2. (global) → **Add Credentials**
3. Kind: **Secret text**
4. Secret: 위 40자 토큰 붙여넣기
5. ID: **`snyk-token`** (정확히 — Jenkinsfile 이 이 ID 로 참조)
6. Description: "Snyk auth token (Snyk Code SAST)"
7. Create

확인: Credentials 목록에 `snyk-token (Snyk auth token (Snyk Code SAST))` 보이면 OK.

## 2. dev 빌드에 Snyk Code 가 자동으로 끼는지 확인

`feat/snyk-zap-integration` 브랜치가 dev 로 머지되면:
1. Jenkins SCM polling → dev 빌드 트리거
2. `Security Scan - Snyk Code (SAST)` 스테이지 실행
3. SARIF 결과를 DefectDojo 로 업로드 (`scan_type=SARIF`)
4. `/admin/security` 페이지에 SAST 카테고리 finding 등장

**Snyk Code 가 무엇을 잡나** (Trivy 가 못 보는 영역):
- SQL Injection 후보 (raw query 패턴)
- 위험한 `eval` / `subprocess shell=True`
- 약한 암호화 / 안전하지 않은 random
- 하드코딩된 비밀 (Trivy secret 보다 더 광범위)
- 인증 누락 가능성 (휴리스틱)

## 3. nightly ZAP 야간 스캔 — Jenkins job 등록

Jenkinsfile.zap 은 별도 Jenkins job 으로 등록한다 (dev 파이프라인과 분리).

### 3-1. 새 Pipeline job 만들기

1. Jenkins → **New Item**
2. Name: **`seoganpyo-nightly-zap`**
3. Type: **Pipeline**
4. OK

### 3-2. job 설정

- **General**: GitHub project 체크 → URL: `https://github.com/gibunijjaejo/Opensource_Project`
- **Build Triggers**:
  - **Build periodically** 체크 → 스케줄: `H 3 * * *`
    - 의미: 매일 새벽 3시대 (Jenkins 가 H 로 분 분산 — 부하 평탄화)
- **Pipeline**:
  - Definition: **Pipeline script from SCM**
  - SCM: **Git**
  - Repository URL: `https://github.com/gibunijjaejo/Opensource_Project`
  - Credentials: GitHub 접근용 (기존 dev 빌드 job 과 동일)
  - Branches to build: `*/dev`
  - **Script Path: `Jenkinsfile.zap`** ← 이게 핵심
- Save

### 3-3. 동작 확인

1. job 상세 페이지에서 **Build Now** 클릭 (수동 트리거)
2. 콘솔 로그 단계 확인:
   - `Start isolated backend` — 임시 `zapscan-backend-1` 컨테이너 기동
   - `ZAP Baseline Scan` — `zap-baseline.py` 5~10분 실행
   - `Upload ZAP to Defect Dojo` — `zap-baseline.json` 업로드
   - `always: docker compose down` — 임시 컨테이너 정리
3. 성공 시 Discord 에 알림
4. DefectDojo 에서 새 ZAP Scan test 가 보임 (`Engagement 1` 아래)

**ZAP baseline 이 무엇을 잡나** (실행 중 앱에 실제 HTTP 요청):
- 누락된 보안 헤더 (CSP, X-Frame-Options, X-Content-Type-Options 등)
- 안전하지 않은 쿠키 (Secure / HttpOnly 미설정)
- 클릭재킹 가능성
- CORS 정책 약점
- 정보 노출 (디버그 페이지, 에러 메시지 등)

> Active scan (실제 페이로드로 공격 시뮬) 은 baseline 보다 30분~몇 시간 걸려 — 이번에는 baseline 만. 필요시 별도 주간 job.

## 4. DefectDojo 측 — scan_type 인식 여부 확인

DefectDojo 가 다음 importer 를 인식하는지 한 번 점검 (한 번만):

1. http://163.239.77.65:8888 로그인
2. 좌측 메뉴 → **Findings** → **Import Scan Results**
3. **Scan type** 드롭다운에서 다음 이름이 보이는지:
   - `Trivy Scan` ✅ (이미 사용 중)
   - `SARIF` (Snyk Code 결과용)
   - `ZAP Scan`

세 가지 다 보이면 OK. 안 보이면 DefectDojo 버전이 너무 오래된 것 — 업그레이드 검토.

## 5. 발표·시연 시 강조 포인트

```
하나의 Engagement, 세 가지 시점
├── SCA (Trivy)        → 의존성 CVE     [dev push 마다]
├── SAST (Snyk Code)   → 코드 결함       [dev push 마다]
└── DAST (ZAP)         → 실행 중 앱 결함  [매일 야간]
       ↓
   DefectDojo 가 통합 (중복 제거 / mitigated 자동 처리)
       ↓
   /admin/security 페이지 + AI 채팅 사이드바
       (대시보드는 시각, 채팅은 자연어)
       (UI / 백엔드 / MCP 어댑터는 그대로 — 데이터만 풍부)
```

→ "스캐너를 늘려도 인터페이스는 그대로" 라는 확장 가능 아키텍처 메시지.

## 6. 트러블슈팅

| 증상 | 원인 후보 |
|------|----------|
| Snyk 스테이지 `401 Unauthorized` | `snyk-token` Credentials 미등록 또는 ID 오타 |
| Snyk 스테이지 결과 0건 | `--severity-threshold=high` 때문에 medium 이하 컷됨 (의도된 동작). high 안 잡혔으면 진짜 깨끗한 거 |
| ZAP `network 찾기 실패` | `zapscan-backend-1` 컨테이너가 안 떴음 — health check 로그 확인 |
| ZAP 스캔 시간 30분+ | active scan 활성화됐을 가능성 — `zap-baseline.py` 인지 확인 (full-scan 아닌) |
| DefectDojo 업로드 401 | `defectdojo-token` Credentials 만료 또는 잘못된 토큰 |
| 같은 finding 이 매 빌드 중복 등록 | `close_old_findings=true` 누락 — Jenkinsfile 점검 |
