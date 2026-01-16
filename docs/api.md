# API 문서

Web UI가 제공하는 REST API 엔드포인트.

Base URL: `http://localhost:3000/api`

## 태스크 API

### GET /api/tasks

프로젝트의 태스크 목록 조회.

**Query Parameters:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| project | O | 프로젝트 경로 |

**Response:**
```json
{
  "project": "/path/to/project",
  "tasks": [
    {
      "id": "task-1735555123456-abc123",
      "title": "사용자 인증 기능 추가",
      "prompt": "JWT 기반 로그인 구현",
      "type": "feature",
      "status": "todo",
      "retry": { "max": 3, "current": 0 },
      "createdAt": "2025-12-30T12:00:00.000Z"
    }
  ]
}
```

### POST /api/tasks

새 태스크 생성.

**Request Body:**
```json
{
  "project": "/path/to/project",
  "task": {
    "prompt": "사용자 인증 기능 구현",
    "type": "feature",
    "skill": "feature"
  }
}
```

**Response:**
```json
{
  "id": "task-1735555123456-abc123",
  "title": "사용자 인증 기능 구현",
  "prompt": "사용자 인증 기능 구현",
  "type": "feature",
  "skill": "feature",
  "status": "todo",
  "retry": { "max": 3, "current": 0 },
  "createdAt": "2025-12-30T12:00:00.000Z"
}
```

### PATCH /api/tasks/[id]

태스크 상태 변경.

**Path Parameters:**
| 파라미터 | 설명 |
|---------|------|
| id | 태스크 ID |

**Query Parameters:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| project | O | 프로젝트 경로 |

**Request Body:**
```json
{
  "status": "done"
}
```

**Response:**
```json
{
  "success": true
}
```

### DELETE /api/tasks/[id]

태스크 삭제.

**Path Parameters:**
| 파라미터 | 설명 |
|---------|------|
| id | 태스크 ID |

**Query Parameters:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| project | O | 프로젝트 경로 |

**Response:**
```json
{
  "success": true
}
```

## 로그 API

### GET /api/tasks/logs

실시간 로그 조회.

**Query Parameters:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| project | O | 프로젝트 경로 |
| taskId | O | 태스크 ID |

**Response:**
```json
{
  "exists": true,
  "content": "# Task: 사용자 인증\n# Started: 2025-12-30 12:00:00\n\n실행 로그...",
  "size": 1234,
  "fullContent": "..."
}
```

## 프로젝트 API

### GET /api/projects

등록된 프로젝트 목록 조회.

**Response:**
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

### POST /api/projects

새 프로젝트 등록.

**Request Body:**
```json
{
  "name": "my-project",
  "path": "/path/to/project"
}
```

**Response:**
```json
{
  "success": true,
  "project": {
    "name": "my-project",
    "path": "/path/to/project",
    "addedAt": "2025-12-30T12:00:00.000Z"
  }
}
```

### DELETE /api/projects

프로젝트 등록 해제.

**Query Parameters:**
| 파라미터 | 필수 | 설명 |
|---------|------|------|
| path | O | 프로젝트 경로 |

**Response:**
```json
{
  "success": true
}
```

## 데몬 API

### GET /api/daemon

데몬 상태 조회.

**Response:**
```json
{
  "running": true,
  "pid": 12345
}
```

또는 (중지 상태):
```json
{
  "running": false
}
```

## 타입 정의

### TaskStatus

```typescript
type TaskStatus = 'todo' | 'progress' | 'review' | 'done' | 'failed';
```

### TaskType

```typescript
type TaskType = 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'design' | 'api';
```

### Task

```typescript
interface Task {
  id: string;
  title: string;
  prompt: string;
  type: TaskType;
  skill?: string;
  status: TaskStatus;
  retry: {
    max: number;
    current: number;
  };
  lastError?: string;
  feedback?: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: TaskResult;
}
```

### TaskResult

```typescript
interface TaskResult {
  success: boolean;
  duration: number;
  changedFiles: ChangedFile[];
  validation: ValidationResult;
  logs: string[];
}
```

## 에러 응답

모든 API는 에러 시 다음 형식으로 응답:

```json
{
  "error": "에러 메시지"
}
```

HTTP 상태 코드:
- `400` - 잘못된 요청 (필수 파라미터 누락 등)
- `404` - 리소스 없음
- `500` - 서버 에러
