# API Development Skill

## Description
REST/GraphQL API를 설계하고 구현하는 스킬입니다.

## When to use
- API 엔드포인트 개발
- API 문서화
- API 리팩토링
- 외부 API 연동

## Instructions
1. API 설계
   - RESTful 원칙 준수
   - 리소스 중심 URL 설계
   - HTTP 메서드 적절히 사용

2. 요청/응답 정의
   - 요청 파라미터 검증
   - 응답 형식 일관성
   - 페이지네이션 (필요 시)

3. 에러 처리
   - HTTP 상태 코드 적절히 사용
   - 에러 응답 형식 통일
   - 클라이언트 친화적 메시지

4. 보안
   - 인증/인가 적용
   - 입력값 검증
   - Rate limiting 고려

5. 문서화
   - OpenAPI/Swagger 스펙
   - 요청/응답 예시

## HTTP 상태 코드
| 코드 | 용도 |
|------|------|
| 200 | 성공 (조회/수정) |
| 201 | 생성 성공 |
| 204 | 성공 (내용 없음, 삭제) |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 |
| 422 | 처리 불가 (검증 실패) |
| 500 | 서버 에러 |

## Response Format
```json
// 성공
{
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}

// 에러
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "이메일 형식이 올바르지 않습니다",
    "details": [
      { "field": "email", "message": "..." }
    ]
  }
}
```

## Conventions
- URL: kebab-case (`/user-profiles`)
- 쿼리 파라미터: camelCase (`?pageSize=10`)
- 요청/응답 본문: camelCase
- 날짜: ISO 8601 형식

## Output
- API 엔드포인트 코드
- 요청/응답 타입 정의
- API 문서 (필요 시)
