'use client';

import { Task } from '@/lib/types';
import { Trash2, FileText, Play, RotateCcw } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Task['status']) => void;
  onViewLogs: (id: string) => void;
}

const typeIcons: Record<string, string> = {
  feature: '✨',
  bugfix: '🐛',
  refactor: '♻️',
  test: '🧪',
  docs: '📝',
  design: '🎨',
};

const statusColors: Record<string, string> = {
  todo: 'border-gray-600',
  progress: 'border-blue-500 bg-blue-500/10',
  review: 'border-yellow-500 bg-yellow-500/10',
  done: 'border-green-500 bg-green-500/10',
  failed: 'border-red-500 bg-red-500/10',
};

export default function TaskCard({ task, onDelete, onStatusChange, onViewLogs }: TaskCardProps) {
  return (
    <div
      className={`p-3 rounded-lg border ${statusColors[task.status]} bg-[#1a1a1a] cursor-grab active:cursor-grabbing`}
      draggable
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span>{typeIcons[task.type] || '📋'}</span>
            <span className="font-medium text-sm truncate">{task.title}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.prompt}</p>
        </div>
      </div>

      {task.lastError && task.lastError.trim() && (
        <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-400 line-clamp-2">
          {task.lastError}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>{task.type}</span>
          {task.skill && (
            <>
              <span>•</span>
              <span>{task.skill}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewLogs(task.id)}
            className="p-1 hover:bg-gray-700 rounded"
            title="로그 보기"
          >
            <FileText size={14} />
          </button>

          {task.status === 'failed' && (
            <button
              onClick={() => onStatusChange(task.id, 'todo')}
              className="p-1 hover:bg-gray-700 rounded text-yellow-500"
              title="재시도"
            >
              <RotateCcw size={14} />
            </button>
          )}

          {task.status === 'todo' && (
            <button
              onClick={() => onStatusChange(task.id, 'progress')}
              className="p-1 hover:bg-gray-700 rounded text-blue-500"
              title="수동 실행"
            >
              <Play size={14} />
            </button>
          )}

          <button
            onClick={() => onDelete(task.id)}
            className="p-1 hover:bg-gray-700 rounded text-red-500"
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {task.retry.current > 0 && (
        <div className="text-xs text-gray-500 mt-1">
          시도: {task.retry.current}/{task.retry.max}
        </div>
      )}
    </div>
  );
}
