import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfluenceClient } from '../confluence/client.js';
import type { ConfluenceConfig } from '../confluence/types.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ConfluenceClient', () => {
  let client: ConfluenceClient;
  const testConfig: ConfluenceConfig = {
    baseUrl: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token',
    spaceKey: 'CLAUDE',
    spaceId: '65858',
  };

  beforeEach(() => {
    client = new ConfluenceClient(testConfig);
    mockFetch.mockReset();
  });

  describe('createPage', () => {
    it('should create a page in the space', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '12345',
          title: 'Test Page',
          _links: { webui: '/wiki/spaces/CLAUDE/pages/12345' },
        }),
      });

      const result = await client.createPage('Test Page', '<p>Content</p>');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://test.atlassian.net/wiki/api/v2/pages');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.title).toBe('Test Page');
      expect(body.spaceId).toBe('65858');
      expect(result.id).toBe('12345');
    });

    it('should create page with parent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '12346', title: 'Child Page' }),
      });

      await client.createPage('Child Page', '<p>Content</p>', '12345');

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.parentId).toBe('12345');
    });
  });

  describe('updatePage', () => {
    it('should update existing page', async () => {
      // First get current version
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '12345', version: { number: 1 } }),
      });
      // Then update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '12345', version: { number: 2 } }),
      });

      await client.updatePage('12345', 'Updated Title', '<p>New content</p>');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [url, options] = mockFetch.mock.calls[1];
      expect(url).toBe('https://test.atlassian.net/wiki/api/v2/pages/12345');
      expect(options.method).toBe('PUT');
    });
  });

  describe('findPageByTitle', () => {
    it('should find page by title in space', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: '12345', title: 'Test Page' }],
        }),
      });

      const result = await client.findPageByTitle('Test Page');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('title=Test%20Page');
      expect(result?.id).toBe('12345');
    });

    it('should return null if page not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await client.findPageByTitle('Nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getOrCreateParentPage', () => {
    it('should return existing parent page', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: '99999', title: 'Task Logs' }],
        }),
      });

      const result = await client.getOrCreateParentPage('Task Logs');
      expect(result).toBe('99999');
    });

    it('should create parent page if not exists', async () => {
      // Search returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });
      // Create new page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '88888', title: 'Task Logs' }),
      });

      const result = await client.getOrCreateParentPage('Task Logs');
      expect(result).toBe('88888');
    });
  });
});
