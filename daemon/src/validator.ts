import { execa } from 'execa';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ValidationResult } from './types.js';
import { log } from './logger.js';

// 실패한 테스트 이름 파싱 (Gradle XML 결과)
export function getFailedTestNames(projectPath: string): Set<string> {
  const failedTests = new Set<string>();
  const testResultsDir = join(projectPath, 'build', 'test-results', 'test');

  if (!existsSync(testResultsDir)) {
    return failedTests;
  }

  try {
    const files = readdirSync(testResultsDir).filter(f => f.endsWith('.xml'));

    for (const file of files) {
      const content = readFileSync(join(testResultsDir, file), 'utf-8');
      // <testcase> 태그에서 실패/에러 찾기
      const testcaseRegex = /<testcase[^>]*name="([^"]*)"[^>]*classname="([^"]*)"[^>]*>([\s\S]*?)<\/testcase>/g;
      let match;

      while ((match = testcaseRegex.exec(content)) !== null) {
        const [, testName, className, body] = match;
        if (body.includes('<failure') || body.includes('<error')) {
          failedTests.add(`${className}.${testName}`);
        }
      }

      // self-closing testcase with failure
      const selfClosingRegex = /<testcase[^>]*name="([^"]*)"[^>]*classname="([^"]*)"[^/]*\/>/g;
      // These are passed tests, skip
    }
  } catch (err) {
    log(`Error parsing test results: ${err}`, 'warn');
  }

  return failedTests;
}

interface ProjectInfo {
  language: string;
  framework?: string;
  buildCommand?: string[];
  testCommand?: string[];
  hasTests: boolean;
}

// Detect project language and framework
export function detectProject(projectPath: string): ProjectInfo {
  // Node.js / JavaScript / TypeScript
  if (existsSync(join(projectPath, 'package.json'))) {
    const hasTests = existsSync(join(projectPath, 'test')) ||
                     existsSync(join(projectPath, 'tests')) ||
                     existsSync(join(projectPath, '__tests__')) ||
                     existsSync(join(projectPath, 'src', '__tests__'));
    return {
      language: 'node',
      framework: existsSync(join(projectPath, 'next.config.js')) ? 'nextjs' :
                 existsSync(join(projectPath, 'vite.config.ts')) ? 'vite' : undefined,
      buildCommand: ['npm', 'run', 'build'],
      testCommand: ['npm', 'test'],
      hasTests
    };
  }

  // Java - Gradle
  if (existsSync(join(projectPath, 'build.gradle')) ||
      existsSync(join(projectPath, 'build.gradle.kts'))) {
    const gradlew = existsSync(join(projectPath, 'gradlew')) ? './gradlew' : 'gradle';
    const hasTests = existsSync(join(projectPath, 'src', 'test'));
    return {
      language: 'java',
      framework: 'gradle',
      buildCommand: [gradlew, 'build', '-x', 'test'],
      testCommand: [gradlew, 'test'],
      hasTests
    };
  }

  // Java - Maven
  if (existsSync(join(projectPath, 'pom.xml'))) {
    const hasTests = existsSync(join(projectPath, 'src', 'test'));
    return {
      language: 'java',
      framework: 'maven',
      buildCommand: ['mvn', 'package', '-DskipTests'],
      testCommand: ['mvn', 'test'],
      hasTests
    };
  }

  // Python
  if (existsSync(join(projectPath, 'requirements.txt')) ||
      existsSync(join(projectPath, 'pyproject.toml')) ||
      existsSync(join(projectPath, 'setup.py'))) {
    const hasTests = existsSync(join(projectPath, 'tests')) ||
                     existsSync(join(projectPath, 'test'));
    return {
      language: 'python',
      buildCommand: undefined, // Python typically doesn't have a build step
      testCommand: ['pytest'],
      hasTests
    };
  }

  // Go
  if (existsSync(join(projectPath, 'go.mod'))) {
    const hasTests = true; // Go tests are typically in the same directory
    return {
      language: 'go',
      buildCommand: ['go', 'build', './...'],
      testCommand: ['go', 'test', './...'],
      hasTests
    };
  }

  // Rust
  if (existsSync(join(projectPath, 'Cargo.toml'))) {
    const hasTests = true; // Rust tests are typically in the same file
    return {
      language: 'rust',
      buildCommand: ['cargo', 'build'],
      testCommand: ['cargo', 'test'],
      hasTests
    };
  }

  // C/C++ with Makefile
  if (existsSync(join(projectPath, 'Makefile'))) {
    const hasTests = existsSync(join(projectPath, 'test')) ||
                     existsSync(join(projectPath, 'tests'));
    return {
      language: 'c/c++',
      buildCommand: ['make'],
      testCommand: hasTests ? ['make', 'test'] : undefined,
      hasTests
    };
  }

  // Unknown project
  return {
    language: 'unknown',
    hasTests: false
  };
}

