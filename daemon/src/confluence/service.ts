import type { ConfluenceConfig } from './types.js';
import type { TaskResult, TaskType } from '../types.js';
import { ConfluenceClient } from './client.js';
import { PageBuilder, type TroubleshootingItem, type FeedbackItem } from './page-builder.js';

// 태스크 타입별 폴더 매핑 (executor.ts와 동일)
const TYPE_TO_FOLDER: Record<TaskType, string> = {
  design: '📐 Design',
  feature: '✨ Features',
  bugfix: '🐛 Bugs',
  refactor: '♻️ Refactor',
  test: '🧪 Tests',
  docs: '📚 Guides',
  api: '🔌 API',
};

export class ConfluenceService {
  private client: ConfluenceClient;
  private parentPageId: string | null = null;
  private categoryPageIds: Map<string, string> = new Map();
  private configParentPageId?: string;

  constructor(config: ConfluenceConfig) {
    this.client = new ConfluenceClient(config);
    this.configParentPageId = config.parentPageId;
  }

  async initialize(): Promise<void> {
    // config에 parentPageId가 지정되어 있으면 사용, 없으면 자동 생성
    if (this.configParentPageId) {
      this.parentPageId = this.configParentPageId;
    } else {
      this.parentPageId = await this.client.getOrCreateParentPage('Claude Automation Logs');
    }
  }

  /**
   * 태스크 타입에 해당하는 카테고리 페이지 ID 가져오기 (없으면 생성)
   */
  private async getCategoryPageId(taskType: TaskType): Promise<string> {
    const folderName = TYPE_TO_FOLDER[taskType] || '📁 Misc';

    // 캐시된 ID가 있으면 반환
    if (this.categoryPageIds.has(folderName)) {
      return this.categoryPageIds.get(folderName)!;
    }

    // 카테고리 페이지 찾기 또는 생성
    const existingPage = await this.client.findPageByTitle(folderName);
    if (existingPage) {
      this.categoryPageIds.set(folderName, existingPage.id);
      return existingPage.id;
    }

    // 새 카테고리 페이지 생성
    const categoryContent = `<p>이 폴더에는 <strong>${folderName}</strong> 타입의 작업 결과가 저장됩니다.</p>`;
    const newPage = await this.client.createPage(
      folderName,
      categoryContent,
      this.parentPageId || undefined
    );
    this.categoryPageIds.set(folderName, newPage.id);
    return newPage.id;
  }

  async createTaskPage(
    issueKey: string,
    title: string,
    result: TaskResult,
    prompt: string,
    projectPath?: string,
    taskType?: TaskType,
    troubleshooting?: TroubleshootingItem[],
    feedbackHistory?: FeedbackItem[]
  ): Promise<string> {
    const pageTitle = `[${issueKey}] ${title}`;
    const content = PageBuilder.buildTaskPage({
      issueKey,
      title,
      result,
      prompt,
      projectPath,
      troubleshooting,
      feedbackHistory,
    });

    // 태스크 타입에 따른 카테고리 폴더 아래에 생성
    const parentId = taskType
      ? await this.getCategoryPageId(taskType)
      : this.parentPageId;

    const existingPage = await this.client.findPageByTitle(pageTitle);

    if (existingPage) {
      const updated = await this.client.updatePage(existingPage.id, pageTitle, content);
      return this.client.getPageUrl(updated.id);
    }

    const newPage = await this.client.createPage(
      pageTitle,
      content,
      parentId || undefined
    );
    return this.client.getPageUrl(newPage.id);
  }

  async createFailedTaskPage(
    issueKey: string,
    title: string,
    error: string,
    prompt: string,
    projectPath?: string,
    taskType?: TaskType,
    troubleshooting?: TroubleshootingItem[]
  ): Promise<string> {
    const pageTitle = `[${issueKey}] ${title} - 실패`;
    const content = PageBuilder.buildFailedTaskPage(
      issueKey,
      title,
      error,
      prompt,
      projectPath,
      troubleshooting
    );

    // 태스크 타입에 따른 카테고리 폴더 아래에 생성
    const parentId = taskType
      ? await this.getCategoryPageId(taskType)
      : this.parentPageId;

    const existingPage = await this.client.findPageByTitle(pageTitle);

    if (existingPage) {
      const updated = await this.client.updatePage(existingPage.id, pageTitle, content);
      return this.client.getPageUrl(updated.id);
    }

    const newPage = await this.client.createPage(
      pageTitle,
      content,
      parentId || undefined
    );
    return this.client.getPageUrl(newPage.id);
  }

  async createDailyReport(
    tasks: Array<{ issueKey: string; title: string; success: boolean; duration: number }>
  ): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    const pageTitle = `Daily Report - ${today}`;
    const content = PageBuilder.buildDailyReportPage(today, tasks);

    const existingPage = await this.client.findPageByTitle(pageTitle);

    if (existingPage) {
      const updated = await this.client.updatePage(existingPage.id, pageTitle, content);
      return this.client.getPageUrl(updated.id);
    }

    const newPage = await this.client.createPage(
      pageTitle,
      content,
      this.parentPageId || undefined
    );
    return this.client.getPageUrl(newPage.id);
  }
}
