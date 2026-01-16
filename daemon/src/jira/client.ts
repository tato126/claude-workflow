import type {
  JiraConfig,
  JiraIssue,
  JiraSearchResult,
  JiraTransition,
  JiraTransitionsResponse,
  JiraCommentResponse,
  JiraCommentsResponse,
  AdfDocument,
} from './types.js';

interface TransitionCacheEntry {
  transitions: JiraTransition[];
  expiry: number;
}

const TRANSITION_CACHE_TTL = 5 * 60 * 1000; // 5분

export class JiraClient {
  private config: JiraConfig;
  private authHeader: string;
  private transitionCache: Map<string, TransitionCacheEntry> = new Map();

  constructor(config: JiraConfig) {
    this.config = config;
    this.authHeader = this.createAuthHeader();
  }

  private createAuthHeader(): string {
    const credentials = `${this.config.email}:${this.config.apiToken}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Jira API error (${response.status}): ${JSON.stringify(error)}`
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async searchIssues(jql: string): Promise<JiraIssue[]> {
    // Use new /rest/api/3/search/jql endpoint (migrated from deprecated /rest/api/3/search)
    const result = await this.request<JiraSearchResult>('/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify({
        jql,
        maxResults: 50,
        fields: [
          'summary',
          'description',
          'status',
          'issuetype',
          'created',
          'updated',
          this.config.customFields.skill,
          this.config.customFields.prompt,
          this.config.customFields.projectPath,
        ],
      }),
    });

    return result.issues;
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.request<JiraIssue>(`/rest/api/3/issue/${issueKey}`, {
      method: 'GET',
    });
  }

  async addComment(issueKey: string, body: AdfDocument): Promise<void> {
    await this.request(`/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  // 댓글 추가 후 댓글 ID 반환
  async addCommentWithId(issueKey: string, body: AdfDocument): Promise<string> {
    const result = await this.request<JiraCommentResponse>(
      `/rest/api/3/issue/${issueKey}/comment`,
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      }
    );
    return result.id;
  }

  // 기존 댓글 업데이트
  async updateComment(issueKey: string, commentId: string, body: AdfDocument): Promise<void> {
    await this.request(`/rest/api/3/issue/${issueKey}/comment/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ body }),
    });
  }

  async getComments(issueKey: string, maxResults = 10): Promise<JiraCommentResponse[]> {
    const result = await this.request<JiraCommentsResponse>(
      `/rest/api/3/issue/${issueKey}/comment?orderBy=-created&maxResults=${maxResults}`,
      { method: 'GET' }
    );
    return result.comments;
  }

  async getLatestComment(issueKey: string): Promise<JiraCommentResponse | null> {
    // 최적화: 1개만 요청
    const comments = await this.getComments(issueKey, 1);
    return comments.length > 0 ? comments[0] : null;
  }

  async getTransitions(issueKey: string, useCache = true): Promise<JiraTransition[]> {
    // 캐시 확인
    if (useCache) {
      const cached = this.transitionCache.get(issueKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.transitions;
      }
    }

    const result = await this.request<JiraTransitionsResponse>(
      `/rest/api/3/issue/${issueKey}/transitions`,
      { method: 'GET' }
    );

    // 캐시 저장
    this.transitionCache.set(issueKey, {
      transitions: result.transitions,
      expiry: Date.now() + TRANSITION_CACHE_TTL,
    });

    return result.transitions;
  }

  // 트랜지션 후 캐시 무효화
  invalidateTransitionCache(issueKey: string): void {
    this.transitionCache.delete(issueKey);
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.request(`/rest/api/3/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
    // 트랜지션 후 캐시 무효화 (상태 변경으로 가용 트랜지션 변경됨)
    this.invalidateTransitionCache(issueKey);
  }

  // Convenience method to find and execute transition by status name
  async transitionToStatus(issueKey: string, statusName: string): Promise<void> {
    const transitions = await this.getTransitions(issueKey);
    const transition = transitions.find((t) => t.to.name === statusName);

    if (!transition) {
      throw new Error(
        `No transition found to status "${statusName}" for issue ${issueKey}`
      );
    }

    await this.transitionIssue(issueKey, transition.id);
  }

  /**
   * 새 이슈 생성
   */
  async createIssue(options: {
    summary: string;
    description: string;
    issueType: string;
    parentKey?: string;
    labels?: string[];
  }): Promise<{ key: string; id: string }> {
    const fields: Record<string, unknown> = {
      project: { key: this.config.projectKey },
      summary: options.summary,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: options.description }],
          },
        ],
      },
      issuetype: { name: options.issueType },
    };

    if (options.labels && options.labels.length > 0) {
      fields.labels = options.labels;
    }

    // 링크된 이슈가 있는 경우 (parent는 subtask용이므로 issuelinks 사용)
    const result = await this.request<{ key: string; id: string }>(
      '/rest/api/3/issue',
      {
        method: 'POST',
        body: JSON.stringify({ fields }),
      }
    );

    // 원본 이슈와 링크 생성
    if (options.parentKey) {
      await this.createIssueLink(options.parentKey, result.key, 'relates to');
    }

    return result;
  }

  /**
   * 이슈 간 링크 생성
   */
  async createIssueLink(
    inwardKey: string,
    outwardKey: string,
    linkType: string = 'relates to'
  ): Promise<void> {
    await this.request('/rest/api/3/issueLink', {
      method: 'POST',
      body: JSON.stringify({
        type: { name: linkType },
        inwardIssue: { key: inwardKey },
        outwardIssue: { key: outwardKey },
      }),
    });
  }

  /**
   * 이슈의 첨부파일 목록 조회
   */
  async getAttachments(issueKey: string): Promise<Array<{
    id: string;
    filename: string;
    mimeType: string;
    content: string;
    size: number;
  }>> {
    const issue = await this.request<{ fields: { attachment: Array<{
      id: string;
      filename: string;
      mimeType: string;
      content: string;
      size: number;
    }> } }>(`/rest/api/3/issue/${issueKey}?fields=attachment`, {
      method: 'GET',
    });
    return issue.fields.attachment || [];
  }

  /**
   * 첨부파일 다운로드 (바이너리)
   */
  async downloadAttachment(contentUrl: string): Promise<Buffer> {
    const response = await fetch(contentUrl, {
      headers: {
        'Authorization': this.authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 파일명으로 첨부파일 찾아서 다운로드
   */
  async downloadAttachmentByFilename(issueKey: string, filename: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  } | null> {
    const attachments = await this.getAttachments(issueKey);
    const attachment = attachments.find(a => a.filename === filename);

    if (!attachment) {
      return null;
    }

    const buffer = await this.downloadAttachment(attachment.content);
    return {
      buffer,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    };
  }
}
