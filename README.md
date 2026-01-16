# Claude Workflow Automation

Claude Code를 활용한 자동화 워크플로우 시스템. 태스크 큐 기반으로 개발 작업을 자동 실행하고 검증합니다.

## 구성 요소

```
~/.claude/workflow/
├── daemon/          # 백그라운드 태스크 실행기
├── web/             # Next.js 대시보드 UI
├── cli/             # 커맨드라인 도구
├── skills/          # 글로벌 스킬 정의
├── data/            # 설정 및 레지스트리
└── docs/            # 문서
```

## 빠른 시작

### 1. 데몬 시작

```bash
~/.claude/workflow/start.sh
```

### 2. Web UI 실행

```bash
cd ~/.claude/workflow/web
npm run dev
```

http://localhost:3000 에서 대시보드 접근

### 3. 프로젝트 등록

Web UI에서 "프로젝트 추가" 또는:

```bash
# data/registry.json에 직접 추가
{
  "projects": [
    { "name": "my-project", "path": "/path/to/project", "addedAt": "..." }
  ]
}
```

### 4. 태스크 생성

Web UI에서 태스크 생성:
- 프롬프트 입력
- 타입 선택 (feature, bugfix, refactor, test, docs, design, api)
- 스킬 선택 (선택사항)

## 태스크 워크플로우

```
[todo] → [progress] → [review] → [done]
                  ↓
              [failed]
```

1. **todo**: 대기 중
2. **progress**: 실행 중 (Claude Code)
3. **review**: 검증 완료, 리뷰 대기
4. **done**: 완료
5. **failed**: 실패 (재시도 초과)

## 자동 검증

프로젝트 타입에 따라 자동으로 검증 수행:

| 프로젝트 | 감지 파일 | 빌드 | 테스트 |
|---------|----------|------|--------|
| Node.js | package.json | npm run build | npm test |
| Java/Gradle | build.gradle | ./gradlew build | ./gradlew test |
| Java/Maven | pom.xml | mvn package | mvn test |
| Python | pytest.ini/pyproject.toml | - | pytest |
| Go | go.mod | go build | go test |
| Rust | Cargo.toml | cargo build | cargo test |
| C/C++ | Makefile | make | make test |

모든 태스크에 Codex 리뷰 자동 실행.

## 문서 자동화

태스크 완료 시 `project/docs/`에 자동 생성:

```
project/docs/
├── daily/           # 일별 작업 내용
├── changes/         # 일별 변경 파일 목록
├── tasks/           # 성공한 태스크 상세
├── failed/          # 실패한 태스크 상세
├── design/          # 설계 문서 (design 타입)
├── features/        # 기능 문서 (feature 타입)
├── bugs/            # 버그 문서 (bugfix 타입)
└── CHANGELOG.md     # 메인 변경 로그
```

## 실시간 로그

태스크 실행 중 Web UI에서 실시간 로그 확인:
- 태스크 상세 모달 → "실시간" 탭
- 2초 간격 자동 갱신

## 스킬 시스템

스킬은 태스크 실행 시 Claude에게 전달되는 지침:

```
~/.claude/workflow/skills/    # 글로벌 스킬
project/docs/skills/          # 프로젝트별 스킬 (우선)
```

## 추가 문서

- [아키텍처](docs/architecture.md)
- [API 문서](docs/api.md)
- [설정 가이드](docs/configuration.md)
- [스킬 가이드](docs/skills.md)
