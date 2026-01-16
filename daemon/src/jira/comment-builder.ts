import type { AdfDocument, AdfContent, AdfParagraph, AdfHeading, AdfBulletList, AdfCodeBlock, AdfText } from './types.js';
import type { TaskResult, ChangedFile, FailedAttempt } from '../types.js';

export class CommentBuilder {
  static buildSuccessComment(result: TaskResult, confluenceUrl?: string): AdfDocument {
    const content: AdfContent[] = [];

    // Header
    content.push(this.heading(2, '✅ Claude Code 실행 완료'));

    // Status & Duration
    const durationSec = (result.duration / 1000).toFixed(1);
    content.push(this.paragraph([
      this.text('소요 시간: ', true),
      this.text(`${durationSec}초`),
    ]));

    // Changed files
    if (result.changedFiles.length > 0) {
      content.push(this.heading(3, '📝 변경된 파일'));
      content.push(this.bulletList(
        result.changedFiles.map((file) => this.formatChangedFile(file))
      ));
    }

    // Validation results
    const validationKeys = Object.keys(result.validation);
    if (validationKeys.length > 0) {
      content.push(this.heading(3, '🔍 검증 결과'));
      content.push(this.bulletList(
        validationKeys.map((key) => {
          const val = result.validation[key];
          const status = val?.success ? '✅' : '❌';
          return `${status} ${key}`;
        })
      ));
    }

    // Confluence documentation link
    if (confluenceUrl) {
      content.push(this.heading(3, '📄 문서'));
      content.push(this.paragraph([
        this.text('작업 상세 문서: '),
        this.link(confluenceUrl, 'Confluence에서 보기'),
      ]));
    }

    return {
      type: 'doc',
      version: 1,
      content,
    };
  }

  static buildFailureComment(error: string): AdfDocument {
    const content: AdfContent[] = [];

    // Header
    content.push(this.heading(2, 'Claude Code 실행 실패'));

    // Status
    content.push(this.paragraph([
      this.text('Status: ', true),
      this.text('Failed'),
    ]));

    // Error
    content.push(this.heading(3, '에러 내용'));
    content.push(this.codeBlock(error));

    return {
      type: 'doc',
      version: 1,
      content,
    };
  }

  static buildRetryComment(attempt: number, maxRetries: number, error: string): AdfDocument {
    const content: AdfContent[] = [];

    // Header
    content.push(this.heading(2, `재시도 ${attempt}/${maxRetries}`));

    // Status
    content.push(this.paragraph([
      this.text('이전 시도에서 오류가 발생하여 재시도합니다.'),
    ]));

    // Error from previous attempt
    content.push(this.heading(3, '이전 오류'));
    content.push(this.codeBlock(error));

    return {
      type: 'doc',
      version: 1,
      content,
    };
  }

  // 실패 후 재시도로 해결된 경우 - 기존 실패 코멘트를 업데이트
  static buildResolvedComment(
    failedAttempts: FailedAttempt[],
    result: TaskResult,
    confluenceUrl?: string
  ): AdfDocument {
    const content: AdfContent[] = [];

    // Header - 해결됨 표시
    content.push(this.heading(2, '✅ 트러블슈팅 완료'));

    // 소요 시간
    const durationSec = (result.duration / 1000).toFixed(1);
    content.push(this.paragraph([
      this.text('최종 소요 시간: ', true),
      this.text(`${durationSec}초`),
    ]));

    // 트러블슈팅 히스토리
    content.push(this.heading(3, '🔧 트러블슈팅 히스토리'));

    for (const attempt of failedAttempts) {
      const errorType = attempt.errorType === 'execution' ? '실행 오류' : '검증 실패';
      content.push(this.paragraph([
        this.text(`시도 ${attempt.attempt}: `, true),
        this.text(errorType),
      ]));
      content.push(this.codeBlock(attempt.error.substring(0, 500)));
    }

    // 최종 해결 상태
    content.push(this.heading(3, '✅ 최종 해결'));
    content.push(this.paragraph([
      this.text('Status: ', true),
      this.text('Success - 재시도로 해결됨'),
    ]));

    // 변경된 파일
    if (result.changedFiles.length > 0) {
      content.push(this.heading(3, '📝 변경된 파일'));
      content.push(this.bulletList(
        result.changedFiles.map((file) => this.formatChangedFile(file))
      ));
    }

    // Confluence 링크
    if (confluenceUrl) {
      content.push(this.heading(3, '📄 문서'));
      content.push(this.paragraph([
        this.text('작업 상세 문서: '),
        this.link(confluenceUrl, 'Confluence에서 보기'),
      ]));
    }

    return {
      type: 'doc',
      version: 1,
      content,
    };
  }

  private static heading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string): AdfHeading {
    return {
      type: 'heading',
      attrs: { level },
      content: [this.text(text)],
    };
  }

  private static paragraph(content: AdfText[]): AdfParagraph {
    return {
      type: 'paragraph',
      content,
    };
  }

  private static text(text: string, bold = false): AdfText {
    const node: AdfText = { type: 'text', text };
    if (bold) {
      node.marks = [{ type: 'strong' }];
    }
    return node;
  }

  private static link(url: string, text: string): AdfText {
    return {
      type: 'text',
      text,
      marks: [{ type: 'link', attrs: { href: url } }],
    };
  }

  private static bulletList(items: string[]): AdfBulletList {
    return {
      type: 'bulletList',
      content: items.map((item) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [this.text(item)],
          },
        ],
      })),
    };
  }

  private static codeBlock(code: string, language?: string): AdfCodeBlock {
    return {
      type: 'codeBlock',
      attrs: language ? { language } : undefined,
      content: [this.text(code)],
    };
  }

  private static formatChangedFile(file: ChangedFile): string {
    const statusIcon = {
      added: '➕',
      modified: '📝',
      deleted: '🗑️',
    }[file.status];
    return `${statusIcon} ${file.path} (+${file.additions}, -${file.deletions})`;
  }
}
