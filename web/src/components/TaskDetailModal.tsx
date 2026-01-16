'use client';

import { useState, useEffect, useRef } from 'react';
import { X, RotateCcw, Check, MessageSquare, FileText, Clock, AlertCircle, Radio, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Task, TaskStatus, TaskImage } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TaskDetailModalProps {
  task: Task;
  projectPath: string;
  onClose: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onFeedback: (feedback: string, images?: TaskImage[]) => void;
}

interface TaskLog {
  attempt: number;
  content: string;
}

interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
}

const statusConfig: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: 'TODO', color: 'text-gray-400', bg: 'bg-gray-500/20' },
  progress: { label: 'PROGRESS', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  review: { label: 'REVIEW', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  done: { label: 'DONE', color: 'text-green-400', bg: 'bg-green-500/20' },
  failed: { label: 'FAILED', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const typeIcons: Record<string, string> = {
  feature: '✨',
  bugfix: '🐛',
  refactor: '♻️',
  test: '🧪',
  docs: '📝',
  design: '🎨',
};

export default function TaskDetailModal({
  task,
  projectPath,
  onClose,
  onStatusChange,
  onFeedback,
}: TaskDetailModalProps) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([]);
  const [feedback, setFeedback] = useState('');
  const [feedbackImages, setFeedbackImages] = useState<TaskImage[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'logs' | 'live' | 'files'>(
    task.status === 'progress' ? 'live' : 'info'
  );
  const [loading, setLoading] = useState(true);
  const [liveLog, setLiveLog] = useState('');
  const liveLogRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(
          `/api/tasks/${task.id}/details?project=${encodeURIComponent(projectPath)}`
        );
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
          setChangedFiles(data.changedFiles || []);
        }
      } catch (error) {
        console.error('Failed to fetch task details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [task.id, projectPath]);

  // Live log polling for progress tasks
  useEffect(() => {
    if (task.status !== 'progress') return;

    const fetchLiveLog = async () => {
      try {
        const res = await fetch(
          `/api/tasks/logs?project=${encodeURIComponent(projectPath)}&taskId=${task.id}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.exists && data.fullContent) {
            setLiveLog(data.fullContent);
            // Auto-scroll to bottom
            if (liveLogRef.current) {
              liveLogRef.current.scrollTop = liveLogRef.current.scrollHeight;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch live log:', error);
      }
    };

    // Initial fetch
    fetchLiveLog();

    // Poll every 2 seconds
    const interval = setInterval(fetchLiveLog, 2000);

    return () => clearInterval(interval);
  }, [task.id, task.status, projectPath]);

  const handleFeedbackSubmit = () => {
    if (feedback.trim() || feedbackImages.length > 0) {
      onFeedback(feedback.trim(), feedbackImages.length > 0 ? feedbackImages : undefined);
      setFeedback('');
      setFeedbackImages([]);
    }
  };

  const handleFeedbackPaste = async (e: React.ClipboardEvent) => {
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
            name: file.name || `feedback-image-${feedbackImages.length + 1}.png`,
            type: file.type,
          };
          setFeedbackImages(prev => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeFeedbackImage = (id: string) => {
    setFeedbackImages(prev => prev.filter(img => img.id !== id));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ko });
  };

  const status = statusConfig[task.status];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{typeIcons[task.type] || '📋'}</span>
            <div>
              <h2 className="font-semibold text-lg">{task.title}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{task.id}</span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {[
            { id: 'info', label: '정보', icon: FileText },
            { id: 'live', label: '실시간', icon: Radio, showWhen: task.status === 'progress' },
            { id: 'logs', label: '로그', icon: Clock },
            { id: 'files', label: '변경 파일', icon: FileText },
          ].filter(tab => !tab.showWhen || tab.showWhen === true || task.status === 'progress').map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm ${
                activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              } ${tab.id === 'live' ? 'animate-pulse' : ''}`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.id === 'live' && <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* 프롬프트 */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">📝 프롬프트</h3>
                <div className="bg-[#111] rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {task.prompt}
                </div>
              </div>

              {/* 첨부 이미지 */}
              {task.images && task.images.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <ImageIcon size={16} />
                    첨부 이미지 ({task.images.length}개)
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {task.images.map((img) => (
                      <div key={img.id} className="relative">
                        <img
                          src={img.data}
                          alt={img.name}
                          className="max-h-48 rounded-lg border border-gray-700 cursor-pointer hover:border-blue-500 transition-colors"
                          onClick={() => window.open(img.data, '_blank')}
                          title="클릭하여 원본 보기"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/70 text-xs text-gray-300 px-2 py-0.5 rounded">
                          {img.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 피드백 이미지 */}
              {task.feedbackImages && task.feedbackImages.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                    <ImageIcon size={16} />
                    피드백 이미지 ({task.feedbackImages.length}개)
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {task.feedbackImages.map((img) => (
                      <div key={img.id} className="relative">
                        <img
                          src={img.data}
                          alt={img.name}
                          className="max-h-48 rounded-lg border border-yellow-700/50 cursor-pointer hover:border-yellow-500 transition-colors"
                          onClick={() => window.open(img.data, '_blank')}
                          title="클릭하여 원본 보기"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/70 text-xs text-gray-300 px-2 py-0.5 rounded">
                          {img.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 메타 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">🏷️ 타입</h3>
                  <p className="text-sm">{task.type}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">🔧 스킬</h3>
                  <p className="text-sm">{task.skill || '-'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">📅 생성</h3>
                  <p className="text-sm">{formatDate(task.createdAt)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">▶️ 시작</h3>
                  <p className="text-sm">{formatDate(task.startedAt)}</p>
                </div>
              </div>

              {/* 실행 정보 */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">⚡ 실행 정보</h3>
                <div className="bg-[#111] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">시도</span>
                    <span>{task.retry.current} / {task.retry.max}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">검증</span>
                    <span>{task.validation?.length ? task.validation.join(', ') : '자동 감지'}</span>
                  </div>
                </div>
              </div>

              {/* 에러 */}
              {task.lastError && task.lastError.trim() && (
                <div>
                  <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                    <AlertCircle size={16} />
                    에러
                  </h3>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-300 whitespace-pre-wrap">
                    {task.lastError}
                  </div>
                </div>
              )}

              {/* 피드백 히스토리 */}
              {task.feedback && task.feedback.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">💬 피드백 히스토리</h3>
                  <div className="space-y-2">
                    {task.feedback.map((fb, i) => (
                      <div key={i} className="bg-[#111] rounded-lg p-3 text-sm">
                        {fb}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                실시간 로그 (2초마다 갱신)
              </div>
              {liveLog ? (
                <pre
                  ref={liveLogRef}
                  className="bg-[#111] rounded-lg p-4 text-xs overflow-auto whitespace-pre-wrap max-h-[50vh] font-mono"
                >
                  {liveLog}
                </pre>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  로그 대기 중...
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-gray-500 py-8">로딩 중...</div>
              ) : logs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">로그가 없습니다</div>
              ) : (
                logs.map((log) => (
                  <div key={log.attempt}>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">
                      시도 #{log.attempt}
                    </h3>
                    <pre className="bg-[#111] rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">
                      {log.content}
                    </pre>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-gray-500 py-8">로딩 중...</div>
              ) : changedFiles.length === 0 ? (
                <div className="text-center text-gray-500 py-8">변경된 파일이 없습니다</div>
              ) : (
                <>
                  <div className="space-y-2">
                    {changedFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-[#111] rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              file.status === 'added'
                                ? 'bg-green-500/20 text-green-400'
                                : file.status === 'deleted'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            {file.status === 'added' ? '추가' : file.status === 'deleted' ? '삭제' : '수정'}
                          </span>
                          <span className="text-sm font-mono">{file.path}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-green-400">+{file.additions}</span>
                          <span className="text-gray-500 mx-1">/</span>
                          <span className="text-red-400">-{file.deletions}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500 text-right">
                    총계: +{changedFiles.reduce((s, f) => s + f.additions, 0)} / -
                    {changedFiles.reduce((s, f) => s + f.deletions, 0)} lines
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer - Actions */}
        <div className="border-t border-gray-800 p-4">
          {task.status === 'review' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  피드백 (선택)
                  <span className="text-xs text-gray-500 ml-2">(이미지 붙여넣기 가능)</span>
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onPaste={handleFeedbackPaste}
                  className="w-full bg-[#111] border border-gray-700 rounded-lg p-3 text-sm resize-none h-20 focus:outline-none focus:border-blue-500"
                  placeholder="수정이 필요한 내용을 입력하세요... (Ctrl+V로 이미지 붙여넣기)"
                />
                {/* 피드백 이미지 미리보기 */}
                {feedbackImages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {feedbackImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.data}
                          alt={img.name}
                          className="h-16 w-16 object-cover rounded border border-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => removeFeedbackImage(img.id)}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {feedbackImages.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <ImageIcon size={12} />
                    {feedbackImages.length}개 이미지 첨부됨
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => onStatusChange('done')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                >
                  <Check size={16} />
                  승인
                </button>
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={!feedback.trim() && feedbackImages.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-lg text-sm hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare size={16} />
                  피드백 반영
                </button>
              </div>
            </div>
          )}

          {task.status === 'failed' && (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => onStatusChange('todo')}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-lg text-sm hover:bg-yellow-400"
              >
                <RotateCcw size={16} />
                재시도
              </button>
            </div>
          )}

          {(task.status === 'todo' || task.status === 'progress') && (
            <div className="text-center text-gray-500 text-sm">
              {task.status === 'todo' ? 'Daemon이 실행되면 자동으로 시작됩니다' : '실행 중...'}
            </div>
          )}

          {task.status === 'done' && (
            <div className="text-center text-green-400 text-sm flex items-center justify-center gap-2">
              <Check size={16} />
              완료됨
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
