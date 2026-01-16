import type { JiraConfig, JiraIssue } from './types.js';
import type { Task, TaskType } from '../types.js';

/**
 * ADF에서 추출한 미디어(이미지) 정보
 */
export interface AdfMediaInfo {
  filename: string;  // alt 속성 (파일명)
  id: string;        // media id (UUID)
}

/**
 * ADF(Atlassian Document Format) 객체에서 텍스트 추출
 */
export function extractTextFromAdf(adf: unknown): string {
  if (typeof adf === 'string') {
    return adf;
  }

  if (!adf || typeof adf !== 'object') {
    return '';
  }

  const doc = adf as { content?: unknown[] };
  if (!doc.content || !Array.isArray(doc.content)) {
    return '';
  }

  const extractFromNode = (node: unknown): string => {
    if (!node || typeof node !== 'object') return '';

    const n = node as { type?: string; text?: string; content?: unknown[] };

    if (n.type === 'text' && n.text) {
      return n.text;
    }

    if (n.content && Array.isArray(n.content)) {
      return n.content.map(extractFromNode).join('');
    }

    return '';
  };

  return doc.content
    .map((node) => {
      const text = extractFromNode(node);
      return text;
    })
    .join('\n')
    .trim();
}

/**
 * ADF에서 미디어(이미지) 정보 추출
 * mediaSingle > media 노드에서 파일명(alt)과 ID 추출
 */
export function extractMediaFromAdf(adf: unknown): AdfMediaInfo[] {
  const mediaList: AdfMediaInfo[] = [];

  if (!adf || typeof adf !== 'object') {
    return mediaList;
  }

  const doc = adf as { content?: unknown[] };
  if (!doc.content || !Array.isArray(doc.content)) {
    return mediaList;
  }

  const extractFromNode = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;

    const n = node as {
      type?: string;
      content?: unknown[];
      attrs?: { id?: string; alt?: string; type?: string };
    };

    // media 노드 찾기
    if (n.type === 'media' && n.attrs) {
      const { id, alt } = n.attrs;
      if (id && alt) {
        mediaList.push({ filename: alt, id });
      }
    }

    // 재귀적으로 자식 노드 탐색
    if (n.content && Array.isArray(n.content)) {
      n.content.forEach(extractFromNode);
    }
  };

  doc.content.forEach(extractFromNode);
  return mediaList;
}

/**
 * description에서 Project Path를 파싱합니다.
 * 형식: "Project: /path/to/project" 또는 "프로젝트: /path/to/project"
 */
function parseDescriptionForProjectPath(description: string | object | null): {
  projectPath: string | undefined;
  cleanedDescription: string;
} {
  // ADF 객체인 경우 텍스트로 변환
  const descText = typeof description === 'string'
    ? description
    : extractTextFromAdf(description);

  if (!descText) {
    return { projectPath: undefined, cleanedDescription: '' };
  }

  const projectPathRegex = /^(?:Project|프로젝트)\s*:\s*(.+?)(?:\n|$)/im;
  const match = descText.match(projectPathRegex);

  if (match) {
    const projectPath = match[1].trim();
    const cleanedDescription = descText.replace(projectPathRegex, '').trim();
    return { projectPath, cleanedDescription };
  }

  return { projectPath: undefined, cleanedDescription: descText };
}

export function mapJiraIssueToTask(issue: JiraIssue, config: JiraConfig): Task {
  const customPrompt = issue.fields[config.customFields.prompt] as string | undefined;
  const skillField = issue.fields[config.customFields.skill] as { value: string } | undefined;
  const customProjectPath = issue.fields[config.customFields.projectPath] as string | undefined;

  // description에서 projectPath 파싱
  const { projectPath: parsedProjectPath, cleanedDescription } = parseDescriptionForProjectPath(
    issue.fields.description
  );

  // 우선순위: description 파싱 > 커스텀 필드 > 기본값 (기본값은 executor에서 처리)
  const projectPath = parsedProjectPath || customProjectPath;

  // 프롬프트 우선순위: 커스텀 필드 > 정제된 description
  const prompt = customPrompt || cleanedDescription;

  return {
    id: issue.key,
    title: issue.fields.summary,
    prompt,
    type: mapIssueTypeToTaskType(issue.fields.issuetype.name),
    skill: skillField?.value,
    status: 'todo',
    retry: {
      max: 3,
      current: 0,
    },
    createdAt: issue.fields.created,
    jiraKey: issue.key,
    projectPath,
  };
}

function mapIssueTypeToTaskType(issueType: string): TaskType {
  const typeMap: Record<string, TaskType> = {
    'Bug': 'bugfix',
    'Story': 'feature',
    'Task': 'feature',
    'Sub-task': 'feature',
    'Epic': 'feature',
    'Improvement': 'refactor',
    'Documentation': 'docs',
    'Test': 'test',
    // GOT 프로젝트 커스텀 이슈 타입
    'feature': 'feature',
    'docs': 'docs',
  };

  return typeMap[issueType] || 'feature';
}
