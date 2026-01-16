import { join } from 'path';
import { format } from 'date-fns';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';

import { JiraPoller } from './poller.js';
import { JiraUpdater } from './updater.js';
import { JiraClient } from './client.js';
import { mapJiraIssueToTask, extractTextFromAdf, extractMediaFromAdf } from './mapper.js';
import type { JiraConfig, JiraIssue } from './types.js';
import { executeTask, getChangedFiles } from '../executor.js';
import { validateTask, getFailedTestNames, detectProject } from '../validator.js';
import { log, logTaskStart, logTaskEnd } from '../logger.js';
import { notifyTaskComplete, notifyDaemonStatus } from '../notifier.js';
import type { Task, TroubleshootingTracker, FailedAttempt } from '../types.js';
import { ConfluenceService } from '../confluence/service.js';
import type { ConfluenceConfig } from '../confluence/types.js';
import { convertToTroubleshootingItems } from '../troubleshooting-utils.js';

// Load environment variables
dotenvConfig({ path: join(process.env.HOME || '', '.claude', 'workflow', '.env') });

const WORKFLOW_DIR = join(process.env.HOME || '', '.claude', 'workflow');
const LOCK_FILE = join(WORKFLOW_DIR, 'daemon.lock');
const JIRA_CONFIG_PATH = join(WORKFLOW_DIR, 'data', 'jira-config.json');

let shouldStop = false;
let poller: JiraPoller | null = null;
let updater: JiraUpdater | null = null;
let sharedJiraClient: JiraClient | null = null; // 싱글톤 클라이언트
let confluenceService: ConfluenceService | null = null;

// 검토 중 이슈의 마지막 처리한 댓글 ID 추적
const lastProcessedComments: Map<string, string> = new Map();
// 검토 폴링용 마지막 조회 시간
let lastReviewPollTime: Date | null = null;

// 트러블슈팅 상태 저장 (재시도 간 상태 유지)
const troubleshootingState: Map<string, TroubleshootingTracker> = new Map();

// 피드백 히스토리 저장 (이슈별 피드백 기록)
interface FeedbackRecord {
  content: string;
  timestamp: string;
}
const feedbackHistory: Map<string, FeedbackRecord[]> = new Map();

// 이미지 임시 저장 디렉토리
const IMAGE_TEMP_DIR = join(process.env.HOME || '', '.claude', 'workflow', 'temp', 'images');

/**
 * 댓글에서 이미지를 다운로드하고 로컬 경로 반환
 */
async function downloadCommentImages(
  issueKey: string,
  commentBody: unknown
): Promise<string[]> {
  if (!sharedJiraClient) return [];

  const imagePaths: string[] = [];
  const mediaList = extractMediaFromAdf(commentBody);

  if (mediaList.length === 0) return [];

  // 임시 디렉토리 생성
  const issueImageDir = join(IMAGE_TEMP_DIR, issueKey);
  if (!existsSync(issueImageDir)) {
    mkdirSync(issueImageDir, { recursive: true });
  }

  for (const media of mediaList) {
    try {
      const result = await sharedJiraClient.downloadAttachmentByFilename(issueKey, media.filename);
      if (result) {
        const localPath = join(issueImageDir, result.filename);
        writeFileSync(localPath, result.buffer);
        imagePaths.push(localPath);
        log(`Downloaded image: ${result.filename} -> ${localPath}`);
      }
    } catch (err) {
      log(`Failed to download image ${media.filename}: ${err}`, 'error');
    }
  }

  return imagePaths;
}

/**
 * 피드백 텍스트에 이미지 경로 추가
 */
function buildFeedbackWithImages(feedbackText: string, imagePaths: string[]): string {
  if (imagePaths.length === 0) {
    return feedbackText;
  }

  const imageInstructions = imagePaths
    .map(path => `- ${path}`)
    .join('\n');

  return `${feedbackText}

---
[첨부된 이미지]
다음 이미지 파일을 확인하세요:
${imageInstructions}`;
}

/**
 * 에러 해결을 위한 새 이슈 생성 (자동으로 To claude 상태로)
 */
