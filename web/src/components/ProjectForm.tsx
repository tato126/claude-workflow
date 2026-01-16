'use client';

import { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';

interface ProjectFormProps {
  onSubmit: (project: { name: string; path: string }) => void;
  onClose: () => void;
}

export default function ProjectForm({ onSubmit, onClose }: ProjectFormProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && path.trim()) {
      onSubmit({ name: name.trim(), path: path.trim() });
    }
  };

  // 경로에서 프로젝트 이름 자동 추출
  const handlePathChange = (newPath: string) => {
    setPath(newPath);
    if (!name) {
      const parts = newPath.split('/').filter(Boolean);
      if (parts.length > 0) {
        setName(parts[parts.length - 1]);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] rounded-xl w-full max-w-md border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FolderPlus size={20} />
            <h2 className="font-semibold">프로젝트 추가</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">프로젝트 경로 *</label>
            <input
              type="text"
              value={path}
              onChange={(e) => handlePathChange(e.target.value)}
              placeholder="/path/to/your/project"
              className="w-full bg-[#111] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">절대 경로를 입력하세요</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">프로젝트 이름 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              className="w-full bg-[#111] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !path.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
