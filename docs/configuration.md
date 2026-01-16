# 설정 가이드

## 설정 파일 위치

```
~/.claude/workflow/data/config.json
```

## 전체 설정

```json
{
  "daemon": {
    "pollInterval": 5000,
    "maxConcurrent": 1,
    "autoStart": true
  },
  "defaults": {
    "validation": ["test", "lint"],
    "retryMax": 3
  },
  "review": {
    "enabled": true,
    "autoApprove": false,
    "requireComment": false
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

## 섹션별 설명

### daemon

데몬 동작 설정.

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| pollInterval | number | 5000 | 큐 확인 간격 (ms) |
| maxConcurrent | number | 1 | 동시 실행 태스크 수 (현재 1만 지원) |
| autoStart | boolean | true | 시스템 시작 시 자동 실행 |

**pollInterval 권장값:**
- 빠른 반응: 2000 (2초)
- 일반: 5000 (5초)
- 저부하: 10000 (10초)

### defaults

새 태스크 기본값. (현재 validation은 자동 감지로 대체)

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| validation | string[] | ["test", "lint"] | (사용 안 함) 기본 검증 |
| retryMax | number | 3 | 최대 재시도 횟수 |

### review

리뷰 워크플로우 설정.

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| enabled | boolean | true | 리뷰 단계 활성화 |
| autoApprove | boolean | false | 자동 승인 |
| requireComment | boolean | false | 리뷰 코멘트 필수 |

**리뷰 흐름:**
- `enabled: true` → 검증 성공 시 `review` 상태로 이동
- `enabled: false` → 검증 성공 시 바로 `done` 상태로 이동

### notifications

알림 설정.

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| enabled | boolean | true | 알림 활성화 |
| methods | string[] | ["macos"] | 알림 방법 |
| sound | boolean | true | 알림음 재생 |

**지원 methods:**
- `macos` - macOS 기본 알림 센터

### claudeCode

Claude Code CLI 설정.

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| flags | string[] | ["--print", "--dangerously-skip-permissions"] | CLI 플래그 |

**권장 flags:**
- `--print` - 출력 모드 (필수)
- `--dangerously-skip-permissions` - 권한 확인 스킵 (자동화에 필요)

**선택적 flags:**
- `--model sonnet` - 모델 지정
- `--max-turns 10` - 최대 턴 수 제한

## 프로젝트 레지스트리

```
~/.claude/workflow/data/registry.json
```

```json
{
  "projects": [
    {
      "name": "my-project",
      "path": "/path/to/project",
      "addedAt": "2025-12-30T12:00:00.000Z"
    }
  ]
}
```

| 필드 | 설명 |
|------|------|
| name | 표시 이름 |
| path | 절대 경로 |
| addedAt | 등록 시간 (ISO 8601) |

## 환경별 권장 설정

### 개발 환경 (빠른 피드백)

```json
{
  "daemon": {
    "pollInterval": 2000
  },
  "review": {
    "enabled": false
  },
  "notifications": {
    "enabled": true,
    "sound": true
  }
}
```

### 운영 환경 (안정성 우선)

```json
{
  "daemon": {
    "pollInterval": 10000
  },
  "defaults": {
    "retryMax": 5
  },
  "review": {
    "enabled": true,
    "requireComment": true
  }
}
```

### 저사양 환경

```json
{
  "daemon": {
    "pollInterval": 30000
  },
  "notifications": {
    "enabled": false
  }
}
```

## 설정 변경 적용

설정 파일 수정 후 데몬 재시작:

```bash
~/.claude/workflow/stop.sh
~/.claude/workflow/start.sh
```

또는:

```bash
kill $(cat ~/.claude/workflow/daemon.lock)
~/.claude/workflow/start.sh
```
