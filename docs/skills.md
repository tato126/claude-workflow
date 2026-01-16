# 스킬 가이드

스킬은 태스크 실행 시 Claude에게 전달되는 지침서입니다. 태스크 타입에 맞는 행동 가이드를 제공합니다.

## 스킬 위치

```
~/.claude/workflow/skills/     # 글로벌 스킬
project/docs/skills/           # 프로젝트별 스킬 (우선 적용)
```

프로젝트별 스킬이 있으면 글로벌 스킬보다 우선 사용됩니다.

## 기본 제공 스킬

### feature.md
새 기능 개발용. 요구사항 분석, 기존 패턴 준수, 타입 정의, 에러 핸들링 가이드.

### bugfix.md
버그 수정용. 에러 분석, 원인 파악, 최소 범위 수정, 루트 원인 해결 가이드.

### refactor.md
리팩토링용. 동작 유지, 단계별 수정, 코드 품질 개선 가이드.

### test-writer.md
테스트 작성용. 테스트 구조, 커버리지, 엣지 케이스 가이드.

### code-review.md
코드 리뷰용. 리뷰 체크리스트, 피드백 형식 가이드.

### changelog.md
변경 로그 작성용. 버전 관리, 커밋 메시지 형식 가이드.

## 스킬 파일 형식

```markdown
# Skill Name

## Description
스킬의 목적과 용도 설명.

## When to use
- 이 스킬을 사용해야 하는 상황 1
- 상황 2
- 상황 3

## Instructions
1. 첫 번째 단계
   - 세부 지침 1
   - 세부 지침 2

2. 두 번째 단계
   - 세부 지침

## Conventions
- 따라야 할 규칙 1
- 규칙 2

## Output
- 예상 산출물 1
- 산출물 2
```

## 커스텀 스킬 작성

### 1. 글로벌 스킬 추가

```bash
# 새 스킬 파일 생성
vim ~/.claude/workflow/skills/my-skill.md
```

### 2. 프로젝트별 스킬 추가

```bash
# 프로젝트 스킬 디렉토리 생성 (자동 생성됨)
mkdir -p project/docs/skills

# 스킬 파일 생성
vim project/docs/skills/my-skill.md
```

### 3. 태스크에서 사용

Jira에서 이슈 생성 시:
- skill 커스텀 필드에서 스킬 선택
- 또는 비워두면 기본 프롬프트만 사용

## 스킬 활용 예시

### 프로젝트별 코딩 컨벤션

```markdown
# project-conventions

## Description
프로젝트 고유 코딩 컨벤션.

## Instructions
1. 파일 구조
   - 컴포넌트: src/components/{ComponentName}/index.tsx
   - 훅: src/hooks/use{HookName}.ts
   - 유틸: src/utils/{utilName}.ts

2. 네이밍
   - 컴포넌트: PascalCase
   - 함수: camelCase
   - 상수: UPPER_SNAKE_CASE

3. 임포트 순서
   - 외부 라이브러리
   - 내부 모듈
   - 상대 경로

## Conventions
- 절대 any 사용 금지
- console.log 금지 (logger 사용)
- 매직 넘버 금지 (상수화)
```

### API 개발 스킬

```markdown
# api-development

## Description
REST API 엔드포인트 개발 가이드.

## Instructions
1. 라우트 정의
   - RESTful 규칙 준수
   - 버저닝 적용 (v1/v2)

2. 요청 처리
   - DTO 정의
   - 입력 검증 (zod/class-validator)

3. 응답 형식
   - 성공: { data: ... }
   - 실패: { error: { code, message } }

4. 에러 처리
   - 비즈니스 에러와 시스템 에러 구분
   - 적절한 HTTP 상태 코드

## Conventions
- 모든 엔드포인트 JSDoc 문서화
- 요청/응답 타입 명시
```

### 데이터베이스 마이그레이션 스킬

```markdown
# db-migration

## Description
안전한 DB 마이그레이션 가이드.

## Instructions
1. 스키마 변경
   - 하위 호환성 유지
   - 롤백 계획 수립

2. 데이터 마이그레이션
   - 배치 처리로 부하 분산
   - 프로그레스 로깅

3. 인덱스
   - 쿼리 패턴 분석
   - 불필요 인덱스 정리

## Principles
- 무중단 마이그레이션
- 테스트 환경 선 검증
- 롤백 가능 상태 유지
```

## 스킬 적용 흐름

```
1. 태스크 생성 시 스킬 선택

2. 데몬이 태스크 실행 시:
   ┌─────────────────────────────────────┐
   │  project/docs/skills/{skill}.md    │  ← 먼저 확인
   │            ↓ (없으면)              │
   │  ~/.claude/workflow/skills/{skill}.md  │
   └─────────────────────────────────────┘

3. 스킬 내용 + 프롬프트 + 출력 경로 지시 결합

4. Claude Code에 전달
```

## 팁

1. **구체적으로 작성**: 모호한 지침보다 명확한 단계별 가이드
2. **예시 포함**: 코드 예시나 형식 예시 포함
3. **프로젝트 맞춤화**: 글로벌 스킬을 기반으로 프로젝트별 오버라이드
4. **버전 관리**: 스킬 파일도 git으로 관리
