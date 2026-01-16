import { describe, it, expect } from 'vitest';
import { mapJiraIssueToTask } from '../jira/mapper.js';
import type { JiraConfig, JiraIssue } from '../jira/types.js';
import type { Task } from '../types.js';

describe('mapJiraIssueToTask', () => {
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

  it('should map basic issue fields', () => {
    const issue: JiraIssue = {
      id: '10001',
      key: 'TEST-1',
      self: 'https://test.atlassian.net/rest/api/3/issue/10001',
      fields: {
        summary: 'Implement login feature',
        description: 'Add user login functionality',
        status: { id: '1', name: 'To Claude' },
        issuetype: { id: '10001', name: 'Task' },
        created: '2025-01-01T00:00:00.000Z',
        updated: '2025-01-01T00:00:00.000Z',
      },
    };

    const task = mapJiraIssueToTask(issue, testConfig);

    expect(task.id).toBe('TEST-1');
    expect(task.title).toBe('Implement login feature');
    expect(task.prompt).toBe('Add user login functionality');
    expect(task.status).toBe('todo');
    expect(task.jiraKey).toBe('TEST-1');
  });

  it('should use custom field for prompt if available', () => {
    const issue: JiraIssue = {
      id: '10001',
      key: 'TEST-1',
      self: 'https://test.atlassian.net/rest/api/3/issue/10001',
      fields: {
        summary: 'Test task',
        description: 'Default description',
        status: { id: '1', name: 'To Claude' },
        issuetype: { id: '10001', name: 'Task' },
        created: '2025-01-01T00:00:00.000Z',
        updated: '2025-01-01T00:00:00.000Z',
        customfield_10002: 'Custom prompt from Jira field',
      },
    };

    const task = mapJiraIssueToTask(issue, testConfig);

    expect(task.prompt).toBe('Custom prompt from Jira field');
  });

  it('should map skill from custom field', () => {
    const issue: JiraIssue = {
      id: '10001',
      key: 'TEST-1',
      self: 'https://test.atlassian.net/rest/api/3/issue/10001',
      fields: {
        summary: 'Test task',
        description: 'Description',
        status: { id: '1', name: 'To Claude' },
        issuetype: { id: '10001', name: 'Task' },
        created: '2025-01-01T00:00:00.000Z',
        updated: '2025-01-01T00:00:00.000Z',
        customfield_10001: { value: 'tdd' },
      },
    };

    const task = mapJiraIssueToTask(issue, testConfig);

    expect(task.skill).toBe('tdd');
  });

  it('should map project path from custom field', () => {
    const issue: JiraIssue = {
      id: '10001',
      key: 'TEST-1',
      self: 'https://test.atlassian.net/rest/api/3/issue/10001',
      fields: {
        summary: 'Test task',
        description: 'Description',
        status: { id: '1', name: 'To Claude' },
        issuetype: { id: '10001', name: 'Task' },
        created: '2025-01-01T00:00:00.000Z',
        updated: '2025-01-01T00:00:00.000Z',
        customfield_10003: '/Users/test/my-project',
      },
    };

    const task = mapJiraIssueToTask(issue, testConfig);

    expect(task.projectPath).toBe('/Users/test/my-project');
  });

  it('should map issue type to task type', () => {
    const testCases = [
      { issuetype: 'Bug', expected: 'bugfix' },
      { issuetype: 'Story', expected: 'feature' },
      { issuetype: 'Task', expected: 'feature' },
      { issuetype: 'Sub-task', expected: 'feature' },
    ];

    for (const { issuetype, expected } of testCases) {
      const issue: JiraIssue = {
        id: '10001',
        key: 'TEST-1',
        self: 'https://test.atlassian.net/rest/api/3/issue/10001',
        fields: {
          summary: 'Test task',
          description: 'Description',
          status: { id: '1', name: 'To Claude' },
          issuetype: { id: '10001', name: issuetype },
          created: '2025-01-01T00:00:00.000Z',
          updated: '2025-01-01T00:00:00.000Z',
        },
      };

      const task = mapJiraIssueToTask(issue, testConfig);

      expect(task.type).toBe(expected);
    }
  });

  it('should set default retry values', () => {
    const issue: JiraIssue = {
      id: '10001',
      key: 'TEST-1',
      self: 'https://test.atlassian.net/rest/api/3/issue/10001',
      fields: {
        summary: 'Test task',
        description: 'Description',
        status: { id: '1', name: 'To Claude' },
        issuetype: { id: '10001', name: 'Task' },
        created: '2025-01-01T00:00:00.000Z',
        updated: '2025-01-01T00:00:00.000Z',
      },
    };

    const task = mapJiraIssueToTask(issue, testConfig);

    expect(task.retry).toEqual({ max: 3, current: 0 });
  });

  it('should set createdAt from issue created date', () => {
    const issue: JiraIssue = {
      id: '10001',
      key: 'TEST-1',
      self: 'https://test.atlassian.net/rest/api/3/issue/10001',
      fields: {
        summary: 'Test task',
        description: 'Description',
        status: { id: '1', name: 'To Claude' },
        issuetype: { id: '10001', name: 'Task' },
        created: '2025-01-01T12:34:56.000Z',
        updated: '2025-01-01T00:00:00.000Z',
      },
    };

    const task = mapJiraIssueToTask(issue, testConfig);

    expect(task.createdAt).toBe('2025-01-01T12:34:56.000Z');
  });
});
