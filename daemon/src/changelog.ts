import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';
import type { Task, ChangedFile, ValidationResult } from './types.js';
import { getChangedFiles } from './executor.js';
import { log } from './logger.js';

export async function generateChangelog(
  projectPath: string,
  task: Task,
  validation: ValidationResult,
  success: boolean = true
): Promise<void> {
  const docsDir = join(projectPath, 'docs');
  const today = format(new Date(), 'yyyy-MM-dd');
  const changedFiles = await getChangedFiles(projectPath);

  // 1. 일별 작업 내용 (docs/daily/)
  await updateDailyWork(docsDir, today, task, validation, success);

  // 2. 일별 변경 내용 (docs/changes/)
  await updateDailyChanges(docsDir, today, task, changedFiles);

  if (success) {
    // 3. 태스크 문서화 (docs/tasks/) - 성공 시
    await createTaskDocument(docsDir, task, changedFiles, validation, 'tasks');
    // 4. 메인 CHANGELOG.md - 성공 시만
    await updateMainChangelog(docsDir, today, task, changedFiles);
  } else {
    // 3. 실패한 태스크 문서화 (docs/failed/)
    await createTaskDocument(docsDir, task, changedFiles, validation, 'failed');
  }

  log(`Documentation updated for task: ${task.title} (${success ? 'success' : 'failed'})`);
}

// 일별 작업 내용 (프롬프트, 검증 결과, 완료 시간 등)
async function updateDailyWork(
  docsDir: string,
  date: string,
  task: Task,
  validation: ValidationResult,
  success: boolean
): Promise<void> {
  const filePath = join(docsDir, 'daily', `${date}.md`);
  let content = '';

  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf-8');
  } else {
    content = `# ${date} 작업 내용\n\n`;
  }

  const typeIcon = getTypeIcon(task.type);
  const time = format(new Date(), 'HH:mm:ss');

  const statusIcon = success ? '✅' : '❌';
  const statusText = success ? '성공' : '실패';

  const taskSection = `
---

## [${time}] ${statusIcon} ${task.title}

### 상태
${statusIcon} ${statusText}

### 타입
${typeIcon} ${task.type}

### 프롬프트
> ${task.prompt.replace(/\n/g, '\n> ')}

### 검증 결과
${Object.entries(validation).map(([key, val]) => {
  const icon = val?.success ? '✅' : '❌';
  const output = val?.output ? `\n  - ${val.output.substring(0, 100)}...` : '';
  return `- ${icon} ${key}${output}`;
}).join('\n')}

### 태스크 ID
\`${task.id}\`
`;

  content += taskSection;
  writeFileSync(filePath, content);
}

// 일별 변경 내용 (파일 목록, 라인 수)
async function updateDailyChanges(
  docsDir: string,
  date: string,
  task: Task,
  changedFiles: ChangedFile[]
): Promise<void> {
  const filePath = join(docsDir, 'changes', `${date}.md`);
  let content = '';

  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf-8');
  } else {
    content = `# ${date} 변경 내용\n\n`;
  }

  const totalAdditions = changedFiles.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = changedFiles.reduce((sum, f) => sum + f.deletions, 0);
  const time = format(new Date(), 'HH:mm:ss');

  const changeSection = `
---

## [${time}] ${task.title}

### 변경 파일
| 파일 | 상태 | 추가 | 삭제 |
|------|------|------|------|
${changedFiles.length > 0
  ? changedFiles.map(f => `| \`${f.path}\` | ${getStatusIcon(f.status)} | +${f.additions} | -${f.deletions} |`).join('\n')
  : '| (변경 없음) | - | - | - |'}

### 통계
- **총 파일**: ${changedFiles.length}개
- **추가**: +${totalAdditions} 라인
- **삭제**: -${totalDeletions} 라인
`;

  content += changeSection;
  writeFileSync(filePath, content);
}

// 태스크 문서화 (개별 태스크 상세)
async function createTaskDocument(
  docsDir: string,
  task: Task,
  changedFiles: ChangedFile[],
  validation: ValidationResult,
  outputDir: 'tasks' | 'failed' = 'tasks'
): Promise<void> {
  const filePath = join(docsDir, outputDir, `${task.id}.md`);
  const totalAdditions = changedFiles.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = changedFiles.reduce((sum, f) => sum + f.deletions, 0);
  const isFailed = outputDir === 'failed';
  const statusIcon = isFailed ? '❌' : '✅';
  const statusText = isFailed ? '실패' : '완료';

  const content = `# ${statusIcon} ${task.title}

