import { execa } from 'execa';
import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, existsSync, readFileSync, appendFileSync, createWriteStream } from 'fs';
import type { Task, TaskResult, ChangedFile, Config } from './types.js';
import { log } from './logger.js';

function getConfig(): Config {
  const configPath = join(process.env.HOME || '', '.claude', 'workflow', 'data', 'config.json');
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }
  // Default config
  return {
    daemon: { pollInterval: 5000, maxConcurrent: 1, autoStart: true },
    defaults: { validation: ['test', 'lint'], retryMax: 3 },
    review: { enabled: false, autoApprove: false, requireComment: false },
    notifications: { enabled: true, methods: ['macos'], sound: true },
    claudeCode: { flags: ['--print', '--dangerously-skip-permissions'] },
  };
}

export async function executeTask(
  projectPath: string,
  task: Task
): Promise<{ success: boolean; output: string }> {
  const config = getConfig();
  const logDir = join(projectPath, '.claude', 'logs', task.id);
  const attemptNum = task.retry.current + 1;
  const logFile = join(logDir, `attempt-${attemptNum}.log`);
  const liveLogFile = join(logDir, 'live.log');

  // Ensure log directory exists
  if (!existsSync(logDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(logDir, { recursive: true });
  }

  // Build prompt with feedback if retry
  let prompt = task.prompt;
  if (task.lastError) {
    prompt = `${task.prompt}\n\n---\n이전 시도에서 다음 에러가 발생했습니다:\n${task.lastError}\n\n이 에러를 해결해주세요.`;
  }
  if (task.feedback && task.feedback.length > 0) {
    prompt = `${task.prompt}\n\n---\n피드백:\n${task.feedback.join('\n')}\n\n위 피드백을 반영해주세요.`;
  }

  // Local document generation disabled - Confluence only
  // const outputDir = getOutputDirectory(task.type);
  // const outputInstruction = `\n\n---\n[출력 경로 지시]\n문서나 결과물을 생성할 때는 프로젝트 루트의 \`docs/${outputDir}/\` 디렉토리에 저장해주세요.\n예: docs/${outputDir}/파일명.md`;
  // prompt = prompt + outputInstruction;

  // Always include automation skill (global)
  const automationSkill = await getAutomationSkill();
  if (automationSkill) {
    prompt = `${automationSkill}\n\n---\n\n${prompt}`;
  }

  // Find task-specific skill file
  const skillPrompt = await getSkillPrompt(projectPath, task.skill);
  if (skillPrompt) {
    prompt = `${skillPrompt}\n\n---\n\n${prompt}`;
  }

  log(`Executing task: ${task.title}`);
  log(`Project: ${projectPath}`);
  log(`Prompt: ${prompt.substring(0, 100)}...`);

  const startTime = Date.now();

  // Initialize live log file
  const timestamp = new Date().toISOString();
  writeFileSync(liveLogFile, `# Task: ${task.title}\n# Started: ${timestamp}\n# Attempt: ${attemptNum}\n\n`);

  return new Promise((resolve) => {
    const child = spawn('claude', config.claudeCode.flags, {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    const liveStream = createWriteStream(liveLogFile, { flags: 'a' });

    // Write prompt to stdin
    child.stdin.write(prompt);
    child.stdin.end();

    // Stream stdout in real-time
    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      liveStream.write(text);
    });

    // Stream stderr in real-time
    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      liveStream.write(`[stderr] ${text}`);
    });

    // Set timeout
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      liveStream.write('\n\n[TIMEOUT] Task exceeded 10 minutes\n');
    }, 10 * 60 * 1000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      // Finalize live log
      liveStream.write(`\n\n# Completed: ${new Date().toISOString()}\n# Duration: ${duration}ms\n# Exit code: ${code}\n`);
      liveStream.end();

      // Save final log
      writeFileSync(logFile, `# Task: ${task.title}\n# Attempt: ${attemptNum}\n# Duration: ${duration}ms\n\n${output}`);

      log(`Task completed in ${duration}ms`);

      resolve({
        success: code === 0,
        output
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      const errorMessage = error.message;

      liveStream.write(`\n\n[ERROR] ${errorMessage}\n`);
      liveStream.end();

      writeFileSync(logFile, `# Task: ${task.title}\n# Attempt: ${attemptNum}\n# ERROR\n\n${errorMessage}`);

      log(`Task failed: ${errorMessage}`);

      resolve({
        success: false,
        output: errorMessage
      });
    });
  });
}

