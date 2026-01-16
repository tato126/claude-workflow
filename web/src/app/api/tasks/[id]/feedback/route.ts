import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

function getQueuePath(projectPath: string) {
  return join(projectPath, '.claude', 'tasks', 'queue.json');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project, feedback, images } = await request.json();

    if (!project) {
      return NextResponse.json({ error: 'Project path required' }, { status: 400 });
    }

    if (!feedback && (!images || images.length === 0)) {
      return NextResponse.json({ error: 'Feedback or images required' }, { status: 400 });
    }

    const queuePath = getQueuePath(project);
    const queue = JSON.parse(readFileSync(queuePath, 'utf-8'));

    const taskIndex = queue.tasks.findIndex((t: { id: string }) => t.id === id);
    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const originalTask = queue.tasks[taskIndex];

    // Create new task with feedback
    const newTask = {
      id: `${id}-feedback-${randomBytes(3).toString('hex')}`,
      title: `${originalTask.title} (피드백 반영)`,
      prompt: originalTask.prompt,
      type: originalTask.type,
      skill: originalTask.skill,
      validation: originalTask.validation,
      status: 'todo',
      retry: { max: 3, current: 0 },
      feedback: feedback ? [...(originalTask.feedback || []), feedback] : originalTask.feedback,
      feedbackImages: images || undefined,
      images: originalTask.images,  // 원본 태스크의 이미지 유지
      parentTask: id,
      feedbackRound: (originalTask.feedbackRound || 0) + 1,
      createdAt: new Date().toISOString(),
    };

    // Update original task to done
    queue.tasks[taskIndex] = {
      ...originalTask,
      status: 'done',
      completedAt: new Date().toISOString(),
    };

    // Add new task
    queue.tasks.push(newTask);

    writeFileSync(queuePath, JSON.stringify(queue, null, 2));

    return NextResponse.json(newTask);
  } catch (error) {
    console.error('Error processing feedback:', error);
    return NextResponse.json({ error: 'Failed to process feedback' }, { status: 500 });
  }
}
