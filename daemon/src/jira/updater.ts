import { JiraClient } from './client.js';
import { CommentBuilder } from './comment-builder.js';
import type { JiraConfig } from './types.js';
import type { TaskResult, FailedAttempt } from '../types.js';

export class JiraUpdater {
  private client: JiraClient;
  private config: JiraConfig;

  constructor(config: JiraConfig, client?: JiraClient) {
    this.config = config;
    // 외부 클라이언트 주입 또는 내부 생성
    this.client = client || new JiraClient(config);
  }

  async markAsProcessing(issueKey: string): Promise<void> {
    await this.transitionTo(issueKey, this.config.statuses.processing);
  }

  async markAsComplete(issueKey: string, result: TaskResult, confluenceUrl?: string): Promise<void> {
    const comment = CommentBuilder.buildSuccessComment(result, confluenceUrl);
    await this.client.addComment(issueKey, comment);
    // Move to review status (검토 중), manual approval needed to complete (완료)
    await this.transitionTo(issueKey, this.config.statuses.review);
  }

  async markAsFailed(issueKey: string, error: string): Promise<void> {
    const comment = CommentBuilder.buildFailureComment(error);
    await this.client.addComment(issueKey, comment);
    await this.transitionTo(issueKey, this.config.statuses.failed);
  }

  async addRetryComment(
    issueKey: string,
    attempt: number,
    maxRetries: number,
    error: string
  ): Promise<void> {
    const comment = CommentBuilder.buildRetryComment(attempt, maxRetries, error);
    await this.client.addComment(issueKey, comment);
  }

  // 재시도 코멘트 추가 후 코멘트 ID 반환 (트러블슈팅 추적용)
  async addRetryCommentWithId(
    issueKey: string,
    attempt: number,
    maxRetries: number,
    error: string
  ): Promise<string> {
    const comment = CommentBuilder.buildRetryComment(attempt, maxRetries, error);
    return await this.client.addCommentWithId(issueKey, comment);
  }

  // 기존 실패/재시도 코멘트를 해결됨으로 업데이트
  async updateToResolved(
    issueKey: string,
    commentId: string,
    failedAttempts: FailedAttempt[],
    result: TaskResult,
    confluenceUrl?: string
  ): Promise<void> {
    const comment = CommentBuilder.buildResolvedComment(failedAttempts, result, confluenceUrl);
    await this.client.updateComment(issueKey, commentId, comment);
    // 상태를 검토 중으로 전환
    await this.transitionTo(issueKey, this.config.statuses.review);
  }

  private async transitionTo(issueKey: string, statusName: string): Promise<void> {
    const transitions = await this.client.getTransitions(issueKey);
    const transition = transitions.find((t) => t.to.name === statusName);

    if (!transition) {
      throw new Error(
        `No transition found to status "${statusName}" for issue ${issueKey}`
      );
    }

    await this.client.transitionIssue(issueKey, transition.id);
  }
}
