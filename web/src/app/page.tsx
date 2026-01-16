'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Power, RefreshCw, FolderPlus } from 'lucide-react';
import KanbanBoard from '@/components/KanbanBoard';
import TaskForm from '@/components/TaskForm';
import TaskDetailModal from '@/components/TaskDetailModal';
import ProjectForm from '@/components/ProjectForm';
import { Project, Task, TaskStatus, ProjectQueue, TaskImage } from '@/lib/types';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [queue, setQueue] = useState<ProjectQueue | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [daemonRunning, setDaemonRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !selectedProject) {
        // 저장된 프로젝트 경로 확인
        const savedPath = localStorage.getItem('selectedProjectPath');
        const savedProject = savedPath ? data.find((p: Project) => p.path === savedPath) : null;
        setSelectedProject(savedProject || data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }, [selectedProject]);

  // Fetch queue for selected project
  const fetchQueue = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/tasks?project=${encodeURIComponent(selectedProject.path)}`);
      const data = await res.json();
      setQueue(data);
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    }
  }, [selectedProject]);

  // Fetch daemon status
  const fetchDaemonStatus = async () => {
    try {
      const res = await fetch('/api/daemon');
      const data = await res.json();
      setDaemonRunning(data.running);
    } catch (error) {
      console.error('Failed to fetch daemon status:', error);
    }
  };

  // Toggle daemon
  const toggleDaemon = async () => {
    try {
      if (daemonRunning) {
        await fetch('/api/daemon', { method: 'DELETE' });
      } else {
        await fetch('/api/daemon', { method: 'POST' });
      }
      await fetchDaemonStatus();
    } catch (error) {
      console.error('Failed to toggle daemon:', error);
    }
  };

  // Add task
  const handleAddTask = async (task: Partial<Task>) => {
    if (!selectedProject) return;
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.path, task }),
      });
      await fetchQueue();
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  // Add project
  const handleAddProject = async (project: { name: string; path: string }) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (res.ok) {
        await fetchProjects();
        setShowProjectForm(false);
      }
    } catch (error) {
      console.error('Failed to add project:', error);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!selectedProject) return;
    try {
      await fetch(`/api/tasks/${taskId}?project=${encodeURIComponent(selectedProject.path)}`, {
        method: 'DELETE',
      });
      await fetchQueue();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  // Update task status
  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    if (!selectedProject) return;
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.path, updates: { status } }),
      });
      await fetchQueue();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  // View task details
  const handleViewTask = (taskId: string) => {
    if (!queue) return;
    const task = queue.tasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTask(task);
    }
  };

  // Handle feedback
  const handleFeedback = async (feedback: string, images?: TaskImage[]) => {
    if (!selectedProject || !selectedTask) return;
    try {
      await fetch(`/api/tasks/${selectedTask.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.path, feedback, images }),
      });
      setSelectedTask(null);
      await fetchQueue();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      await fetchProjects();
      await fetchDaemonStatus();
      setLoading(false);
    };
    init();
  }, [fetchProjects]);

  // Fetch queue when project changes
  useEffect(() => {
    if (selectedProject) {
      fetchQueue();
    }
  }, [selectedProject, fetchQueue]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueue();
      fetchDaemonStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">⚡ Workflow</h1>

            {/* Project selector */}
            <select
              value={selectedProject?.path || ''}
              onChange={(e) => {
                const project = projects.find((p) => p.path === e.target.value);
                setSelectedProject(project || null);
                if (project) {
                  localStorage.setItem('selectedProjectPath', project.path);
                }
              }}
              className="bg-[#111] border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            >
              {projects.map((project) => (
                <option key={project.path} value={project.path}>
                  {project.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowProjectForm(true)}
              className="p-2 hover:bg-gray-800 rounded-lg"
              title="프로젝트 추가"
            >
              <FolderPlus size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Daemon status */}
            <button
              onClick={toggleDaemon}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                daemonRunning
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              <Power size={16} />
              {daemonRunning ? 'Daemon ON' : 'Daemon OFF'}
            </button>

            {/* Refresh */}
            <button
              onClick={fetchQueue}
              className="p-2 hover:bg-gray-800 rounded-lg"
              title="새로고침"
            >
              <RefreshCw size={18} />
            </button>

            {/* Add task */}
            <button
              onClick={() => setShowTaskForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
            >
              <Plus size={18} />
              태스크 추가
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-hidden">
        {selectedProject && queue ? (
          <KanbanBoard
            tasks={queue.tasks}
            onDeleteTask={handleDeleteTask}
            onStatusChange={handleStatusChange}
            onViewLogs={handleViewTask}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="mb-2">프로젝트가 없습니다</p>
              <p className="text-sm">CLI로 프로젝트를 추가하세요:</p>
              <code className="block mt-2 bg-gray-800 px-3 py-2 rounded text-sm">
                workflow project add /path/to/project
              </code>
            </div>
          </div>
        )}
      </main>

      {/* Task form modal */}
      {showTaskForm && (
        <TaskForm
          onSubmit={handleAddTask}
          onClose={() => setShowTaskForm(false)}
        />
      )}

      {/* Project form modal */}
      {showProjectForm && (
        <ProjectForm
          onSubmit={handleAddProject}
          onClose={() => setShowProjectForm(false)}
        />
      )}

      {/* Task detail modal */}
      {selectedTask && selectedProject && (
        <TaskDetailModal
          task={selectedTask}
          projectPath={selectedProject.path}
          onClose={() => setSelectedTask(null)}
          onStatusChange={(status) => {
            handleStatusChange(selectedTask.id, status);
            setSelectedTask(null);
          }}
          onFeedback={handleFeedback}
        />
      )}
    </div>
  );
}
