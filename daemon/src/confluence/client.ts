import type {
  ConfluenceConfig,
  ConfluencePage,
  ConfluenceSearchResult,
  CreatePageRequest,
  UpdatePageRequest,
} from './types.js';

export class ConfluenceClient {
  private config: ConfluenceConfig;
  private authHeader: string;

  constructor(config: ConfluenceConfig) {
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
        `Confluence API error (${response.status}): ${JSON.stringify(error)}`
      );
    }

    return response.json();
  }

  async createPage(
    title: string,
    content: string,
    parentId?: string
  ): Promise<ConfluencePage> {
    const body: CreatePageRequest = {
      spaceId: this.config.spaceId,
      status: 'current',
      title,
      body: {
        representation: 'storage',
        value: content,
      },
    };

    if (parentId) {
      body.parentId = parentId;
    }

    return this.request<ConfluencePage>('/wiki/api/v2/pages', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updatePage(
    pageId: string,
    title: string,
    content: string
  ): Promise<ConfluencePage> {
    // Get current version
    const current = await this.request<ConfluencePage>(
      `/wiki/api/v2/pages/${pageId}`
    );

    const body: UpdatePageRequest = {
      id: pageId,
      status: 'current',
      title,
      body: {
        representation: 'storage',
        value: content,
      },
      version: {
        number: (current.version?.number || 0) + 1,
      },
    };

    return this.request<ConfluencePage>(`/wiki/api/v2/pages/${pageId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async findPageByTitle(title: string): Promise<ConfluencePage | null> {
    const encodedTitle = encodeURIComponent(title);
    const result = await this.request<ConfluenceSearchResult>(
      `/wiki/api/v2/spaces/${this.config.spaceId}/pages?title=${encodedTitle}`
    );

    return result.results.length > 0 ? result.results[0] : null;
  }

  async getOrCreateParentPage(title: string): Promise<string> {
    const existing = await this.findPageByTitle(title);
    if (existing) {
      return existing.id;
    }

    const newPage = await this.createPage(
      title,
      `<p>자동 생성된 상위 페이지입니다.</p>`
    );
    return newPage.id;
  }

  getPageUrl(pageId: string): string {
    return `${this.config.baseUrl}/wiki/spaces/${this.config.spaceKey}/pages/${pageId}`;
  }
}
