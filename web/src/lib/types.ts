export type TaskStatus = 'todo' | 'progress' | 'review' | 'done' | 'failed';
export type TaskType = 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'design' | 'api';

export interface TaskImage {
  id: string;
  data: string;  // base64 encoded
  name: string;
  type: string;
}

export interface Task {
  id: string;
  title: string;
  prompt: string;
  type: TaskType;
  skill?: string;
  validation?: string[]; // Auto-detected based on project type
  status: TaskStatus;
  retry: {
    max: number;
    current: number;
  };
  lastError?: string;
  feedback?: string[];
  feedbackImages?: TaskImage[];  // 피드백 이미지
  images?: TaskImage[];  // 태스크 이미지
  parentTask?: string;
  feedbackRound?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Project {
  name: string;
  path: string;
  addedAt: string;
}

export interface ProjectQueue {
  project: string;
  tasks: Task[];
}