async function getAutomationSkill(): Promise<string | null> {
  const automationPath = join(process.env.HOME || '', '.claude', 'skills', 'automation.md');
  if (existsSync(automationPath)) {
    return readFileSync(automationPath, 'utf-8');
  }
  return null;
}

async function getSkillPrompt(projectPath: string, skillName?: string): Promise<string | null> {
  if (!skillName) return null;

  // 1. Check project docs/skills first (visible location)
  const docsSkillPath = join(projectPath, 'docs', 'skills', `${skillName}.md`);
  if (existsSync(docsSkillPath)) {
    return readFileSync(docsSkillPath, 'utf-8');
  }

  // 2. Check project .claude/skills (hidden location, legacy)
  const projectSkillPath = join(projectPath, '.claude', 'skills', `${skillName}.md`);
  if (existsSync(projectSkillPath)) {
    return readFileSync(projectSkillPath, 'utf-8');
  }

  // 3. Check global workflow skills
  const globalSkillPath = join(process.env.HOME || '', '.claude', 'workflow', 'skills', `${skillName}.md`);
  if (existsSync(globalSkillPath)) {
    return readFileSync(globalSkillPath, 'utf-8');
  }

  // 4. Check ~/.claude/skills (original location)
  const defaultSkillPath = join(process.env.HOME || '', '.claude', 'skills', `${skillName}.md`);
  if (existsSync(defaultSkillPath)) {
    return readFileSync(defaultSkillPath, 'utf-8');
  }

  return null;
}

// 문서화할 파일 확장자 (텍스트 기반)
const DOCUMENT_EXTENSIONS = ['.md', '.txt', '.json', '.yaml', '.yml', '.html', '.css'];
const MAX_CONTENT_LENGTH = 50000; // 50KB 제한

function shouldIncludeContent(filePath: string): boolean {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return DOCUMENT_EXTENSIONS.includes(ext);
}