// Run automatic validation based on project type
export async function validateTask(
  projectPath: string,
  _validations?: string[], // Kept for backward compatibility, but ignored
  taskType?: string, // Task type (docs, feature, bugfix, etc.)
  baselineFailedTests?: Set<string> // 작업 전 이미 실패했던 테스트 목록
): Promise<{ success: boolean; results: ValidationResult; error?: string }> {
  const results: ValidationResult = {};
  let allPassed = true;
  let firstError: string | undefined;

  // docs 타입은 빌드/테스트 스킵
  if (taskType === 'docs') {
    log('Documentation task - skipping build/test validation');
    return { success: true, results: {} };
  }

  const projectInfo = detectProject(projectPath);
  log(`Detected project: ${projectInfo.language}${projectInfo.framework ? ` (${projectInfo.framework})` : ''}`);

  // 1. Always run Codex review
  log('Running Codex review...');
  const reviewResult = await runCodexReview(projectPath);
  results['codex-review'] = reviewResult;
  // Codex review doesn't fail the validation, just provides feedback

  // 2. Run build if available
  if (projectInfo.buildCommand) {
    log(`Running build: ${projectInfo.buildCommand.join(' ')}`);
    const buildResult = await runCommand(projectPath, projectInfo.buildCommand, 'build');
    results['build'] = buildResult;
    if (!buildResult.success) {
      allPassed = false;
      firstError = `Build failed: ${buildResult.output.substring(0, 500)}`;
    }
  }

  // 3. Run tests if available and build passed
  if (allPassed && projectInfo.hasTests && projectInfo.testCommand) {
    log(`Running tests: ${projectInfo.testCommand.join(' ')}`);
    const testResult = await runCommand(projectPath, projectInfo.testCommand, 'test');
    results['test'] = testResult;

    if (!testResult.success) {
      // 기존 실패 테스트가 있으면 새로운 실패만 체크
      if (baselineFailedTests && baselineFailedTests.size > 0) {
        const currentFailedTests = getFailedTestNames(projectPath);
        const newFailures = [...currentFailedTests].filter(t => !baselineFailedTests.has(t));

        if (newFailures.length === 0) {
          log(`Test failures are all pre-existing (${currentFailedTests.size} baseline failures) - treating as PASSED`);
          testResult.success = true;
          results['test'] = { ...testResult, success: true, output: testResult.output + '\n[INFO] All failures were pre-existing' };
        } else {
          log(`New test failures detected: ${newFailures.join(', ')}`);
          allPassed = false;
          firstError = `New tests failed: ${newFailures.join(', ')}`;
        }
      } else {
        allPassed = false;
        firstError = `Tests failed: ${testResult.output.substring(0, 500)}`;
      }
    }
  }

  return {
    success: allPassed,
    results,
    error: firstError
  };
}

async function runCodexReview(projectPath: string): Promise<{ success: boolean; output: string }> {
  try {
    const result = await execa('codex', ['review', '--uncommitted'], {
      cwd: projectPath,
      timeout: 5 * 60 * 1000, // 5 minutes
      reject: false
    });

    return {
      success: true, // Codex review always "succeeds" - it just provides feedback
      output: result.stdout + '\n' + result.stderr
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Codex review error: ${errorMessage}`);
    return {
      success: true, // Don't fail on codex error
      output: `Codex review unavailable: ${errorMessage}`
    };
  }
}

async function runCommand(
  projectPath: string,
  command: string[],
  type: string
): Promise<{ success: boolean; output: string }> {
  try {
    const result = await execa(command[0], command.slice(1), {
      cwd: projectPath,
      timeout: 10 * 60 * 1000, // 10 minutes
      reject: false
    });

    const output = result.stdout + '\n' + result.stderr;
    const success = result.exitCode === 0;

    log(`${type}: ${success ? 'PASSED' : 'FAILED'}`);

    return { success, output };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`${type} error: ${errorMessage}`);
    return { success: false, output: errorMessage };
  }
}

// Export for use in other modules
export { ProjectInfo };
