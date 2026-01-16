import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfluenceService } from '../confluence/service.js';
import type { ConfluenceConfig } from '../confluence/types.js';
import type { TaskResult } from '../types.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ConfluenceService', () => {
  let service: ConfluenceService;
  const testConfig: ConfluenceConfig = {
    baseUrl: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token',
    spaceKey: 'CLAUDE',
    spaceId: '65858',
  };

  beforeEach(() => {
    service = new ConfluenceService(testConfig);
    mockFetch.mockReset();
  });

  describe('initialize', () => {
    it('should get or create parent page on init', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: '99999', title: 'Claude Automation Logs' }],
        }),
      });

      await service.initialize();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('createTaskPage', () => {
    it('should create new page when not exists', async () => {
      // Init parent page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: '99999' }] }),
      });
      await service.initialize();
      mockFetch.mockReset();

      // Search for existing page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });
      // Create new page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '12345', title: '[SCRUM-1] Test Task' }),
      });

      const result: TaskResult = {
        success: true,
        duration: 5000,
        changedFiles: [],
        validation: {},
        logs: [],
      };

      const url = await service.createTaskPage('SCRUM-1', 'Test Task', result, 'Do something');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(url).toContain('/wiki/spaces/CLAUDE/pages/12345');
    });

    it('should update existing page', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: '99999' }] }),
      });
      await service.initialize();
      mockFetch.mockReset();

      // Search finds existing page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: '54321', title: '[SCRUM-1] Test Task' }] }),
      });
      // Get current version
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '54321', version: { number: 2 } }),
      });
      // Update page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '54321', version: { number: 3 } }),
      });

      const result: TaskResult = {
        success: true,
        duration: 5000,
        changedFiles: [],
        validation: {},
        logs: [],
      };

      const url = await service.createTaskPage('SCRUM-1', 'Test Task', result, 'Do something');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(url).toContain('54321');
    });
  });

  describe('createFailedTaskPage', () => {
    it('should create page with error info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: '99999' }] }),
      });
      await service.initialize();
      mockFetch.mockReset();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '11111' }),
      });

      const url = await service.createFailedTaskPage(
        'SCRUM-2',
        'Failed Task',
        'Some error',
        'Try this'
      );

      expect(url).toContain('11111');
    });
  });

  describe('createDailyReport', () => {
    it('should create daily report page', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: '99999' }] }),
      });
      await service.initialize();
      mockFetch.mockReset();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '77777' }),
      });

      const tasks = [
        { issueKey: 'SCRUM-1', title: 'Task 1', success: true, duration: 5000 },
      ];

      const url = await service.createDailyReport(tasks);

      expect(url).toContain('77777');
    });
  });
});