export async function getChangedFiles(projectPath: string): Promise<ChangedFile[]> {
  try {
    const files: ChangedFile[] = [];
    const addedPaths = new Set<string>();

    // 1. Check uncommitted changes first (git status --porcelain)
    const statusResult = await execa('git', ['status', '--porcelain'], {
      cwd: projectPath,
      reject: false
    });

    if (statusResult.exitCode === 0) {
      const lines = statusResult.stdout.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);

        // .claude/ 디렉토리 제외
        if (filePath.startsWith('.claude/')) continue;

        let status: 'added' | 'modified' | 'deleted' = 'modified';
        if (statusCode.includes('A') || statusCode.includes('?')) {
          status = 'added';
        } else if (statusCode.includes('D')) {
          status = 'deleted';
        }

        let content: string | undefined;
        if (status !== 'deleted' && shouldIncludeContent(filePath)) {
          try {
            const fullPath = join(projectPath, filePath);
            if (existsSync(fullPath)) {
              const fileContent = readFileSync(fullPath, 'utf-8');
              content = fileContent.length > MAX_CONTENT_LENGTH
                ? fileContent.substring(0, MAX_CONTENT_LENGTH) + '\n\n... (truncated)'
                : fileContent;
            }
          } catch {
            // 파일 읽기 실패 시 무시
          }
        }

        files.push({ path: filePath, status, additions: 0, deletions: 0, content });
        addedPaths.add(filePath);
      }
    }

    // 2. If no meaningful uncommitted files, check recently committed files
    // Claude가 작업 후 commit을 하기 때문에 커밋된 파일도 확인 필요
    if (files.length === 0) {
      // feature 브랜치에서 dev 브랜치와의 차이 확인
      const devDiffResult = await execa('git', ['diff', '--name-status', 'origin/dev...HEAD'], {
        cwd: projectPath,
        reject: false
      });

      if (devDiffResult.exitCode === 0 && devDiffResult.stdout.trim()) {
        const lines = devDiffResult.stdout.split('\n').filter(l => l.trim());

        for (const line of lines) {
          const match = line.match(/^([AMDRT])\t(.+)$/);
          if (!match) continue;

          const [, statusChar, filePath] = match;
          if (filePath.startsWith('.claude/')) continue;
          if (addedPaths.has(filePath)) continue;

          let status: 'added' | 'modified' | 'deleted' = 'modified';
          if (statusChar === 'A') status = 'added';
          else if (statusChar === 'D') status = 'deleted';

          let content: string | undefined;
          if (status !== 'deleted' && shouldIncludeContent(filePath)) {
            try {
              const fullPath = join(projectPath, filePath);
              if (existsSync(fullPath)) {
                const fileContent = readFileSync(fullPath, 'utf-8');
                content = fileContent.length > MAX_CONTENT_LENGTH
                  ? fileContent.substring(0, MAX_CONTENT_LENGTH) + '\n\n... (truncated)'
                  : fileContent;
              }
            } catch {
              // 파일 읽기 실패 시 무시
            }
          }

          files.push({ path: filePath, status, additions: 0, deletions: 0, content });
          addedPaths.add(filePath);
        }

        // Get line counts for committed files
        const numstatResult = await execa('git', ['diff', '--numstat', 'origin/dev...HEAD'], {
          cwd: projectPath,
          reject: false
        });

        if (numstatResult.exitCode === 0) {
          for (const line of numstatResult.stdout.split('\n')) {
            const match = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
            if (match) {
              const [, add, del, path] = match;
              const file = files.find(f => f.path === path);
              if (file) {
                file.additions = add === '-' ? 0 : parseInt(add);
                file.deletions = del === '-' ? 0 : parseInt(del);
              }
            }
          }
        }
      } else {
        // dev 브랜치가 없거나 비교 실패 시 최근 커밋 확인 (fallback)
        const lastCommitResult = await execa('git', ['diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD'], {
          cwd: projectPath,
          reject: false
        });

        if (lastCommitResult.exitCode === 0) {
          for (const line of lastCommitResult.stdout.split('\n').filter(l => l.trim())) {
            const match = line.match(/^([AMDRT])\t(.+)$/);
            if (!match) continue;

            const [, statusChar, filePath] = match;
            if (filePath.startsWith('.claude/')) continue;
            if (addedPaths.has(filePath)) continue;

            let status: 'added' | 'modified' | 'deleted' = 'modified';
            if (statusChar === 'A') status = 'added';
            else if (statusChar === 'D') status = 'deleted';

            files.push({ path: filePath, status, additions: 0, deletions: 0 });
            addedPaths.add(filePath);
          }

          // Get line counts for last commit
          const numstatResult = await execa('git', ['diff-tree', '--no-commit-id', '--numstat', '-r', 'HEAD'], {
            cwd: projectPath,
            reject: false
          });

          if (numstatResult.exitCode === 0) {
            for (const line of numstatResult.stdout.split('\n')) {
              const match = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
              if (match) {
                const [, add, del, path] = match;
                const file = files.find(f => f.path === path);
                if (file) {
                  file.additions = add === '-' ? 0 : parseInt(add);
                  file.deletions = del === '-' ? 0 : parseInt(del);
                }
              }
            }
          }
        }
      }
    } else {
      // Get line counts for uncommitted files
      const diffResult = await execa('git', ['diff', '--numstat', 'HEAD'], {
        cwd: projectPath,
        reject: false
      });

      if (diffResult.exitCode === 0) {
        for (const line of diffResult.stdout.split('\n')) {
          const match = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
          if (match) {
            const [, add, del, path] = match;
            const file = files.find(f => f.path === path);
            if (file) {
              file.additions = add === '-' ? 0 : parseInt(add);
              file.deletions = del === '-' ? 0 : parseInt(del);
            }
          }
        }
      }
    }

    return files;
  } catch {
    return [];
  }
}

function getOutputDirectory(taskType: string): string {
  const typeToDir: Record<string, string> = {
    design: 'design',
    feature: 'features',
    bugfix: 'bugs',
    refactor: 'refactor',
    test: 'tests',
    docs: 'guides',      // docs/docs 이중 경로 방지
    api: 'api'
  };
  return typeToDir[taskType] || 'misc';
}
