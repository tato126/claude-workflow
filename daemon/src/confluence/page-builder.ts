import type { TaskResult, ChangedFile } from '../types.js';

export interface TroubleshootingItem {
  problem: string;
  cause: string;
  solution: string;
  resolved: boolean;
}

export interface FeedbackItem {
  content: string;
  timestamp: string;
}

export interface TaskPageData {
  issueKey: string;
  title: string;
  result: TaskResult;
  prompt: string;
  projectPath?: string;
  troubleshooting?: TroubleshootingItem[];
  feedbackHistory?: FeedbackItem[];
}

export class PageBuilder {
  static buildTaskPage(data: TaskPageData): string {
    const { issueKey, title, result, prompt, projectPath, troubleshooting, feedbackHistory } = data;
    const status = result.success ? '✅ 성공' : '❌ 실패';
    const statusColor = result.success ? 'Green' : 'Red';
    const duration = (result.duration / 1000).toFixed(1);

    let html = `
<table data-table-width="760" data-layout="default">
  <colgroup><col style="width: 180.0px;" /><col style="width: 580.0px;" /></colgroup>
  <tbody>
    <tr><th colspan="2"><p style="text-align: center;"><strong>작업 개요</strong></p></th></tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":ticket:" ac:emoji-id="1f3ab" ac:emoji-fallback="🎫" /> <strong>Jira 이슈</strong></p></th>
      <td><p><a href="https://heechanlog.atlassian.net/browse/${issueKey}">${issueKey}</a> - ${title}</p></td>
    </tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":clipboard:" ac:emoji-id="1f4cb" ac:emoji-fallback="📋" /> <strong>상태</strong></p></th>
      <td><p><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">${statusColor}</ac:parameter><ac:parameter ac:name="title">${status}</ac:parameter></ac:structured-macro></p></td>
    </tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":stopwatch:" ac:emoji-id="23f1" ac:emoji-fallback="⏱️" /> <strong>소요 시간</strong></p></th>
      <td><p>${duration}초</p></td>
    </tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":calendar:" ac:emoji-id="1f4c5" ac:emoji-fallback="📅" /> <strong>완료 시간</strong></p></th>
      <td><p>${new Date().toLocaleString('ko-KR')}</p></td>
    </tr>
    ${projectPath ? `<tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":file_folder:" ac:emoji-id="1f4c1" ac:emoji-fallback="📁" /> <strong>프로젝트</strong></p></th>
      <td><p><code>${projectPath}</code></p></td>
    </tr>` : ''}
  </tbody>
</table>

<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":dart:" ac:emoji-id="1f3af" ac:emoji-fallback="🎯" /> 프롬프트</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">text</ac:parameter>
  <ac:plain-text-body><![CDATA[${prompt}]]></ac:plain-text-body>
</ac:structured-macro>

<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":robot:" ac:emoji-id="1f916" ac:emoji-fallback="🤖" /> Claude 작업 결과</h2>
${result.output ? this.convertMarkdownToConfluence(result.output) : '<p><em>출력 없음</em></p>'}
`;

    // 변경된 파일 섹션
    if (result.changedFiles.length > 0) {
      html += `
<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":pencil:" ac:emoji-id="270f" ac:emoji-fallback="✏️" /> 변경된 파일</h2>
<table data-layout="default">
  <colgroup>
    <col style="width: 400.0px;" />
    <col style="width: 120.0px;" />
    <col style="width: 80.0px;" />
    <col style="width: 80.0px;" />
  </colgroup>
  <tbody>
    <tr>
      <th data-highlight-colour="var(--ds-background-accent-blue-subtlest, #deebff)"><p><strong>파일</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-blue-subtlest, #deebff)"><p><strong>상태</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-blue-subtlest, #deebff)"><p><strong>추가</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-blue-subtlest, #deebff)"><p><strong>삭제</strong></p></th>
    </tr>
    ${result.changedFiles.map(f => `<tr>
      <td><p><code>${f.path}</code></p></td>
      <td><p>${this.getStatusBadge(f.status)}</p></td>
      <td><p style="color: green;">+${f.additions}</p></td>
      <td><p style="color: red;">-${f.deletions}</p></td>
    </tr>`).join('')}
  </tbody>
</table>
`;

      // 문서 파일 내용 섹션 (content가 있는 파일만)
      const filesWithContent = result.changedFiles.filter(f => f.content);
      if (filesWithContent.length > 0) {
        html += `
<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":page_facing_up:" ac:emoji-id="1f4c4" ac:emoji-fallback="📄" /> 생성된 문서</h2>
`;
        for (const file of filesWithContent) {
          const fileName = file.path.split('/').pop() || file.path;
          const language = this.getLanguageFromPath(file.path);
          html += `
<h3>${fileName}</h3>
<p><code>${file.path}</code></p>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">${language}</ac:parameter>
  <ac:parameter ac:name="collapse">false</ac:parameter>
  <ac:plain-text-body><![CDATA[${file.content}]]></ac:plain-text-body>
</ac:structured-macro>
`;
        }
      }
    }

    // 검증 결과 섹션
    const validationKeys = Object.keys(result.validation);
    if (validationKeys.length > 0) {
      html += `
<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":bar_chart:" ac:emoji-id="1f4ca" ac:emoji-fallback="📊" /> 검증 결과</h2>
<table data-layout="default">
  <colgroup>
    <col style="width: 200.0px;" />
    <col style="width: 100.0px;" />
    <col style="width: 460.0px;" />
  </colgroup>
  <tbody>
    <tr>
      <th data-highlight-colour="var(--ds-background-accent-teal-subtlest, #e6fcff)"><p><strong>항목</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-teal-subtlest, #e6fcff)"><p><strong>결과</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-teal-subtlest, #e6fcff)"><p><strong>상세</strong></p></th>
    </tr>
    ${validationKeys.map(key => {
      const val = result.validation[key];
      const icon = val?.success ? '✅' : '❌';
      const color = val?.success ? 'Green' : 'Red';
      const output = val?.output ? val.output.substring(0, 200) : '-';
      return `<tr>
      <td><p>${key}</p></td>
      <td><p><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">${color}</ac:parameter><ac:parameter ac:name="title">${icon}</ac:parameter></ac:structured-macro></p></td>
      <td><p>${output}</p></td>
    </tr>`;
    }).join('')}
  </tbody>
</table>
`;
    }

    // 트러블슈팅 섹션
    if (troubleshooting && troubleshooting.length > 0) {
      html += `
<h2><ac:emoticon ac:name="warning" ac:emoji-shortname=":warning:" ac:emoji-id="atlassian-warning" ac:emoji-fallback=":warning:" /> 트러블슈팅</h2>
<table data-layout="default">
  <colgroup>
    <col style="width: 180.0px;" />
    <col style="width: 200.0px;" />
    <col style="width: 280.0px;" />
    <col style="width: 100.0px;" />
  </colgroup>
  <tbody>
    <tr>
      <th data-highlight-colour="var(--ds-background-accent-yellow-subtlest, #fffae6)"><p><strong>문제</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-yellow-subtlest, #fffae6)"><p><strong>원인</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-yellow-subtlest, #fffae6)"><p><strong>해결 방법</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-yellow-subtlest, #fffae6)"><p><strong>상태</strong></p></th>
    </tr>
    ${troubleshooting.map(t => `<tr>
      <td><p>${t.problem}</p></td>
      <td><p>${t.cause}</p></td>
      <td><p>${t.solution}</p></td>
      <td><p><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">${t.resolved ? 'Green' : 'Red'}</ac:parameter><ac:parameter ac:name="title">${t.resolved ? '해결됨' : '미해결'}</ac:parameter></ac:structured-macro></p></td>
    </tr>`).join('')}
  </tbody>
</table>
`;
    }

    // 피드백 히스토리 섹션
    if (feedbackHistory && feedbackHistory.length > 0) {
      html += `
<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":speech_balloon:" ac:emoji-id="1f4ac" ac:emoji-fallback="💬" /> 피드백 히스토리</h2>
<table data-layout="default">
  <colgroup>
    <col style="width: 180.0px;" />
    <col style="width: 580.0px;" />
  </colgroup>
  <tbody>
    <tr>
      <th data-highlight-colour="var(--ds-background-accent-purple-subtlest, #ede7f6)"><p><strong>시간</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-purple-subtlest, #ede7f6)"><p><strong>피드백 내용</strong></p></th>
    </tr>
    ${feedbackHistory.map(f => `<tr>
      <td><p>${f.timestamp}</p></td>
      <td><p>${f.content}</p></td>
    </tr>`).join('')}
  </tbody>
</table>
`;
    }

    // 참조 링크 섹션
    html += `
<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":link:" ac:emoji-id="1f517" ac:emoji-fallback="🔗" /> 참조 링크</h2>
<ul>
  <li><p><a href="https://heechanlog.atlassian.net/browse/${issueKey}">Jira 이슈: ${issueKey}</a></p></li>
</ul>
`;

    return html;
  }

