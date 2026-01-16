# Documentation Skill

## Description
기술 문서를 작성하고 관리하는 스킬입니다.

## When to use
- README 작성/갱신
- API 문서화
- 사용 가이드 작성
- 아키텍처 문서화
- 주석/JSDoc 추가

## Instructions
1. 대상 파악
   - 독자 수준 (개발자/사용자/관리자)
   - 문서 목적 (튜토리얼/레퍼런스/가이드)

2. 구조 설계
   - 논리적 흐름
   - 섹션 구분
   - 목차 구성

3. 내용 작성
   - 명확하고 간결한 문장
   - 코드 예시 포함
   - 시각 자료 활용

4. 검토
   - 정확성 확인
   - 최신 상태 유지
   - 링크 검증

## Document Types

### README.md
```markdown
# 프로젝트명

간단한 설명 (1-2문장)

## 기능
- 기능 1
- 기능 2

## 설치
\`\`\`bash
npm install
\`\`\`

## 사용법
\`\`\`bash
npm run start
\`\`\`

## 설정
환경 변수 또는 설정 파일 설명

## 라이선스
MIT
```

### API 문서
```markdown
# API Reference

## Endpoints

### GET /users
사용자 목록 조회

**Parameters:**
| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| page | number | X | 페이지 번호 |

**Response:**
\`\`\`json
{
  "data": [{ "id": 1, "name": "..." }]
}
\`\`\`
```

### 튜토리얼
```markdown
# [주제] 튜토리얼

## 목표
이 튜토리얼을 완료하면 ...

## 사전 요구사항
- Node.js 18+
- ...

## Step 1: 환경 설정
...

## Step 2: 기본 구현
...

## 다음 단계
- 심화 학습 링크
```

## Conventions
- 마크다운 형식 사용
- 코드 블록에 언어 명시
- 상대 경로 링크 사용
- 이미지는 상대 경로 또는 CDN

## Output
- 마크다운 문서
- 필요 시 다이어그램 (Mermaid)
- 코드 예시
