# 아키텍처

## 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        Web UI (Next.js)                     │
│  - 프로젝트 관리                                              │
│  - 태스크 CRUD                                               │
│  - 실시간 로그 뷰어                                           │
│  - 칸반 보드                                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP API
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      Daemon (Node.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Queue   │  │ Executor │  │Validator │  │Changelog │   │
│  │ Manager  │→ │          │→ │          │→ │ Generator│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│        ↑                                                    │
│        │ Polling (5s)                                       │
└────────┼────────────────────────────────────────────────────┘
         │
┌────────┴────────────────────────────────────────────────────┐
│                     Data Layer                              │
│  ~/.claude/workflow/data/                                   │
│    ├── config.json      # 데몬 설정                          │
│    └── registry.json    # 프로젝트 목록                       │
│                                                             │
│  project/.claude/tasks/                                     │
│    └── queue.json       # 태스크 큐 (프로젝트별)               │
└─────────────────────────────────────────────────────────────┘
```

## 컴포넌트 상세

### Daemon

싱글톤 백그라운드 프로세스. Lock 파일로 중복 실행 방지.

**모듈:**
- `index.ts` - 메인 루프, 시그널 핸들링
- `queue.ts` - 큐 읽기/쓰기, 상태 업데이트
- `executor.ts` - Claude Code 실행, 실시간 로그 스트리밍
- `validator.ts` - 프로젝트 감지, 빌드/테스트 실행
- `changelog.ts` - 문서 자동 생성
- `notifier.ts` - macOS 알림
- `logger.ts` - 로깅

**실행 흐름:**
```
1. pollInterval(5s)마다 getAllTodoTasks() 호출
2. todo 태스크 발견 시:
   - status → progress
   - executeTask() - Claude Code 실행
   - validateTask() - 빌드/테스트/리뷰
   - generateChangelog() - 문서 생성
   - status → review/done/failed
3. 알림 전송
```

### Web UI

Next.js 14 App Router 기반 대시보드.

**주요 컴포넌트:**
- `Dashboard` - 메인 칸반 보드
- `TaskForm` - 태스크 생성 폼
- `TaskCard` - 태스크 카드 (드래그 지원)
- `TaskDetailModal` - 상세 보기, 실시간 로그

**API Routes:**
- `GET/POST /api/tasks` - 태스크 CRUD
- `PATCH /api/tasks/[id]` - 상태 변경
- `GET /api/tasks/logs` - 실시간 로그
- `GET /api/daemon` - 데몬 상태
- `GET/POST /api/projects` - 프로젝트 관리

### 데이터 흐름

```
[Web UI] ──POST /api/tasks──→ [queue.json] ←──polling── [Daemon]
                                   │
                                   ▼
                           Claude Code 실행
                                   │
                                   ▼
                         프로젝트 자동 검증
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
         docs/tasks/          docs/daily/         docs/failed/
         (성공 태스크)          (일별 작업)          (실패 태스크)
```

## 파일 시스템 구조

### 글로벌 (워크플로우)

```
~/.claude/workflow/
├── daemon.lock          # 데몬 PID (싱글톤)
├── daemon.log           # 데몬 로그
├── start.sh             # 시작 스크립트
├── stop.sh              # 종료 스크립트
├── data/
│   ├── config.json      # 설정
│   └── registry.json    # 프로젝트 목록
├── skills/              # 글로벌 스킬
│   ├── feature.md
│   ├── bugfix.md
│   └── ...
├── daemon/              # 데몬 소스
└── web/                 # Web UI 소스
```

### 프로젝트별

```
project/
├── .claude/
│   ├── tasks/
│   │   ├── queue.json   # 태스크 큐
│   │   └── archive/     # 완료된 태스크 아카이브
│   └── logs/
│       └── {task-id}/
│           ├── prompt.txt    # 실행 프롬프트
│           ├── output.txt    # Claude 출력
│           ├── live.log      # 실시간 로그
│           └── result.json   # 결과 요약
└── docs/
    ├── daily/           # 일별 작업 내용
    ├── changes/         # 일별 변경 목록
    ├── tasks/           # 성공 태스크 문서
    ├── failed/          # 실패 태스크 문서
    ├── design/          # 설계 문서
    ├── features/        # 기능 문서
    ├── bugs/            # 버그 문서
    ├── skills/          # 프로젝트별 스킬
    └── CHANGELOG.md     # 메인 변경 로그
```

## 확장성

### 새 검증 타입 추가

`validator.ts`의 `detectProject()` 함수에 추가:

```typescript
if (existsSync(join(projectPath, 'your-config-file'))) {
  return {
    language: 'your-lang',
    buildCommand: ['your', 'build', 'cmd'],
    testCommand: ['your', 'test', 'cmd'],
    hasTests: true
  };
}
```

### 새 스킬 추가

`~/.claude/workflow/skills/` 또는 `project/docs/skills/`에 마크다운 파일 추가.

### 새 알림 방법 추가

`notifier.ts`에 새 notification method 구현.
