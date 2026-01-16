import { JiraClient } from './client.js';
import type { JiraConfig, JiraIssue } from './types.js';

export class JiraPoller {
  private client: JiraClient;
  private config: JiraConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private processedIssues: Set<string> = new Set();
  private lastPollTime: Date | null = null;

  constructor(config: JiraConfig, client?: JiraClient) {
    this.config = config;
    // 외부 클라이언트 주입 또는 내부 생성
    this.client = client || new JiraClient(config);
  }

  async poll(): Promise<JiraIssue[]> {
    // 증분 폴링: 마지막 폴링 이후 업데이트된 이슈만 조회
    let jql = `project = ${this.config.projectKey} AND status = "${this.config.statuses.trigger}"`;

    if (this.lastPollTime) {
      // 마지막 폴링 시간 기준으로 필터링 (여유 시간 30초 추가)
      const sinceTime = new Date(this.lastPollTime.getTime() - 30000);
      const formattedTime = sinceTime.toISOString().slice(0, 19).replace('T', ' ');
      jql += ` AND updated >= "${formattedTime}"`;
    }

    jql += ' ORDER BY created ASC';

    const issues = await this.client.searchIssues(jql);
    this.lastPollTime = new Date();

    return issues;
  }

  start(onIssue: (issue: JiraIssue) => void): void {
    if (this.intervalId) {
      return; // Already running
    }

    const pollAndProcess = async () => {
      try {
        const issues = await this.poll();
        for (const issue of issues) {
          if (!this.processedIssues.has(issue.key)) {
            this.processedIssues.add(issue.key);
            onIssue(issue);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Initial poll
    pollAndProcess();

    // Set up interval
    this.intervalId = setInterval(pollAndProcess, this.config.pollInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  clearProcessed(issueKey: string): void {
    this.processedIssues.delete(issueKey);
  }

  clearAllProcessed(): void {
    this.processedIssues.clear();
  }

  // 외부에서 클라이언트 접근 (필요시)
  getClient(): JiraClient {
    return this.client;
  }
}
