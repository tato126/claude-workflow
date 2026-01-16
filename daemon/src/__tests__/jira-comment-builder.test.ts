import { describe, it, expect } from 'vitest';
import { CommentBuilder } from '../jira/comment-builder.js';
import type { TaskResult, ChangedFile } from '../types.js';

describe('CommentBuilder', () => {
  describe('buildSuccessComment', () => {
    it('should create ADF document for successful task', () => {
      const result: TaskResult = {
        success: true,
        duration: 5000,
        changedFiles: [
          { path: 'src/feature.ts', status: 'added', additions: 50, deletions: 0 },
          { path: 'src/test.ts', status: 'modified', additions: 20, deletions: 5 },
        ],
        validation: {
          test: { success: true, output: 'All tests passed' },
          build: { success: true, output: 'Build successful' },
        },
        logs: ['Started execution', 'Completed'],
      };

      const adf = CommentBuilder.buildSuccessComment(result);

      expect(adf.type).toBe('doc');
      expect(adf.version).toBe(1);
      expect(adf.content.length).toBeGreaterThan(0);

      // Should have heading
      const heading = adf.content.find((c) => c.type === 'heading');
      expect(heading).toBeDefined();
    });

    it('should include changed files list', () => {
      const result: TaskResult = {
        success: true,
        duration: 3000,
        changedFiles: [
          { path: 'src/index.ts', status: 'modified', additions: 10, deletions: 2 },
        ],
        validation: {},
        logs: [],
      };

      const adf = CommentBuilder.buildSuccessComment(result);

      // Check that document contains file path
      const content = JSON.stringify(adf);
      expect(content).toContain('src/index.ts');
    });

    it('should include duration', () => {
      const result: TaskResult = {
        success: true,
        duration: 12500, // 12.5 seconds
        changedFiles: [],
        validation: {},
        logs: [],
      };

      const adf = CommentBuilder.buildSuccessComment(result);
      const content = JSON.stringify(adf);

      expect(content).toContain('12.5');
    });
  });

  describe('buildFailureComment', () => {
    it('should create ADF document for failed task', () => {
      const error = 'Build failed: TypeScript compilation error';

      const adf = CommentBuilder.buildFailureComment(error);

      expect(adf.type).toBe('doc');
      expect(adf.version).toBe(1);

      const content = JSON.stringify(adf);
      expect(content).toContain('Build failed');
    });

    it('should include error message in code block', () => {
      const error = 'Error: Cannot find module "missing"';

      const adf = CommentBuilder.buildFailureComment(error);

      const codeBlock = adf.content.find((c) => c.type === 'codeBlock');
      expect(codeBlock).toBeDefined();
    });
  });

  describe('buildRetryComment', () => {
    it('should create comment for retry attempt', () => {
      const attempt = 2;
      const maxRetries = 3;
      const error = 'Test failed';

      const adf = CommentBuilder.buildRetryComment(attempt, maxRetries, error);

      const content = JSON.stringify(adf);
      expect(content).toContain('2');
      expect(content).toContain('3');
    });
  });
});
