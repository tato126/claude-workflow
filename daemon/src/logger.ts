import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';

const WORKFLOW_DIR = join(process.env.HOME || '', '.claude', 'workflow');
const LOG_DIR = join(WORKFLOW_DIR, 'logs');
const LOG_FILE = join(LOG_DIR, 'daemon.log');

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

export function log(message: string, level: 'info' | 'error' | 'warn' = 'info'): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const levelIcon = {
    info: 'ℹ️',
    error: '❌',
    warn: '⚠️'
  }[level];

  const logLine = `[${timestamp}] ${levelIcon} ${message}\n`;

  // Console output
  console.log(logLine.trim());

  // File output
  try {
    appendFileSync(LOG_FILE, logLine);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

export function logTaskStart(taskId: string, taskTitle: string, projectPath: string): void {
  log(`Starting task: ${taskTitle} (${taskId}) in ${projectPath}`);
}

export function logTaskEnd(taskId: string, taskTitle: string, success: boolean, duration: number): void {
  const status = success ? 'SUCCESS' : 'FAILED';
  log(`Task ${status}: ${taskTitle} (${taskId}) - ${duration}ms`);
}

export function logValidation(type: string, success: boolean): void {
  const status = success ? 'PASSED' : 'FAILED';
  log(`Validation ${type}: ${status}`);
}
