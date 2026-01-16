import { describe, it, expect } from 'vitest';
import { PageBuilder, type TaskPageData, type TroubleshootingItem } from '../confluence/page-builder.js';
import type { TaskResult } from '../types.js';

describe('PageBuilder', () => {
  describe('buildTaskPage', () => {
    it('should build page with basic task info', () => {
      const data: TaskPageData = {
        issueKey: 'SCRUM-1',
        title: 'Test Task',
        result: {
          success: true,
          duration: 5000,
          changedFiles: [],
          validation: {},
          logs: [],
        },
        prompt: 'Do something',
      };

      const html = PageBuilder.buildTaskPage(data);

      expect(html).toContain('SCRUM-1');
      expect(html).toContain('Green');
      expect(html).toContain('5.0초');
      expect(html).toContain('Do something');
      expect(html).toContain('작업 개요');
      expect(html).toContain('프롬프트');
    });

    it('should show failed status for unsuccessful task', () => {
      const data: TaskPageData = {
        issueKey: 'SCRUM-2',
        title: 'Failed Task',
        result: {
          success: false,
          duration: 3000,
          changedFiles: [],
          validation: {},
          logs: [],
        },
        prompt: 'Try this',
      };

      const html = PageBuilder.buildTaskPage(data);

      expect(html).toContain('Red');
      expect(html).toContain('3.0초');
    });

    it('should include changed files table with badges', () => {
      const data: TaskPageData = {
        issueKey: 'SCRUM-3',
        title: 'Changes',
        result: {
          success: true,
          duration: 10000,
          changedFiles: [
            { path: 'src/index.ts', status: 'modified', additions: 10, deletions: 5 },
            { path: 'src/new.ts', status: 'added', additions: 50, deletions: 0 },
          ],
          validation: {},
          logs: [],
        },
        prompt: 'Edit files',
      };

      const html = PageBuilder.buildTaskPage(data);

      expect(html).toContain('변경된 파일');
      expect(html).toContain('src/index.ts');
      expect(html).toContain('📝 수정');
      expect(html).toContain('src/new.ts');
      expect(html).toContain('➕ 추가');
      expect(html).toContain('+10');
      expect(html).toContain('-5');
    });

    it('should include validation results with details', () => {
      const data: TaskPageData = {
        issueKey: 'SCRUM-4',
        title: 'Validated',
        result: {
          success: true,
          duration: 8000,
          changedFiles: [],
          validation: {
            typeCheck: { success: true, output: 'No errors' },
            lint: { success: true, output: 'All clean' },
            test: { success: false, output: 'Test failed: expect 1 to be 2' },
          },
          logs: [],
        },
        prompt: 'Check',
      };

      const html = PageBuilder.buildTaskPage(data);

      expect(html).toContain('검증 결과');
      expect(html).toContain('typeCheck');
      expect(html).toContain('lint');
      expect(html).toContain('test');
      expect(html).toContain('No errors');
    });

    it('should include troubleshooting section when provided', () => {
      const troubleshooting: TroubleshootingItem[] = [
        {
          problem: 'Build failed',
          cause: 'Missing dependency',
          solution: 'npm install lodash',
          resolved: true,
        },
        {
          problem: 'Test timeout',
          cause: 'Async not awaited',
          solution: 'Add await keyword',
          resolved: false,
        },
      ];

      const data: TaskPageData = {
        issueKey: 'SCRUM-5',
        title: 'With Troubleshooting',
        result: {
          success: true,
          duration: 5000,
          changedFiles: [],
          validation: {},
          logs: [],
        },
        prompt: 'Fix issues',
        troubleshooting,
      };

      const html = PageBuilder.buildTaskPage(data);

      expect(html).toContain('트러블슈팅');
      expect(html).toContain('Build failed');
      expect(html).toContain('Missing dependency');
      expect(html).toContain('npm install lodash');
      expect(html).toContain('해결됨');
      expect(html).toContain('미해결');
    });

    it('should include project path when provided', () => {
      const data: TaskPageData = {
        issueKey: 'SCRUM-6',
        title: 'With Project',
        result: {
          success: true,
          duration: 5000,
          changedFiles: [],
          validation: {},
          logs: [],
        },
        prompt: 'Do work',
        projectPath: '/Users/chan/workspace/my-project',
      };

      const html = PageBuilder.buildTaskPage(data);

      expect(html).toContain('/Users/chan/workspace/my-project');
      expect(html).toContain('프로젝트');
    });

    it('should include Jira link in references', () => {
      const data: TaskPageData = {
        issueKey: 'SCRUM-7',
        title: 'With References',
        result: {
          success: true,
          duration: 5000,
          changedFiles: [],
          validation: {},
          logs: [],
        },
        prompt: 'Do something',
      };

      const html = PageBuilder.buildTaskPage(data);

      expect(html).toContain('참조 링크');
      expect(html).toContain('https://heechanlog.atlassian.net/browse/SCRUM-7');
    });
  });

  describe('buildFailedTaskPage', () => {
    it('should build error page with details', () => {
      const html = PageBuilder.buildFailedTaskPage(
        'SCRUM-10',
        'Error Task',
        'TypeError: Cannot read property of undefined',
        'Execute command'
      );

      expect(html).toContain('SCRUM-10');
      expect(html).toContain('Red');
      expect(html).toContain('에러 내용');
      expect(html).toContain('TypeError: Cannot read property of undefined');
      expect(html).toContain('Execute command');
      expect(html).toContain('collapse');
    });

    it('should include troubleshooting in failed page', () => {
      const troubleshooting: TroubleshootingItem[] = [
        {
          problem: 'API timeout',
          cause: 'Server down',
          solution: 'Check server status',
          resolved: false,
        },
      ];

      const html = PageBuilder.buildFailedTaskPage(
        'SCRUM-11',
        'Failed with troubleshooting',
        'Connection refused',
        'Call API',
        '/path/to/project',
        troubleshooting
      );

      expect(html).toContain('트러블슈팅');
      expect(html).toContain('API timeout');
      expect(html).toContain('/path/to/project');
    });
  });

  describe('buildDailyReportPage', () => {
    it('should build daily summary with stats', () => {
      const tasks = [
        { issueKey: 'SCRUM-1', title: 'Task 1', success: true, duration: 5000 },
        { issueKey: 'SCRUM-2', title: 'Task 2', success: true, duration: 3000 },
        { issueKey: 'SCRUM-3', title: 'Task 3', success: false, duration: 10000 },
      ];

      const html = PageBuilder.buildDailyReportPage('2026-01-01', tasks);

      expect(html).toContain('2026-01-01');
      expect(html).toContain('일일 요약');
      expect(html).toContain('3건'); // total
      expect(html).toContain('2건'); // success
      expect(html).toContain('1건'); // fail
      expect(html).toContain('18.0초'); // total duration
      expect(html).toContain('SCRUM-1');
      expect(html).toContain('SCRUM-2');
      expect(html).toContain('SCRUM-3');
    });

    it('should handle empty task list', () => {
      const html = PageBuilder.buildDailyReportPage('2026-01-01', []);

      expect(html).toContain('0건');
    });

    it('should include Jira links for each task', () => {
      const tasks = [
        { issueKey: 'SCRUM-100', title: 'Task', success: true, duration: 1000 },
      ];

      const html = PageBuilder.buildDailyReportPage('2026-01-01', tasks);

      expect(html).toContain('https://heechanlog.atlassian.net/browse/SCRUM-100');
    });
  });
});
