# Changelog Writer Skill

## Description
태스크 완료 후 변경점을 자동으로 문서화하는 스킬입니다.

## When to use
- 태스크 완료 직후 자동 실행
- 수동 변경점 기록 요청

## Instructions
1. 변경 파일 확인
   - `git diff HEAD~1` 또는 `git status`
   - 변경된 파일 목록 추출

2. 변경 분석
   - 추가/수정/삭제 파일 분류
   - 라인 수 계산
   - 변경 유형 파악

3. CHANGELOG.md 업데이트
   - 날짜별 그룹
   - 타입별 분류 (Feature/Bugfix/Refactor)
   - 간략한 설명

4. 일별 상세 기록
   - changes/{날짜}.md
   - 태스크별 상세 정보
   - 프롬프트, diff 요약, 검증 결과

## Output Format

### CHANGELOG.md
```markdown
## 2025-12-30

### ✨ Features
- **기능명** (task-id)
  - 변경 파일 목록
  - +N lines

### 🐛 Bug Fixes
- **수정 내용** (task-id)
```

### changes/{date}.md
```markdown
# 2025-12-30 변경점

## task-001: 제목

### 프롬프트
> 원본 프롬프트

### 변경 파일
| 파일 | 추가 | 삭제 |
|------|------|------|

### 검증 결과
- ✅ test
- ✅ lint
```

## Automatic Execution
이 스킬은 태스크 완료 시 자동으로 실행됩니다.