  static buildFailedTaskPage(
    issueKey: string,
    title: string,
    error: string,
    prompt: string,
    projectPath?: string,
    troubleshooting?: TroubleshootingItem[]
  ): string {
    let html = `
<table data-table-width="760" data-layout="default">
  <colgroup><col style="width: 180.0px;" /><col style="width: 580.0px;" /></colgroup>
  <tbody>
    <tr><th colspan="2"><p style="text-align: center;"><strong>작업 개요</strong></p></th></tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":ticket:" ac:emoji-id="1f3ab" ac:emoji-fallback="🎫" /> <strong>Jira 이슈</strong></p></th>
      <td><p><a href="https://heechanlog.atlassian.net/browse/${issueKey}">${issueKey}</a> - ${title}</p></td>
    </tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":clipboard:" ac:emoji-id="1f4cb" ac:emoji-fallback="📋" /> <strong>상태</strong></p></th>
      <td><p><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">Red</ac:parameter><ac:parameter ac:name="title">❌ 실패</ac:parameter></ac:structured-macro></p></td>
    </tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":calendar:" ac:emoji-id="1f4c5" ac:emoji-fallback="📅" /> <strong>실패 시간</strong></p></th>
      <td><p>${new Date().toLocaleString('ko-KR')}</p></td>
    </tr>
    ${projectPath ? `<tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":file_folder:" ac:emoji-id="1f4c1" ac:emoji-fallback="📁" /> <strong>프로젝트</strong></p></th>
      <td><p><code>${projectPath}</code></p></td>
    </tr>` : ''}
  </tbody>
</table>

<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":dart:" ac:emoji-id="1f3af" ac:emoji-fallback="🎯" /> 프롬프트</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">text</ac:parameter>
  <ac:plain-text-body><![CDATA[${prompt}]]></ac:plain-text-body>
</ac:structured-macro>

<h2><ac:emoticon ac:name="cross" ac:emoji-shortname=":x:" ac:emoji-id="274c" ac:emoji-fallback="❌" /> 에러 내용</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">text</ac:parameter>
  <ac:parameter ac:name="collapse">true</ac:parameter>
  <ac:plain-text-body><![CDATA[${error}]]></ac:plain-text-body>
</ac:structured-macro>
`;

    // 트러블슈팅 섹션
    if (troubleshooting && troubleshooting.length > 0) {
      html += `
<h2><ac:emoticon ac:name="warning" ac:emoji-shortname=":warning:" ac:emoji-id="atlassian-warning" ac:emoji-fallback=":warning:" /> 트러블슈팅</h2>
<table data-layout="default">
  <colgroup>
    <col style="width: 180.0px;" />
    <col style="width: 200.0px;" />
    <col style="width: 280.0px;" />
    <col style="width: 100.0px;" />
  </colgroup>
  <tbody>
    <tr>
      <th data-highlight-colour="var(--ds-background-accent-yellow-subtlest, #fffae6)"><p><strong>문제</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-yellow-subtlest, #fffae6)"><p><strong>원인</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-yellow-subtlest, #fffae6)"><p><strong>해결 방법</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-yellow-subtlest, #fffae6)"><p><strong>상태</strong></p></th>
    </tr>
    ${troubleshooting.map(t => `<tr>
      <td><p>${t.problem}</p></td>
      <td><p>${t.cause}</p></td>
      <td><p>${t.solution}</p></td>
      <td><p><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">${t.resolved ? 'Green' : 'Red'}</ac:parameter><ac:parameter ac:name="title">${t.resolved ? '해결됨' : '미해결'}</ac:parameter></ac:structured-macro></p></td>
    </tr>`).join('')}
  </tbody>
</table>
`;
    }

    // 참조 링크 섹션
    html += `
<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":link:" ac:emoji-id="1f517" ac:emoji-fallback="🔗" /> 참조 링크</h2>
<ul>
  <li><p><a href="https://heechanlog.atlassian.net/browse/${issueKey}">Jira 이슈: ${issueKey}</a></p></li>
</ul>
`;

    return html;
  }

