# TDD Development Skill

## Description
Test-Driven Development 방식으로 기능을 구현하는 스킬입니다.
반드시 **Red-Green-Refactor** 사이클을 따릅니다.

## When to use
- 새 기능 구현 (TDD 방식 필요 시)
- 버그 수정 시 재현 테스트 필요
- 리팩토링 전 테스트 보강
- 안정성이 중요한 핵심 로직 개발

## Instructions

### Phase 1: Red (테스트 먼저 작성)
1. 요구사항에서 테스트 케이스 도출
   - 기본 동작 (Happy Path)
   - 경계값 (Edge Cases)
   - 에러 상황 (Error Cases)

2. 테스트 코드 작성
   - Given-When-Then 패턴 사용
   - 명확한 테스트명: `should_동작_when_조건`
   - 아직 구현 없음 → 테스트 실패 확인

3. 테스트 실행하여 **실패 확인**
   - 반드시 테스트가 실패해야 함
   - "올바른 이유로" 실패하는지 확인

### Phase 2: Green (최소 구현)
1. 테스트를 통과하는 **최소한의 코드** 작성
   - 하드코딩도 OK (일단 통과)
   - 완벽한 코드 X, 동작하는 코드 O

2. 테스트 실행하여 **통과 확인**
   - 모든 테스트 그린

### Phase 3: Refactor (개선)
1. 코드 품질 개선
   - 중복 제거
   - 명확한 네이밍
   - 단일 책임 원칙

2. 테스트 유지
   - 리팩토링 후에도 모든 테스트 통과
   - 테스트 자체도 리팩토링 가능

### 반복
- 다음 테스트 케이스로 Phase 1부터 반복
- **작은 단위로 진행** (한 번에 하나의 테스트)

## Conventions
- 테스트 파일: `*.test.ts`, `*.spec.ts`, 또는 `__tests__/*.ts`
- 테스트 러너: 프로젝트에 맞게 (Jest, Vitest, JUnit 등)
- 커버리지 목표: 80% 이상

## Rules (절대 준수)
1. **테스트 없이 구현하지 않음**
2. **테스트가 실패하지 않으면 구현하지 않음**
3. **한 번에 여러 테스트 추가하지 않음** (하나씩)
4. **Red 단계를 건너뛰지 않음**

## Output
1. 테스트 코드 (먼저)
2. 구현 코드 (나중)
3. 모든 테스트 통과 확인
4. (선택) 커버리지 리포트

## Example Workflow

```
1. [Red] 테스트 작성: "should return sum of two numbers"
   → 테스트 실행 → 실패 확인 (add 함수 없음)

2. [Green] 최소 구현:
   function add(a, b) { return a + b; }
   → 테스트 실행 → 통과

3. [Refactor] 필요시 개선
   → 테스트 실행 → 여전히 통과

4. [Red] 다음 테스트: "should handle negative numbers"
   → 반복...
```
