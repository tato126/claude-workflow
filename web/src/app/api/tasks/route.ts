import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

function getQueuePath(projectPath: string) {
  return join(projectPath, '.claude', 'tasks', 'queue.json');
}

function ensureQueue(projectPath: string) {
  const queuePath = getQueuePath(projectPath);
  const dir = join(projectPath, '.claude', 'tasks');

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(queuePath)) {
    writeFileSync(queuePath, JSON.stringify({ project: projectPath, tasks: [] }, null, 2));
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectPath = searchParams.get('project');

    if (!projectPath) {
      return NextResponse.json({ error: 'Project path required' }, { status: 400 });
    }

    ensureQueue(projectPath);
    const queue = JSON.parse(readFileSync(getQueuePath(projectPath), 'utf-8'));
    return NextResponse.json(queue);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read queue' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { project, task } = await request.json();

    if (!project) {
      return NextResponse.json({ error: 'Project path required' }, { status: 400 });
    }

    ensureQueue(project);
    const queuePath = getQueuePath(project);
    const queue = JSON.parse(readFileSync(queuePath, 'utf-8'));

    // task를 먼저 spread하고, 서버에서 관리할 필드는 마지막에 덮어씀
    const newTask = {
      ...task,  // 사용자/Claude가 보낸 값 먼저
      // 서버에서 강제로 설정하는 필드들 (덮어쓰기 방지)
      id: `task-${Date.now()}-${randomBytes(3).toString('hex')}`,
      title: task.title || task.prompt?.substring(0, 50) + (task.prompt?.length > 50 ? '...' : '') || 'Untitled',
      prompt: task.prompt || '',
      type: task.type || 'feature',
      status: 'todo',
      retry: { max: 3, current: 0 },
      createdAt: new Date().toISOString(),
    };

    queue.tasks.push(newTask);
    writeFileSync(queuePath, JSON.stringify(queue, null, 2));

    return NextResponse.json(newTask);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add task' }, { status: 500 });
  }
}
