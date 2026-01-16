import { NextResponse } from 'next/server';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const projectPath = searchParams.get('project');

    if (!projectPath) {
      return NextResponse.json({ error: 'Project path required' }, { status: 400 });
    }

    const logsDir = join(projectPath, '.claude', 'logs', id);
    const logs: Array<{ attempt: number; content: string }> = [];

    // Read log files
    if (existsSync(logsDir)) {
      const files = readdirSync(logsDir).filter(f => f.startsWith('attempt-'));

      for (const file of files) {
        const match = file.match(/attempt-(\d+)\.log/);
        if (match) {
          const attempt = parseInt(match[1]);
          const content = readFileSync(join(logsDir, file), 'utf-8');
          logs.push({ attempt, content });
        }
      }

      logs.sort((a, b) => a.attempt - b.attempt);
    }

    // Read result.json if exists
    const resultPath = join(logsDir, 'result.json');
    let changedFiles: Array<{
      path: string;
      status: 'added' | 'modified' | 'deleted';
      additions: number;
      deletions: number;
    }> = [];

    if (existsSync(resultPath)) {
      try {
        const result = JSON.parse(readFileSync(resultPath, 'utf-8'));
        changedFiles = result.changedFiles || [];
      } catch {
        // Ignore parse errors
      }
    }

    return NextResponse.json({
      logs,
      changedFiles,
    });
  } catch (error) {
    console.error('Error fetching task details:', error);
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
  }
}
