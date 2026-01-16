import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JiraUpdater } from '../jira/updater.js';
import { JiraClient } from '../jira/client.js';
import type { JiraConfig } from '../jira/types.js';
import type { TaskResult } from '../types.js';

// Mock JiraClient
vi.mock('../jira/client.js', () => ({
  JiraClient: vi.fn().mockImplementation(() => ({
    addComment: vi.fn(),
    getTransitions: vi.fn(),
    transitionIssue: vi.fn(),
  })),
}));

describe('JiraUpdater', () => {
  let updater: JiraUpdater;
  let mockClient: {
    addComment: ReturnType<typeof vi.fn>;
    getTransitions: ReturnType<typeof vi.fn>;
    transitionIssue: ReturnType<typeof vi.fn>;
  };

  const testConfig: JiraConfig = {
    baseUrl: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token',
    projectKey: 'TEST',
    pollInterval: 10000,
    statuses: {
      trigger: 'To Claude',
      processing: 'In Progress',
      review: "검토 중", done: "완료",
      failed: 'Failed',
    },
    customFields: {
      skill: 'customfield_10001',
      prompt: 'customfield_10002',
      projectPath: 'customfield_10003',
    },
  };

  beforeEach(() => {
    mockClient = {
      addComment: vi.fn().mockResolvedValue(undefined),
      getTransitions: vi.fn().mockResolvedValue([
        { id: '21', name: 'In Progress', to: { id: '3', name: 'In Progress' } },
        { id: '31', name: '검토 중', to: { id: '4', name: '검토 중' } },
        { id: '41', name: 'Failed', to: { id: '5', name: 'Failed' } },
      ]),
      transitionIssue: vi.fn().mockResolvedValue(undefined),
    };
    (JiraClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockClient);
    updater = new JiraUpdater(testConfig);
  });

  describe('markAsProcessing', () => {
    it('should transition issue to processing status', async () => {
      await updater.markAsProcessing('TEST-1');

      expect(mockClient.getTransitions).toHaveBeenCalledWith('TEST-1');
      expect(mockClient.transitionIssue).toHaveBeenCalledWith('TEST-1', '21');
    });
  });

  describe('markAsComplete', () => {
    it('should add success comment and transition to done', async () => {
      const result: TaskResult = {
        success: true,
        duration: 5000,
        changedFiles: [],
        validation: {},
        logs: [],
      };

      await updater.markAsComplete('TEST-1', result);

      expect(mockClient.addComment).toHaveBeenCalled();
      expect(mockClient.transitionIssue).toHaveBeenCalledWith('TEST-1', '31');
    });
  });

  describe('markAsFailed', () => {
    it('should add failure comment and transition to failed', async () => {
      const error = 'Build failed';

      await updater.markAsFailed('TEST-1', error);

      expect(mockClient.addComment).toHaveBeenCalled();
      expect(mockClient.transitionIssue).toHaveBeenCalledWith('TEST-1', '41');
    });
  });

  describe('addRetryComment', () => {
    it('should add retry comment without changing status', async () => {
      await updater.addRetryComment('TEST-1', 2, 3, 'Previous error');

      expect(mockClient.addComment).toHaveBeenCalled();
      expect(mockClient.transitionIssue).not.toHaveBeenCalled();
    });
  });
});
