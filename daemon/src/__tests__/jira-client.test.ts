import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JiraClient } from '../jira/client.js';
import type { JiraConfig, JiraIssue, JiraSearchResult, JiraTransitionsResponse } from '../jira/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('JiraClient', () => {
  let client: JiraClient;
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
    client = new JiraClient(testConfig);
    mockFetch.mockReset();
  });

  describe('searchIssues', () => {
    it('should search issues with JQL query', async () => {
      const mockResponse: JiraSearchResult = {
        expand: 'schema',
        startAt: 0,
        maxResults: 50,
        total: 1,
        issues: [
          {
            id: '10001',
            key: 'TEST-1',
            self: 'https://test.atlassian.net/rest/api/3/issue/10001',
            fields: {
              summary: 'Test Issue',
              description: 'Test description',
              status: { id: '1', name: 'To Claude' },
              issuetype: { id: '10001', name: 'Task' },
              created: '2025-01-01T00:00:00.000Z',
              updated: '2025-01-01T00:00:00.000Z',
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const jql = 'project = TEST AND status = "To Claude"';
      const result = await client.searchIssues(jql);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://test.atlassian.net/rest/api/3/search/jql');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toMatch(/^Basic /);
      expect(options.headers['Content-Type']).toBe('application/json');
      const body = JSON.parse(options.body);
      expect(body.jql).toBe(jql);
      expect(result).toEqual(mockResponse.issues);
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ errorMessages: ['Unauthorized'] }),
      });

      await expect(client.searchIssues('project = TEST')).rejects.toThrow();
    });
  });

  describe('getIssue', () => {
    it('should fetch issue by key', async () => {
      const mockIssue: JiraIssue = {
        id: '10001',
        key: 'TEST-1',
        self: 'https://test.atlassian.net/rest/api/3/issue/10001',
        fields: {
          summary: 'Test Issue',
          description: 'Test description',
          status: { id: '1', name: 'To Claude' },
          issuetype: { id: '10001', name: 'Task' },
          created: '2025-01-01T00:00:00.000Z',
          updated: '2025-01-01T00:00:00.000Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssue,
      });

      const result = await client.getIssue('TEST-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/TEST-1',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockIssue);
    });
  });

  describe('addComment', () => {
    it('should add ADF comment to issue', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '10001' }),
      });

      const adfContent = {
        type: 'doc' as const,
        version: 1 as const,
        content: [
          {
            type: 'paragraph' as const,
            content: [{ type: 'text' as const, text: 'Test comment' }],
          },
        ],
      };

      await client.addComment('TEST-1', adfContent);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/TEST-1/comment',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test comment'),
        })
      );
    });
  });

  describe('getTransitions', () => {
    it('should fetch available transitions', async () => {
      const mockTransitions: JiraTransitionsResponse = {
        expand: 'transitions',
        transitions: [
          { id: '21', name: 'In Progress', to: { id: '3', name: 'In Progress' } },
          { id: '31', name: 'Done', to: { id: '4', name: 'Done' } },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTransitions,
      });

      const result = await client.getTransitions('TEST-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/TEST-1/transitions',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockTransitions.transitions);
    });
  });

  describe('transitionIssue', () => {
    it('should transition issue to new status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await client.transitionIssue('TEST-1', '31');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/TEST-1/transitions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ transition: { id: '31' } }),
        })
      );
    });
  });

  describe('authentication', () => {
    it('should use Basic auth with base64 encoded credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ issues: [] }),
      });

      await client.searchIssues('project = TEST');

      const expectedAuth = Buffer.from('test@example.com:test-token').toString('base64');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Basic ${expectedAuth}`,
          }),
        })
      );
    });
  });
});