## 메타데이터
| 항목 | 값 |
|------|-----|
| ID | \`${task.id}\` |
| 결과 | ${statusIcon} ${statusText} |
| 타입 | ${getTypeIcon(task.type)} ${task.type} |
| 생성 | ${task.createdAt} |
| 시작 | ${task.startedAt || '-'} |
| 완료 | ${task.completedAt || format(new Date(), 'yyyy-MM-dd HH:mm:ss')} |
| 상태 | ${task.status} |

## 프롬프트
\`\`\`
${task.prompt}
\`\`\`

${task.feedback && task.feedback.length > 0 ? `## 피드백
${task.feedback.map((f, i) => `${i + 1}. ${f}`).join('\n')}
` : ''}

## 변경 파일
| 파일 | 상태 | 추가 | 삭제 |
|------|------|------|------|
${changedFiles.length > 0
  ? changedFiles.map(f => `| \`${f.path}\` | ${getStatusIcon(f.status)} | +${f.additions} | -${f.deletions} |`).join('\n')
  : '| (변경 없음) | - | - | - |'}

**총계**: ${changedFiles.length}개 파일, +${totalAdditions} / -${totalDeletions} 라인

## 검증 결과
${Object.entries(validation).map(([key, val]) => {
  const icon = val?.success ? '✅' : '❌';
  return `### ${icon} ${key}
\`\`\`
${val?.output || '(출력 없음)'}
\`\`\``;
}).join('\n\n')}
`;

  writeFileSync(filePath, content);
}

// 메인 CHANGELOG.md (요약 + 링크)
async function updateMainChangelog(
  docsDir: string,
  date: string,
  task: Task,
  _changedFiles: ChangedFile[]
): Promise<void> {
  const filePath = join(docsDir, 'CHANGELOG.md');
  let content = '';

  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf-8');
  } else {
    content = `# Changelog\n\n`;
  }

  const typeIcon = getTypeIcon(task.type);
  const todayHeader = `## ${date}`;
  const dateLinks = `\n📁 [작업 내용](daily/${date}.md) | 📊 [변경 내역](changes/${date}.md)\n`;

  // Check if today's section exists
  if (!content.includes(todayHeader)) {
    // Add new date section after the title
    const insertPos = content.indexOf('\n\n') + 2;
    content = content.slice(0, insertPos) + `${todayHeader}\n\n${dateLinks}\n---\n\n` + content.slice(insertPos);
  }

  // Find position to insert task (after date header, before date links)
  const datePos = content.indexOf(todayHeader);
  const nextDatePos = content.indexOf('\n## ', datePos + todayHeader.length);
  const sectionEnd = nextDatePos === -1 ? content.length : nextDatePos;

  // Get current date section
  const dateSection = content.slice(datePos, sectionEnd);

  // Task entry (간단히 제목 + 상세 링크만)
  const taskTitle = task.title.split('\n')[0].substring(0, 50);
  const taskEntry = `- ${typeIcon} **${taskTitle}** → [상세](tasks/${task.id}.md)\n`;

  // Insert after header line
  const headerEndPos = dateSection.indexOf('\n\n') + 2;
  const newDateSection = dateSection.slice(0, headerEndPos) + taskEntry + dateSection.slice(headerEndPos);

  content = content.slice(0, datePos) + newDateSection + content.slice(sectionEnd);
  writeFileSync(filePath, content);
}

function getTypeIcon(type: Task['type']): string {
  const icons: Record<string, string> = {
    feature: '✨',
    bugfix: '🐛',
    refactor: '♻️',
    test: '🧪',
    docs: '📝',
    design: '📋'
  };
  return icons[type] || '📋';
}

function getTypeLabel(type: Task['type']): string {
  const labels: Record<string, string> = {
    feature: 'Features',
    bugfix: 'Bug Fixes',
    refactor: 'Refactoring',
    test: 'Tests',
    docs: 'Documentation',
    design: 'Design'
  };
  return labels[type] || 'Other';
}

function getStatusIcon(status: ChangedFile['status']): string {
  const icons: Record<string, string> = {
    added: '🆕',
    modified: '📝',
    deleted: '🗑️'
  };
  return icons[status] || '📝';
}
