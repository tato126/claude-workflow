# Claude Workflow Automation

Jira Cloud와 Claude Code를 연동한 태스크 자동화 시스템. Jira 이슈를 자동으로 감지하여 Claude Code로 실행하고 결과를 Jira에 업데이트합니다.

## 구성 요소

```
~/.claude/workflow/
├── daemon/          # Jira 연동 데몬 (polling + 실행)
├── cli/             # 커맨드라인 도구
├── skills/          # 스킬 정의
├── data/            # 설정 파일
└── docs/            # 문서
```

## 동작 흐름

```
Jira 이슈 생성 (To claude)
        │
        ▼ polling (10s)
   Daemon 감지
        │
        ▼
  Claude Code 실행
        │
        ▼
   자동 검증 (build/test)
        │
        ▼
  Jira 상태 업데이트 + 댓글
```

## 빠른 시작

### 1. 환경 설정

```bash
cp .env.example .env
# .env 파일 편집 - Jira 인증 정보 입력

cp data/jira-config.example.json data/jira-config.json
# jira-config.json 편집 - Jira 프로젝트 설정
```

### 2. 의존성 설치 및 빌드

```bash
cd daemon
npm install
npm run build
```

### 3. 데몬 시작

```bash
~/.claude/workflow/start.sh
```

### 4. Jira에서 이슈 생성

- 상태를 "To claude"로 설정
- 프롬프트 필드에 작업 내용 입력
- 데몬이 자동으로 감지하여 실행

## Jira 설정

### 필요한 커스텀 필드

| 필드명 | 용도 |
|--------|------|
| prompt | Claude에게 전달할 작업 내용 |
| skill | 사용할 스킬 (선택) |
| projectPath | 대상 프로젝트 경로 (선택) |

### 워크플로우 상태

```
To claude → In Progress → In review → Done
                              ↓
                           (failed)
```

## 자동 검증

프로젝트 타입에 따라 자동 실행:

| 프로젝트 | 감지 파일 | 빌드 | 테스트 |
|---------|----------|------|--------|
| Node.js | package.json | npm run build | npm test |
| Java/Gradle | build.gradle | ./gradlew build | ./gradlew test |
| Java/Maven | pom.xml | mvn package | mvn test |
| Python | pytest.ini | - | pytest |
| Go | go.mod | go build | go test |

## 스킬 시스템

```
~/.claude/workflow/skills/    # 글로벌 스킬
├── tdd.md                    # TDD 방식 개발
├── code-review.md            # 코드 리뷰
├── bugfix.md                 # 버그 수정
├── feature.md                # 기능 개발
├── refactor.md               # 리팩토링
└── ...

project/docs/skills/          # 프로젝트별 스킬 (우선)
```

## 추가 문서

- [아키텍처](docs/architecture.md)
- [API 문서](docs/api.md)
- [설정 가이드](docs/configuration.md)
- [스킬 가이드](docs/skills.md)