async function createErrorResolutionTask(
  originalIssueKey: string,
  originalTitle: string,
  errorMessage: string,
  errorType: 'execution' | 'validation',
  projectPath: string,
  config: JiraConfig
): Promise<string | null> {
  if (!sharedJiraClient) return null;

  try {
    const summary = `[FIX] ${originalIssueKey} 에러 해결`;
    const description = `## 원본 태스크
- 이슈: ${originalIssueKey}
- 제목: ${originalTitle}
- 프로젝트: ${projectPath}

## 에러 유형
${errorType === 'execution' ? '실행 에러' : '검증 에러 (빌드/테스트 실패)'}

## 에러 내용
\`\`\`
${errorMessage.substring(0, 3000)}
\`\`\`

## 요청사항
위 에러를 분석하고 수정해주세요.
- 에러 원인 파악
- 코드 수정
- 테스트 통과 확인`;

    // 새 이슈 생성
    const newIssue = await sharedJiraClient.createIssue({
      summary,
      description,
      issueType: 'feature', // 또는 적절한 타입
      parentKey: originalIssueKey,
      labels: ['auto-fix', 'error-resolution'],
    });

    log(`Created error resolution task: ${newIssue.key} for ${originalIssueKey}`);

    // "To claude" 상태로 전환
    try {
      await sharedJiraClient.transitionToStatus(newIssue.key, config.statuses.trigger);
      log(`Transitioned ${newIssue.key} to "${config.statuses.trigger}"`);
    } catch (transitionError) {
      log(`Failed to transition ${newIssue.key}: ${transitionError}`, 'warn');
      // 전환 실패해도 이슈는 생성됨
    }

    return newIssue.key;
  } catch (error) {
    log(`Failed to create error resolution task: ${error}`, 'error');
    return null;
  }
}

interface LoadedConfig {
  jira: JiraConfig;
  confluence: ConfluenceConfig;
}

function loadConfig(): LoadedConfig {
  if (!existsSync(JIRA_CONFIG_PATH)) {
    throw new Error(`Jira config not found: ${JIRA_CONFIG_PATH}`);
  }

  const configJson = JSON.parse(readFileSync(JIRA_CONFIG_PATH, 'utf-8'));

  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!email || !apiToken) {
    throw new Error('JIRA_EMAIL and JIRA_API_TOKEN must be set in .env file');
  }

  const jiraConfig: JiraConfig = {
    ...configJson,
    email,
    apiToken,
  };

  const confluenceConfig: ConfluenceConfig = {
    baseUrl: configJson.baseUrl,
    email,
    apiToken,
    spaceKey: configJson.confluence?.spaceKey || 'CLAUDE',
    spaceId: configJson.confluence?.spaceId || '',
    parentPageId: configJson.confluence?.parentPageId,
  };

  return { jira: jiraConfig, confluence: confluenceConfig };
}

function checkSingleton(): boolean {
  if (existsSync(LOCK_FILE)) {
    try {
      const pid = parseInt(readFileSync(LOCK_FILE, 'utf-8').trim());
      process.kill(pid, 0);
      return false;
    } catch {
      unlinkSync(LOCK_FILE);
    }
  }
  writeFileSync(LOCK_FILE, String(process.pid));
  return true;
}

function releaseLock(): void {
  try {
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE);
    }
  } catch {
    // Ignore
  }
}

/**
 * 검토 중 상태의 이슈에서 새 댓글(피드백)을 확인하고 재작업 트리거
 */
async function checkReviewIssuesForFeedback(config: JiraConfig): Promise<void> {
  if (!sharedJiraClient) return;

  try {
    // 증분 폴링: 마지막 조회 이후 업데이트된 이슈만 조회
    let jql = `project = ${config.projectKey} AND status = "${config.statuses.review}"`;

    if (lastReviewPollTime) {
      const sinceTime = new Date(lastReviewPollTime.getTime() - 30000);
      const formattedTime = sinceTime.toISOString().slice(0, 19).replace('T', ' ');
      jql += ` AND updated >= "${formattedTime}"`;
    }

    jql += ' ORDER BY updated DESC';
    const issues = await sharedJiraClient.searchIssues(jql);
    lastReviewPollTime = new Date();

    for (const issue of issues) {
      try {
        const latestComment = await sharedJiraClient.getLatestComment(issue.key);

        if (!latestComment) continue;

        const lastProcessedId = lastProcessedComments.get(issue.key);

        // 새 댓글이 있는 경우
        if (latestComment.id !== lastProcessedId) {
          const feedbackText = extractTextFromAdf(latestComment.body);

          // 봇이 작성한 댓글인지 확인 (작성자명 또는 내용으로 판단)
          const isBotComment =
            latestComment.author.displayName.includes('Claude') ||
            latestComment.author.displayName.includes('Automation') ||
            feedbackText.includes('Claude Code 실행') ||
            feedbackText.includes('🤖') ||
            feedbackText.includes('Status: Success') ||
            feedbackText.includes('Status: Failed') ||
            feedbackText.includes('재시도');

          // 피드백이 비어있지 않고, 봇 댓글이 아닌 경우에만 처리
          // 이미지만 있고 텍스트가 없는 경우도 처리해야 함
          const mediaList = extractMediaFromAdf(latestComment.body);
          const hasContent = feedbackText.trim() || mediaList.length > 0;

          if (hasContent && !isBotComment) {
            log(`New feedback detected on ${issue.key}: ${feedbackText.substring(0, 50)}... (images: ${mediaList.length})`);

            // 마지막 처리 댓글 ID 업데이트
            lastProcessedComments.set(issue.key, latestComment.id);

            // 이미지 다운로드
            const imagePaths = await downloadCommentImages(issue.key, latestComment.body);

            // 피드백에 이미지 경로 추가
            const feedbackWithImages = buildFeedbackWithImages(feedbackText, imagePaths);

            // 피드백 히스토리에 기록
            const history = feedbackHistory.get(issue.key) || [];
            history.push({
              content: feedbackWithImages,
              timestamp: new Date().toLocaleString('ko-KR'),
            });
            feedbackHistory.set(issue.key, history);

            // 피드백을 포함하여 재작업
            await processJiraIssueWithFeedback(issue, config, feedbackWithImages);
          } else {
            // 봇 댓글도 추적하여 중복 처리 방지
            lastProcessedComments.set(issue.key, latestComment.id);
          }
        } else if (!lastProcessedId && latestComment) {
          // 첫 폴링 시 현재 댓글 ID 저장 (재작업 방지)
          lastProcessedComments.set(issue.key, latestComment.id);
        }
      } catch (err) {
        log(`Error checking comments for ${issue.key}: ${err}`, 'error');
      }
    }
  } catch (err) {
    log(`Error polling review issues: ${err}`, 'error');
  }
}

