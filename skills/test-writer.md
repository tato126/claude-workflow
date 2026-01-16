# Test Writer Skill

## Description
구현된 기능에 대한 테스트 코드를 작성하는 스킬입니다.

## When to use
- 기능 구현 후 테스트 필요
- 테스트 커버리지 향상
- 버그 수정 후 회귀 테스트

## Instructions
1. 구현 코드 분석
   - 함수/컴포넌트 동작 파악
   - 입출력 확인
   - 의존성 파악

2. 테스트 케이스 도출
   - 정상 케이스 (happy path)
   - 엣지 케이스 (경계값)
   - 에러 케이스 (예외 상황)

3. 테스트 코드 작성
   - Given-When-Then 패턴
   - 명확한 테스트명
   - 독립적인 테스트

4. 실행 확인
   - 모든 테스트 통과
   - 커버리지 확인

## Tools
- Jest / Vitest
- React Testing Library
- MSW (API 모킹)

## Test Types
- Unit Test: 개별 함수/컴포넌트
- Integration Test: 모듈 간 상호작용
- E2E Test: 전체 흐름

## Output
- 테스트 파일
- 필요시 mock 파일
