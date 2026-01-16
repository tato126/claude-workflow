# 설정 가이드

## 설정 파일

```
~/.claude/workflow/
├── .env                      # Jira 인증 정보
├── data/
│   ├── config.json           # 데몬 설정
│   └── jira-config.json      # Jira 연동 설정
```

## Jira 인증 설정 (.env)

```bash
cp .env.example .env
```

```env
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token-here
```

API 토큰 발급: https://id.atlassian.com/manage-profile/security/api-tokens

## Jira 연동 설정 (jira-config.json)

```bash
cp data/jira-config.example.json data/jira-config.json
```

```json
{
  "enabled": true,
  "baseUrl": "https://your-domain.atlassian.net",
  "projectKey": "YOUR_PROJECT_KEY",
  "pollInterval": 10000,
  "defaultProjectPath": "/path/to/your/project",
  "statuses": {
    "trigger": "To claude",
    "processing": "In Progress",
    "review": "In review",
    "done": "Done",
    "failed": "In review"
  },
  "customFields": {
    "skill": "customfield_XXXXX",
    "prompt": "customfield_XXXXX",
    "projectPath": "customfield_XXXXX"
  }
}
```

### Jira 설정 항목

| 옵션 | 타입 | 설명 |
|------|------|------|
| enabled | boolean | Jira 연동 활성화 |
| baseUrl | string | Jira Cloud URL |
| projectKey | string | 대상 프로젝트 키 (예: "PROJ") |
| pollInterval | number | 이슈 확인 간격 (ms) |
| defaultProjectPath | string | 기본 프로젝트 경로 |

### 워크플로우 상태 매핑

| 옵션 | 설명 |
|------|------|
| trigger | 데몬이 감지하는 트리거 상태 |
| processing | 실행 중 상태 |
| review | 완료 후 리뷰 대기 |
| done | 최종 완료 |
| failed | 실패 시 이동할 상태 |

### 커스텀 필드 ID 확인 방법

1. Jira 이슈 페이지에서 개발자 도구 열기 (F12)
2. Network 탭에서 이슈 API 호출 확인
3. 또는 Jira REST API로 직접 조회:
   ```bash
   curl -u email:token "https://your-domain.atlassian.net/rest/api/3/field"
   ```

## 데몬 설정 (config.json)

```json
{
  "daemon": {
    "pollInterval": 5000,
    "maxConcurrent": 1,
    "autoStart": true
  },
  "defaults": {
    "retryMax": 3
  },
  "review": {
    "enabled": true,
    "autoApprove": false
  },
  "notifications": {
    "enabled": true,
    "methods": ["macos"],
    "sound": true
  },
  "claudeCode": {
    "flags": ["--print", "--dangerously-skip-permissions"]
  }
}
```

### 섹션별 설명

#### daemon

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| pollInterval | number | 5000 | 큐 확인 간격 (ms) |
| maxConcurrent | number | 1 | 동시 실행 태스크 수 |
| autoStart | boolean | true | 시스템 시작 시 자동 실행 |

#### review

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| enabled | boolean | true | 리뷰 단계 활성화 |
| autoApprove | boolean | false | 자동 승인 |

#### notifications

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| enabled | boolean | true | 알림 활성화 |
| methods | string[] | ["macos"] | 알림 방법 |
| sound | boolean | true | 알림음 재생 |

#### claudeCode

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| flags | string[] | ["--print", "--dangerously-skip-permissions"] | CLI 플래그 |

**권장 flags:**
- `--print` - 출력 모드 (필수)
- `--dangerously-skip-permissions` - 권한 확인 스킵 (자동화에 필요)

**선택적 flags:**
- `--model sonnet` - 모델 지정
- `--max-turns 10` - 최대 턴 수 제한

## 환경별 권장 설정

### 개발 환경 (빠른 피드백)

```json
// jira-config.json
{
  "pollInterval": 5000
}

// config.json
{
  "review": { "enabled": false },
  "notifications": { "enabled": true, "sound": true }
}
```

### 운영 환경 (안정성 우선)

```json
// jira-config.json
{
  "pollInterval": 30000
}

// config.json
{
  "defaults": { "retryMax": 5 },
  "review": { "enabled": true }
}
```

## 설정 변경 적용

설정 파일 수정 후 데몬 재시작:

```bash
~/.claude/workflow/stop.sh
~/.claude/workflow/start.sh
```