/**
 * 피드백을 포함하여 이슈 재작업
 */
async function processJiraIssueWithFeedback(issue: JiraIssue, config: JiraConfig, feedback: string): Promise<void> {
  const task = mapJiraIssueToTask(issue, config);

  // 피드백 추가
  task.feedback = task.feedback || [];
  task.feedback.push(feedback);

  // 기본 경로 적용
  if (!task.projectPath && config.defaultProjectPath) {
    task.projectPath = config.defaultProjectPath;
  }

  if (!task.projectPath || !existsSync(task.projectPath)) {
    log(`Cannot process feedback for ${issue.key}: invalid project path`, 'error');
    return;
  }

  log(`Re-processing ${issue.key} with feedback`);

  // 일반 처리 로직 호출
  await processJiraIssue(issue, config, feedback);
}

async function processJiraIssue(issue: JiraIssue, config: JiraConfig, feedback?: string): Promise<void> {
  const task = mapJiraIssueToTask(issue, config);
  const startTime = Date.now();

  // 피드백이 있으면 추가
  if (feedback) {
    task.feedback = task.feedback || [];
    task.feedback.push(feedback);
  }

  // 기본 경로 적용: description 파싱 > 커스텀 필드 > 기본값
  if (!task.projectPath && config.defaultProjectPath) {
    task.projectPath = config.defaultProjectPath;
    log(`Using default project path: ${task.projectPath}`);
  }

  if (!task.projectPath) {
    log(`Issue ${issue.key} has no project path, skipping`, 'error');
    await updater?.markAsFailed(issue.key, 'Project path not specified. Add "Project: /path" in description or set defaultProjectPath in config.');
    return;
  }

  if (!existsSync(task.projectPath)) {
    log(`Project path does not exist: ${task.projectPath}`, 'error');
    await updater?.markAsFailed(issue.key, `Project path not found: ${task.projectPath}`);
    return;
  }

  logTaskStart(task.id, task.title, task.projectPath);

  try {
    // Mark as processing in Jira (피드백 재작업 시에도 In Progress로 전환)
    await updater?.markAsProcessing(issue.key);
    if (feedback) {
      log(`Transitioned to In Progress for feedback rework on ${issue.key}`);
    }

    // 작업 전 기존 실패 테스트 수집 (baseline)
    let baselineFailedTests: Set<string> | undefined;
    const projectInfo = detectProject(task.projectPath);
    if (projectInfo.hasTests && projectInfo.testCommand) {
      log('Collecting baseline failed tests before task execution...');
      try {
        const { execa } = await import('execa');
        await execa(projectInfo.testCommand[0], projectInfo.testCommand.slice(1), {
          cwd: task.projectPath,
          timeout: 10 * 60 * 1000,
          reject: false
        });
        baselineFailedTests = getFailedTestNames(task.projectPath);
        if (baselineFailedTests.size > 0) {
          log(`Baseline failed tests: ${baselineFailedTests.size} (${[...baselineFailedTests].slice(0, 3).join(', ')}${baselineFailedTests.size > 3 ? '...' : ''})`);
        }
      } catch (err) {
        log(`Failed to collect baseline tests: ${err}`, 'warn');
      }
    }

    // 트러블슈팅 상태 로드 또는 초기화
    let troubleshooting = troubleshootingState.get(issue.key) || { failedAttempts: [] };

    // 이전 실패 정보가 있으면 task에 적용 (재시도 시 Claude에게 에러 전달)
    if (troubleshooting.lastError) {
      task.lastError = troubleshooting.lastError;
      task.retry.current = troubleshooting.retryCount || 0;
      log(`Retry ${task.retry.current + 1}/${task.retry.max} with previous error`);
    }

    // Execute task
    const execResult = await executeTask(task.projectPath, task);

    if (!execResult.success) {
      const errorMsg = execResult.output.substring(0, 2000);

      // 실패 기록 추가
      const failedAttempt: FailedAttempt = {
        attempt: task.retry.current + 1,
        error: execResult.output.substring(0, 1000),
        errorType: 'execution',
        timestamp: new Date().toISOString(),
      };
      troubleshooting.failedAttempts.push(failedAttempt);

      // 원본 태스크 실패 처리
      await updater?.markAsFailed(issue.key, errorMsg);

      // 에러 해결 태스크 자동 생성 (To claude 상태로)
      const fixTaskKey = await createErrorResolutionTask(
        issue.key,
        task.title,
        errorMsg,
        'execution',
        task.projectPath,
        config
      );

      if (fixTaskKey) {
        log(`Auto-created fix task ${fixTaskKey} for execution error in ${issue.key}`);
      }

      // Confluence 에러 페이지 생성
      const troubleshootingItems = convertToTroubleshootingItems(troubleshooting.failedAttempts, false);
      if (confluenceService) {
        try {
          await confluenceService.createFailedTaskPage(
            issue.key,
            task.title,
            errorMsg,
            task.prompt,
            task.projectPath,
            task.type,
            troubleshootingItems
          );
        } catch (err) {
          log(`Failed to create Confluence error page: ${err}`, 'error');
        }
      }

      // 상태 정리
      troubleshootingState.delete(issue.key);

      notifyTaskComplete(task.title, false);
      logTaskEnd(task.id, task.title, false, Date.now() - startTime);
      return;
    }

    // Run validation (docs 타입은 빌드/테스트 스킵)
    const validationResult = await validateTask(task.projectPath, task.validation, task.type, baselineFailedTests);
    const changedFiles = await getChangedFiles(task.projectPath);

    if (!validationResult.success) {
      const validationError = validationResult.error || 'Validation failed';

      // 검증 실패 기록 추가
      const failedAttempt: FailedAttempt = {
        attempt: task.retry.current + 1,
        error: validationError,
        errorType: 'validation',
        timestamp: new Date().toISOString(),
        validationResults: validationResult.results,
      };
      troubleshooting.failedAttempts.push(failedAttempt);

      // 원본 태스크 실패 처리
      await updater?.markAsFailed(issue.key, validationError);

      // 에러 해결 태스크 자동 생성 (To claude 상태로)
      const fixTaskKey = await createErrorResolutionTask(
        issue.key,
        task.title,
        validationError,
        'validation',
        task.projectPath,
        config
      );

      if (fixTaskKey) {
        log(`Auto-created fix task ${fixTaskKey} for validation error in ${issue.key}`);
      }

      // Confluence 에러 페이지 생성
      const troubleshootingItems = convertToTroubleshootingItems(troubleshooting.failedAttempts, false);
      if (confluenceService) {
        try {
          await confluenceService.createFailedTaskPage(
            issue.key,
            task.title,
            validationError,
            task.prompt,
            task.projectPath,
            task.type,
            troubleshootingItems
          );
        } catch (err) {
          log(`Failed to create Confluence error page: ${err}`, 'error');
        }
      }

      // 상태 정리
      troubleshootingState.delete(issue.key);

      notifyTaskComplete(task.title, false);
      logTaskEnd(task.id, task.title, false, Date.now() - startTime);
      return;
    }

    // Success!
    const result = {
      success: true,
      duration: Date.now() - startTime,
      changedFiles,
      validation: validationResult.results,
      logs: [],
      output: execResult.output, // Claude 실행 결과 포함
    };

    // 트러블슈팅 정보 (재시도 후 성공한 경우)
    const troubleshootingItems = troubleshooting.failedAttempts.length > 0
      ? convertToTroubleshootingItems(troubleshooting.failedAttempts, true)
      : undefined;

    // Create Confluence documentation first to get URL
    let confluenceUrl: string | undefined;
    if (confluenceService) {
      try {
        // 피드백 히스토리 가져오기
        const issueFeedbackHistory = feedbackHistory.get(issue.key);

        confluenceUrl = await confluenceService.createTaskPage(
          issue.key,
          task.title,
          result,
          task.prompt,
          task.projectPath,
          task.type,
          troubleshootingItems,
          issueFeedbackHistory
        );
        log(`Confluence page created: ${confluenceUrl}`);
      } catch (err) {
        log(`Failed to create Confluence page: ${err}`, 'error');
      }
    }

    // 이전에 실패가 있었고 코멘트 ID가 있으면 해당 코멘트를 해결됨으로 업데이트
    if (troubleshooting.failedAttempts.length > 0 && troubleshooting.lastFailureCommentId) {
      try {
        await updater?.updateToResolved(
          issue.key,
          troubleshooting.lastFailureCommentId,
          troubleshooting.failedAttempts,
          result,
          confluenceUrl
        );
        log(`Updated failure comment to resolved for ${issue.key}`);
      } catch (err) {
        log(`Failed to update failure comment: ${err}`, 'error');
        // 업데이트 실패해도 성공 코멘트는 추가
        await updater?.markAsComplete(issue.key, result, confluenceUrl);
      }
    } else {
      // 첫 시도에서 성공한 경우 일반 성공 코멘트
      await updater?.markAsComplete(issue.key, result, confluenceUrl);
    }

    // 상태 정리
    troubleshootingState.delete(issue.key);

    notifyTaskComplete(task.title, true);
    logTaskEnd(task.id, task.title, true, Date.now() - startTime);

  } catch (error) {
    log(`Error processing ${issue.key}: ${error}`, 'error');
    await updater?.markAsFailed(issue.key, String(error));
    notifyTaskComplete(task.title, false);
    logTaskEnd(task.id, task.title, false, Date.now() - startTime);
  }
}

