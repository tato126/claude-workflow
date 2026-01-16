'use client';

import { useState, useRef } from 'react';
import { X, Zap, Image as ImageIcon, Trash2 } from 'lucide-react';
import { TaskType, TaskImage } from '@/lib/types';

interface TaskFormProps {
  onSubmit: (task: {
    prompt: string;
    type: TaskType;
    skill?: string;
    images?: TaskImage[];
  }) => void;
  onClose: () => void;
}

export default function TaskForm({ onSubmit, onClose }: TaskFormProps) {
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<TaskType>('feature');
  const [skill, setSkill] = useState('');
  const [images, setImages] = useState<TaskImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const newImage: TaskImage = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data: base64,
            name: file.name || `image-${images.length + 1}.png`,
            type: file.type,
          };
          setImages(prev => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    onSubmit({
      prompt: prompt.trim(),
      type,
      skill: skill.trim() || undefined,
      images: images.length > 0 ? images : undefined,
    });

    setPrompt('');
    setType('feature');
    setSkill('');
    setImages([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-lg p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">새 태스크 추가</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              프롬프트
              <span className="text-xs text-gray-500 ml-2">(이미지 붙여넣기 가능)</span>
            </label>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={handlePaste}
              className="w-full bg-[#111] border border-gray-700 rounded-lg p-3 text-sm resize-none h-32 focus:outline-none focus:border-blue-500"
              placeholder="구현할 내용을 자세히 설명해주세요... (Ctrl+V로 이미지 붙여넣기)"
              autoFocus
            />
            {/* 이미지 미리보기 */}
            {images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.data}
                      alt={img.name}
                      className="h-20 w-20 object-cover rounded border border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <ImageIcon size={12} />
                {images.length}개 이미지 첨부됨
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">타입</label>
            <div className="flex flex-wrap gap-2">
              {(['feature', 'bugfix', 'refactor', 'test', 'docs', 'design', 'api'] as TaskType[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded text-sm ${
                      type === t
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {t}
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">스킬 (선택)</label>
            <input
              type="text"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className="w-full bg-[#111] border border-gray-700 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="사용할 스킬 이름 (docs/skills/ 참조)"
            />
          </div>

          {/* 자동 검증 안내 */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-1">
              <Zap size={16} />
              자동 검증
            </div>
            <p className="text-xs text-gray-400">
              프로젝트 타입에 따라 자동으로 검증됩니다:
              Codex 리뷰 → 빌드 체크 → 테스트 실행
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
