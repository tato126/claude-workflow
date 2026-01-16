// Jira Cloud REST API v3 Types

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  pollInterval: number;
  defaultProjectPath?: string;
  statuses: {
    trigger: string;
    processing: string;
    review: string;
    done: string;
    failed: string;
  };
  customFields: {
    skill: string;
    prompt: string;
    projectPath: string;
  };
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description: string | null;
    status: {
      id: string;
      name: string;
    };
    issuetype: {
      id: string;
      name: string;
    };
    created: string;
    updated: string;
    [key: string]: unknown; // For custom fields
  };
}

export interface JiraSearchResult {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

export interface JiraTransitionsResponse {
  expand: string;
  transitions: JiraTransition[];
}

// Atlassian Document Format (ADF) for comments
export interface AdfDocument {
  type: 'doc';
  version: 1;
  content: AdfContent[];
}

export type AdfContent =
  | AdfParagraph
  | AdfHeading
  | AdfBulletList
  | AdfCodeBlock;

export interface AdfParagraph {
  type: 'paragraph';
  content: AdfText[];
}

export interface AdfHeading {
  type: 'heading';
  attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 };
  content: AdfText[];
}

export interface AdfBulletList {
  type: 'bulletList';
  content: AdfListItem[];
}

export interface AdfListItem {
  type: 'listItem';
  content: AdfParagraph[];
}

export interface AdfCodeBlock {
  type: 'codeBlock';
  attrs?: { language?: string };
  content: AdfText[];
}

export interface AdfText {
  type: 'text';
  text: string;
  marks?: AdfMark[];
}

export interface AdfMark {
  type: 'strong' | 'em' | 'code' | 'link';
  attrs?: { href?: string };
}

export interface JiraComment {
  body: AdfDocument;
}

export interface JiraCommentResponse {
  id: string;
  self: string;
  body: AdfDocument;
  author: {
    accountId: string;
    displayName: string;
  };
  created: string;
  updated: string;
}

export interface JiraCommentsResponse {
  startAt: number;
  maxResults: number;
  total: number;
  comments: JiraCommentResponse[];
}

export interface JiraError {
  errorMessages: string[];
  errors: Record<string, string>;
}