async function main(): Promise<void> {
  if (!checkSingleton()) {
    console.error('❌ Another daemon instance is already running. Exiting.');
    process.exit(1);
  }

  let config: LoadedConfig;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`❌ Failed to load config: ${error}`);
    releaseLock();
    process.exit(1);
  }

  console.log(`
╔═══════════════════════════════════════════╗
║   Jira Workflow Automation Daemon v2.0    ║
║                                           ║
║  Started at: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}        ║
║  PID: ${String(process.pid).padEnd(37)}║
║  Jira: ${config.jira.baseUrl.substring(0, 35).padEnd(36)}║
║  Project: ${config.jira.projectKey.padEnd(33)}║
╚═══════════════════════════════════════════╝
`);

  log('Jira Daemon starting...');
  notifyDaemonStatus('started');

  // Initialize shared Jira client (싱글톤)
  sharedJiraClient = new JiraClient(config.jira);

  // Initialize Jira components with shared client
  poller = new JiraPoller(config.jira, sharedJiraClient);
  updater = new JiraUpdater(config.jira, sharedJiraClient);
  log('Jira client initialized (shared singleton)');

  // Initialize Confluence service
  if (config.confluence.spaceId) {
    confluenceService = new ConfluenceService(config.confluence);
    try {
      await confluenceService.initialize();
      log(`Confluence connected: ${config.confluence.spaceKey} space`);
    } catch (err) {
      log(`Confluence init failed: ${err}`, 'error');
      confluenceService = null;
    }
  }

  // Start polling for new issues (To Claude status)
  poller.start((issue) => {
    log(`New issue detected: ${issue.key} - ${issue.fields.summary}`);
    processJiraIssue(issue, config.jira);
  });

  // Start polling for feedback on review issues
  let reviewPollInterval: NodeJS.Timeout | null = null;
  const startReviewPolling = () => {
    reviewPollInterval = setInterval(async () => {
      await checkReviewIssuesForFeedback(config.jira);
    }, config.jira.pollInterval * 3); // 검토 중 이슈는 더 느린 주기로 폴링

    // 초기 폴링
    checkReviewIssuesForFeedback(config.jira);
  };
  startReviewPolling();
  log('Review feedback polling started');

  // Handle graceful shutdown
  const shutdown = () => {
    log('Shutting down...');
    shouldStop = true;
    poller?.stop();
    if (reviewPollInterval) clearInterval(reviewPollInterval);
    releaseLock();
    notifyDaemonStatus('stopped');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process alive
  while (!shouldStop) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

main().catch((error) => {
  log(`Fatal error: ${error}`, 'error');
  releaseLock();
  process.exit(1);
});