  static buildDailyReportPage(
    date: string,
    tasks: Array<{ issueKey: string; title: string; success: boolean; duration: number }>
  ): string {
    const successCount = tasks.filter(t => t.success).length;
    const failCount = tasks.length - successCount;
    const totalDuration = tasks.reduce((sum, t) => sum + t.duration, 0);

    return `
<table data-table-width="760" data-layout="default">
  <colgroup><col style="width: 180.0px;" /><col style="width: 580.0px;" /></colgroup>
  <tbody>
    <tr><th colspan="2"><p style="text-align: center;"><strong>일일 요약</strong></p></th></tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":calendar:" ac:emoji-id="1f4c5" ac:emoji-fallback="📅" /> <strong>날짜</strong></p></th>
      <td><p>${date}</p></td>
    </tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":clipboard:" ac:emoji-id="1f4cb" ac:emoji-fallback="📋" /> <strong>총 작업</strong></p></th>
      <td><p>${tasks.length}건</p></td>
    </tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":white_check_mark:" ac:emoji-id="2705" ac:emoji-fallback="✅" /> <strong>성공</strong></p></th>
      <td><p><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">Green</ac:parameter><ac:parameter ac:name="title">${successCount}건</ac:parameter></ac:structured-macro></p></td>
    </tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":x:" ac:emoji-id="274c" ac:emoji-fallback="❌" /> <strong>실패</strong></p></th>
      <td><p><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">${failCount > 0 ? 'Red' : 'Green'}</ac:parameter><ac:parameter ac:name="title">${failCount}건</ac:parameter></ac:structured-macro></p></td>
    </tr>
    <tr>
      <th><p><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":stopwatch:" ac:emoji-id="23f1" ac:emoji-fallback="⏱️" /> <strong>총 소요 시간</strong></p></th>
      <td><p>${(totalDuration / 1000).toFixed(1)}초</p></td>
    </tr>
  </tbody>
</table>

<h2><ac:emoticon ac:name="blue-star" ac:emoji-shortname=":bar_chart:" ac:emoji-id="1f4ca" ac:emoji-fallback="📊" /> 작업 목록</h2>
<table data-layout="default">
  <colgroup>
    <col style="width: 120.0px;" />
    <col style="width: 340.0px;" />
    <col style="width: 100.0px;" />
    <col style="width: 100.0px;" />
  </colgroup>
  <tbody>
    <tr>
      <th data-highlight-colour="var(--ds-background-accent-blue-subtlest, #deebff)"><p><strong>이슈</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-blue-subtlest, #deebff)"><p><strong>제목</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-blue-subtlest, #deebff)"><p><strong>결과</strong></p></th>
      <th data-highlight-colour="var(--ds-background-accent-blue-subtlest, #deebff)"><p><strong>소요 시간</strong></p></th>
    </tr>
    ${tasks.map(t => `<tr>
      <td><p><a href="https://heechanlog.atlassian.net/browse/${t.issueKey}">${t.issueKey}</a></p></td>
      <td><p>${t.title}</p></td>
      <td><p><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">${t.success ? 'Green' : 'Red'}</ac:parameter><ac:parameter ac:name="title">${t.success ? '✅' : '❌'}</ac:parameter></ac:structured-macro></p></td>
      <td><p>${(t.duration / 1000).toFixed(1)}초</p></td>
    </tr>`).join('')}
  </tbody>
</table>
`;
  }

