# 아키텍처

## 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      Jira Cloud                             │
│  - 이슈 생성/관리                                             │
│  - 커스텀 필드 (prompt, skill, projectPath)                   │
│  - 워크플로우 상태 관리                                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API (polling 10s)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      Daemon (Node.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Jira    │  │ Executor │  │Validator │  │  Jira    │   │
│  │  Poller  │→ │          │→ │          │→ │ Updater  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Target Project                            │
│  - Claude Code 실행                                          │
│  - 빌드/테스트 검증                                           │
│  - 로그 저장                                                 │
└─────────────────────────────────────────────────────────────┘
```

## 컴포넌트 상세

### Daemon

싱글톤 백그라운드 프로세스. Lock 파일로 중복 실행 방지.

**Jira 모듈:**
- `jira/poller.ts` - Jira 이슈 polling, "To claude" 상태 감지
- `jira/mapper.ts` - Jira 이슈 → 내부 태스크 변환
- `jira/updater.ts` - 실행 결과 Jira에 업데이트
- `jira/comment-builder.ts` - Jira 댓글 포맷팅
- `jira/client.ts` - Jira REST API 클라이언트

**실행 모듈:**
- `executor.ts` - Claude Code 실행, 실시간 로그 스트리밍
- `validator.ts` - 프로젝트 감지, 빌드/테스트 실행
- `changelog.ts` - 문서 자동 생성
- `notifier.ts` - macOS 알림
- `logger.ts` - 로깅

**실행 흐름:**
```
1. pollInterval(10s)마다 Jira API 호출
2. "To claude" 상태 이슈 발견 시:
   - Jira 상태 → "In Progress"
   - Claude Code 실행
   - 빌드/테스트 검증
   - 문서 생성
   - Jira 상태 → "In review" / "Done"
   - Jira 댓글로 결과 보고
3. macOS 알림 전송
```

### 데이터 흐름

```
[Jira Issue]
     │
     │ "To claude" 상태
     ▼
[Poller] ──→ [Mapper] ──→ [Executor] ──→ [Validator]
                               │              │
                               ▼              ▼
                          Claude Code    Build/Test
                               │              │
                               └──────┬───────┘
                                      ▼
                               [Jira Updater]
                                      │
                        ┌─────────────┼─────────────┐
                        ▼             ▼             ▼
                    상태 변경      댓글 추가     문서 생성
```

## 파일 시스템 구조

### 글로벌 (워크플로우)

```
~/.claude/workflow/
├── daemon.lock          # 데몬 PID (싱글톤)
├── daemon.log           # 데몬 로그
├── start.sh             # 시작 스크립트
├── stop.sh              # 종료 스크립트
├── .env                 # Jira 인증 정보
├── data/
│   ├── config.json      # 설정
│   └── jira-config.json # Jira 연동 설정
├── skills/              # 글로벌 스킬
│   ├── feature.md
│   ├── bugfix.md
│   └── ...
└── daemon/              # 데몬 소스
```

### 프로젝트별

```
project/
├── .claude/
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

## Jira 설정

### 커스텀 필드

| 필드명 | 타입 | 용도 |
|--------|------|------|
| prompt | Text (multi-line) | Claude에게 전달할 작업 내용 |
| skill | Select | 사용할 스킬 선택 |
| projectPath | Text | 대상 프로젝트 경로 (기본값 사용 가능) |

### 워크플로우 상태

| 상태 | 설명 |
|------|------|
| To claude | 데몬이 감지하는 트리거 상태 |
| In Progress | 실행 중 |
| In review | 완료, 리뷰 대기 |
| Done | 최종 완료 |

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
