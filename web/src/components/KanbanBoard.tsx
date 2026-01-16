'use client';

import { Task, TaskStatus } from '@/lib/types';
import TaskCard from './TaskCard';

interface KanbanBoardProps {
  tasks: Task[];
  onDeleteTask: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onViewLogs: (id: string) => void;
}

const columns: { status: TaskStatus; title: string; icon: string }[] = [
  { status: 'todo', title: 'TODO', icon: '📋' },
  { status: 'progress', title: 'PROGRESS', icon: '⚡' },
  { status: 'review', title: 'REVIEW', icon: '🔍' },
  { status: 'done', title: 'DONE', icon: '✅' },
  { status: 'failed', title: 'FAILED', icon: '❌' },
];

export default function KanbanBoard({
  tasks,
  onDeleteTask,
  onStatusChange,
  onViewLogs,
}: KanbanBoardProps) {
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onStatusChange(taskId, status);
    }
  };

  return (
    <div className="grid grid-cols-5 gap-4 h-full">
      {columns.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.status);
        return (
          <div
            key={column.status}
            className="flex flex-col bg-[#111] rounded-lg p-3"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span>{column.icon}</span>
                <span className="font-semibold text-sm">{column.title}</span>
              </div>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {columnTasks.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                >
                  <TaskCard
                    task={task}
                    onDelete={onDeleteTask}
                    onStatusChange={onStatusChange}
                    onViewLogs={onViewLogs}
                  />
                </div>
              ))}

              {columnTasks.length === 0 && (
                <div className="text-center text-gray-600 text-sm py-8">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
