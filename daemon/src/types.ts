export type TaskStatus = 'todo' | 'progress' | 'review' | 'done' | 'failed';
export type TaskType = 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'design' | 'api';

export interface Task {
  id: string;
  title: string;
  prompt: string;
  type: TaskType;
  skill?: string;
  validation?: string[]; // Deprecated - auto-detected based on project type
  status: TaskStatus;
  retry: {
    max: number;
    current: number;
  };
  lastError?: string;
  feedback?: string[];
  parentTask?: string;
  feedbackRound?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: TaskResult;
  // Jira integration fields
  jiraKey?: string;
  projectPath?: string;
}

export interface TaskResult {
  success: boolean;
  duration: number;
  changedFiles: ChangedFile[];
  validation: ValidationResult;
  logs: string[];
  output?: string; // Claude 실행 결과 (마크다운)
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  content?: string; // 텍스트 파일 내용 (문서화용)
}

export interface ValidationResult {
  [key: string]: { success: boolean; output: string } | undefined;
  // Common types: test, build, codex-review, lint, typecheck
}

// 트러블슈팅 추적용 타입
export interface TroubleshootingTracker {
  failedAttempts: FailedAttempt[];
  lastFailureCommentId?: string; // 실패 코멘트 ID (업데이트용)
  lastError?: string; // 마지막 에러 메시지 (재시도 시 Claude에게 전달)
  retryCount?: number; // 재시도 횟수
}

export interface FailedAttempt {
  attempt: number;
  error: string;
  errorType: 'execution' | 'validation';
  timestamp: string;
  validationResults?: ValidationResult;
}

export interface ProjectQueue {
  project: string;
  tasks: Task[];
}

export interface Project {
  name: string;
  path: string;
  addedAt: string;
}

export interface Registry {
  projects: Project[];
}

export interface Config {
  daemon: {
    pollInterval: number;
    maxConcurrent: number;
    autoStart: boolean;
  };
  defaults: {
    validation: string[];
    retryMax: number;
  };
  review: {
    enabled: boolean;
    autoApprove: boolean;
    requireComment: boolean;
  };
  notifications: {
    enabled: boolean;
    methods: string[];
    sound: boolean;
  };
  claudeCode: {
    flags: string[];
  };
}
