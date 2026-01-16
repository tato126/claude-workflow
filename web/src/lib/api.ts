import type { Project, ProjectQueue, Task } from './types';

const API_BASE = '/api';

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function getProjectQueue(projectPath: string): Promise<ProjectQueue> {
  const res = await fetch(`${API_BASE}/tasks?project=${encodeURIComponent(projectPath)}`);
  if (!res.ok) throw new Error('Failed to fetch queue');
  return res.json();
}

export async function addTask(projectPath: string, task: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: projectPath, task }),
  });
  if (!res.ok) throw new Error('Failed to add task');
  return res.json();
}

export async function updateTask(
  projectPath: string,
  taskId: string,
  updates: Partial<Task>
): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: projectPath, updates }),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

export async function deleteTask(projectPath: string, taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}?project=${encodeURIComponent(projectPath)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete task');
}

export async function getDaemonStatus(): Promise<{ running: boolean; pid?: number }> {
  const res = await fetch(`${API_BASE}/daemon`);
  if (!res.ok) throw new Error('Failed to get daemon status');
  return res.json();
}

export async function startDaemon(): Promise<void> {
  const res = await fetch(`${API_BASE}/daemon`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start daemon');
}

export async function stopDaemon(): Promise<void> {
  const res = await fetch(`${API_BASE}/daemon`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to stop daemon');
}
