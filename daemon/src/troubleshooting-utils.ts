import type { FailedAttempt } from './types.js';
import type { TroubleshootingItem } from './confluence/page-builder.js';

/**
 * FailedAttempt 배열을 TroubleshootingItem 배열로 변환
 * Confluence 트러블슈팅 섹션에서 사용
 */
export function convertToTroubleshootingItems(
  failedAttempts: FailedAttempt[],
  resolved: boolean
): TroubleshootingItem[] {
  return failedAttempts.map((attempt, index) => ({
    problem: `시도 ${attempt.attempt}: ${attempt.errorType === 'execution' ? '실행 오류' : '검증 실패'}`,
    cause: extractCause(attempt.error),
    solution: resolved
      ? index === failedAttempts.length - 1
        ? '재시도로 해결됨'
        : '다음 시도로 진행'
      : '해결 중',
    resolved,
  }));
}

/**
 * 에러 메시지에서 핵심 원인 추출
 */
function extractCause(error: string): string {
  // 일반적인 에러 패턴 매칭
  const patterns = [
    /Error: (.+)/i,
    /error: (.+)/i,
    /failed: (.+)/i,
    /cannot (.+)/i,
    /FAIL (.+)/i,
    /TypeError: (.+)/i,
    /SyntaxError: (.+)/i,
    /ReferenceError: (.+)/i,
  ];

  for (const pattern of patterns) {
    const match = error.match(pattern);
    if (match) {
      return match[1].substring(0, 200);
    }
  }

  // 패턴 매칭 실패 시 첫 줄 반환
  const firstLine = error.split('\n')[0];
  return firstLine.substring(0, 200);
}
