import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { log } from './logger.js';
import type { Config } from './types.js';

function getConfig(): Config {
  const configPath = join(process.env.HOME || '', '.claude', 'workflow', 'data', 'config.json');
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }
  return {
    daemon: { pollInterval: 5000, maxConcurrent: 1, autoStart: true },
    defaults: { validation: ['test', 'lint'], retryMax: 3 },
    review: { enabled: false, autoApprove: false, requireComment: false },
    notifications: { enabled: true, methods: ['macos'], sound: true },
    claudeCode: { flags: ['--print', '--dangerously-skip-permissions'] },
  };
}

export function notify(title: string, message: string): void {
  const config = getConfig();

  if (!config.notifications.enabled) {
    return;
  }

  for (const method of config.notifications.methods) {
    switch (method) {
      case 'macos':
        notifyMacOS(title, message, config.notifications.sound);
        break;
      case 'terminal':
        notifyTerminal(title, message);
        break;
    }
  }
}

function notifyMacOS(title: string, message: string, sound: boolean): void {
  const soundOption = sound ? 'sound name "Glass"' : '';
  const script = `display notification "${message}" with title "${title}" ${soundOption}`;

  exec(`osascript -e '${script}'`, (error) => {
    if (error) {
      log(`Notification error: ${error.message}`);
    }
  });
}

function notifyTerminal(title: string, message: string): void {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📢 ${title}`);
  console.log(`   ${message}`);
  console.log(`${'='.repeat(50)}\n`);
}

export function notifyTaskComplete(taskTitle: string, success: boolean): void {
  const icon = success ? '✅' : '❌';
  const status = success ? '완료' : '실패';
  notify(`${icon} 태스크 ${status}`, taskTitle);
}

export function notifyReviewNeeded(taskTitle: string): void {
  notify('🔍 리뷰 필요', taskTitle);
}

export function notifyDaemonStatus(status: 'started' | 'stopped'): void {
  const message = status === 'started' ? 'Daemon이 시작되었습니다' : 'Daemon이 중지되었습니다';
  const icon = status === 'started' ? '🚀' : '⏹️';
  notify(`${icon} Workflow`, message);
}
