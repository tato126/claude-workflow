import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JiraPoller } from '../jira/poller.js';
import { JiraClient } from '../jira/client.js';
import type { JiraConfig, JiraIssue } from '../jira/types.js';

// Mock JiraClient
vi.mock('../jira/client.js', () => ({
  JiraClient: vi.fn().mockImplementation(() => ({
    searchIssues: vi.fn(),
  })),
}));

describe('JiraPoller', () => {
  let poller: JiraPoller;
  let mockClient: { searchIssues: ReturnType<typeof vi.fn> };

  const testConfig: JiraConfig = {
    baseUrl: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token',
    projectKey: 'TEST',
    pollInterval: 1000,
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

  const mockIssue: JiraIssue = {
    id: '10001',
    key: 'TEST-1',
    self: 'https://test.atlassian.net/rest/api/3/issue/10001',
    fields: {
      summary: 'Test Task',
      description: 'Test description',
      status: { id: '1', name: 'To Claude' },
      issuetype: { id: '10001', name: 'Task' },
      created: '2025-01-01T00:00:00.000Z',
      updated: '2025-01-01T00:00:00.000Z',
      customfield_10001: { value: 'feature' },
      customfield_10002: 'Implement this feature',
      customfield_10003: '/Users/test/project',
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = {
      searchIssues: vi.fn(),
    };
    (JiraClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockClient);
    poller = new JiraPoller(testConfig);
  });

  afterEach(() => {
    poller.stop();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create poller with config', () => {
      expect(poller).toBeDefined();
    });
  });

  describe('poll', () => {
    it('should search for issues with trigger status', async () => {
      mockClient.searchIssues.mockResolvedValueOnce([]);

      await poller.poll();

      expect(mockClient.searchIssues).toHaveBeenCalledWith(
        'project = TEST AND status = "To Claude" ORDER BY created ASC'
      );
    });

    it('should return found issues', async () => {
      mockClient.searchIssues.mockResolvedValueOnce([mockIssue]);

      const issues = await poller.poll();

      expect(issues).toHaveLength(1);
      expect(issues[0].key).toBe('TEST-1');
    });

    it('should return empty array when no issues found', async () => {
      mockClient.searchIssues.mockResolvedValueOnce([]);

      const issues = await poller.poll();

      expect(issues).toHaveLength(0);
    });
  });

  describe('start/stop', () => {
    it('should start polling at configured interval', async () => {
      mockClient.searchIssues.mockResolvedValue([]);
      const onIssue = vi.fn();

      poller.start(onIssue);

      // Initial poll
      await vi.advanceTimersByTimeAsync(0);
      expect(mockClient.searchIssues).toHaveBeenCalledTimes(1);

      // After one interval
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockClient.searchIssues).toHaveBeenCalledTimes(2);

      // After another interval
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockClient.searchIssues).toHaveBeenCalledTimes(3);
    });

    it('should call callback when issue found', async () => {
      mockClient.searchIssues.mockResolvedValueOnce([mockIssue]);
      const onIssue = vi.fn();

      poller.start(onIssue);
      await vi.advanceTimersByTimeAsync(0);

      expect(onIssue).toHaveBeenCalledWith(mockIssue);
    });

    it('should not process same issue twice', async () => {
      mockClient.searchIssues.mockResolvedValue([mockIssue]);
      const onIssue = vi.fn();

      poller.start(onIssue);

      // First poll
      await vi.advanceTimersByTimeAsync(0);
      expect(onIssue).toHaveBeenCalledTimes(1);

      // Second poll - same issue should be skipped
      await vi.advanceTimersByTimeAsync(1000);
      expect(onIssue).toHaveBeenCalledTimes(1);
    });

    it('should stop polling when stop called', async () => {
      mockClient.searchIssues.mockResolvedValue([]);

      poller.start(vi.fn());
      await vi.advanceTimersByTimeAsync(0);
      expect(mockClient.searchIssues).toHaveBeenCalledTimes(1);

      poller.stop();

      await vi.advanceTimersByTimeAsync(5000);
      expect(mockClient.searchIssues).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearProcessed', () => {
    it('should allow reprocessing of cleared issue', async () => {
      mockClient.searchIssues.mockResolvedValue([mockIssue]);
      const onIssue = vi.fn();

      poller.start(onIssue);
      await vi.advanceTimersByTimeAsync(0);
      expect(onIssue).toHaveBeenCalledTimes(1);

      poller.clearProcessed('TEST-1');

      await vi.advanceTimersByTimeAsync(1000);
      expect(onIssue).toHaveBeenCalledTimes(2);
    });
  });
});
