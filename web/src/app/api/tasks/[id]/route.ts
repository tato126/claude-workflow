import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function getQueuePath(projectPath: string) {
  return join(projectPath, '.claude', 'tasks', 'queue.json');
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project, updates } = await request.json();

    if (!project) {
      return NextResponse.json({ error: 'Project path required' }, { status: 400 });
    }

    const queuePath = getQueuePath(project);
    const queue = JSON.parse(readFileSync(queuePath, 'utf-8'));

    const taskIndex = queue.tasks.findIndex((t: { id: string }) => t.id === id);
    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    queue.tasks[taskIndex] = { ...queue.tasks[taskIndex], ...updates };
    writeFileSync(queuePath, JSON.stringify(queue, null, 2));

    return NextResponse.json(queue.tasks[taskIndex]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project');

    if (!project) {
      return NextResponse.json({ error: 'Project path required' }, { status: 400 });
    }

    const queuePath = getQueuePath(project);
    const queue = JSON.parse(readFileSync(queuePath, 'utf-8'));

    queue.tasks = queue.tasks.filter((t: { id: string }) => t.id !== id);
    writeFileSync(queuePath, JSON.stringify(queue, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