  private static getStatusBadge(status: string): string {
    switch (status) {
      case 'added':
        return '<ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">Green</ac:parameter><ac:parameter ac:name="title">➕ 추가</ac:parameter></ac:structured-macro>';
      case 'modified':
        return '<ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">Blue</ac:parameter><ac:parameter ac:name="title">📝 수정</ac:parameter></ac:structured-macro>';
      case 'deleted':
        return '<ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">Red</ac:parameter><ac:parameter ac:name="title">🗑️ 삭제</ac:parameter></ac:structured-macro>';
      default:
        return status;
    }
  }

  private static getLanguageFromPath(filePath: string): string {
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    const languageMap: Record<string, string> = {
      '.md': 'markdown',
      '.txt': 'text',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.html': 'html',
      '.css': 'css',
      '.ts': 'typescript',
      '.js': 'javascript',
      '.tsx': 'typescript',
      '.jsx': 'javascript',
    };
    return languageMap[ext] || 'text';
  }

  /**
   * 마크다운을 Confluence Storage Format으로 변환
   */
  private static convertMarkdownToConfluence(markdown: string): string {
    if (!markdown) return '';

    let html = markdown
      // 코드 블록 (```language ... ```)
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const language = lang || 'text';
        return `<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">${language}</ac:parameter><ac:plain-text-body><![CDATA[${code.trim()}]]></ac:plain-text-body></ac:structured-macro>`;
      })
      // 인라인 코드 (`code`)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 헤딩 (# ~ ######)
      .replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
      .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
      .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
      // 굵게 (**text**)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // 이탤릭 (*text*)
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // 링크 [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // 순서 없는 리스트 (- item)
      .replace(/^-\s+(.*)$/gm, '<li>$1</li>')
      // 순서 있는 리스트 (1. item)
      .replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>')
      // 테이블 처리 (간단한 마크다운 테이블)
      .replace(/^\|(.+)\|$/gm, (match, content) => {
        const cells = content.split('|').map((c: string) => c.trim());
        const isHeader = cells.every((c: string) => /^-+$/.test(c));
        if (isHeader) return ''; // 구분선 행 제거
        const cellTag = match.includes('---') ? 'th' : 'td';
        return '<tr>' + cells.map((c: string) => `<${cellTag}><p>${c}</p></${cellTag}>`).join('') + '</tr>';
      })
      // 빈 줄을 단락으로
      .replace(/\n\n+/g, '</p><p>')
      // 단일 줄바꿈을 <br>로
      .replace(/\n/g, '<br/>');

    // li 태그들을 ul로 감싸기
    html = html.replace(/(<li>.*?<\/li>)+/gs, '<ul>$&</ul>');

    // tr 태그들을 table로 감싸기
    html = html.replace(/(<tr>.*?<\/tr>)+/gs, '<table data-layout="default"><tbody>$&</tbody></table>');

    // 전체를 p 태그로 감싸기 (이미 블록 요소가 아닌 경우)
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }

    return html;
  }
}
