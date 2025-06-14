import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from './ui';
import { Card } from './ui/Card';
import { Id } from '../../convex/_generated/dataModel';
import {
  FolderIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArchiveIcon,
  ChevronRightIcon,
} from 'lucide-react';

interface Project {
  _id: Id<"projects">;
  _creationTime: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  threadCount: number;
  lastActivityAt: number;
}

export function ProjectList() {
  const projects = useQuery(api.projects.list) || [];
  const createProject = useMutation(api.projects.create);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[var(--c3-text-primary)]">Projects</h2>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyProjectState onCreateClick={() => setShowCreateModal(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project._id} project={project} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (data) => {
            await createProject(data);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const [showMenu, setShowMenu] = useState(false);
  const updateProject = useMutation(api.projects.update);
  const deleteProject = useMutation(api.projects.remove);

  const projectColor = project.color || '#6366f1';
  const Icon = getIconComponent(project.icon || 'folder');

  return (
    <Card className="relative group hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${projectColor}20` }}
          >
            <Icon className="w-6 h-6" style={{ color: projectColor }} />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-[var(--c3-surface-secondary)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showMenu && (
              <ProjectMenu
                project={project}
                onClose={() => setShowMenu(false)}
                onUpdate={updateProject}
                onDelete={deleteProject}
              />
            )}
          </div>
        </div>

        <h3 className="font-semibold text-lg mb-2 text-[var(--c3-text-primary)]">
          {project.name}
        </h3>
        {project.description && (
          <p className="text-sm text-[var(--c3-text-secondary)] mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="flex items-center justify-between text-sm text-[var(--c3-text-tertiary)]">
          <span>{project.threadCount} threads</span>
          <span>{formatRelativeTime(project.lastActivityAt)}</span>
        </div>
      </div>
    </Card>
  );
}

function EmptyProjectState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--c3-surface-secondary)] flex items-center justify-center">
        <FolderIcon className="w-8 h-8 text-[var(--c3-text-tertiary)]" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-[var(--c3-text-primary)]">
        No projects yet
      </h3>
      <p className="text-[var(--c3-text-secondary)] mb-6">
        Create your first project to organize your conversations
      </p>
      <Button onClick={onCreateClick} className="mx-auto">
        <PlusIcon className="w-4 h-4 mr-2" />
        Create Project
      </Button>
    </div>
  );
}

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => Promise<void>;
}

function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('folder');
  const [isCreating, setIsCreating] = useState(false);

  const colors = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#ef4444', // red
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#06b6d4', // cyan
  ];

  const icons = [
    'folder',
    'briefcase',
    'book',
    'code',
    'rocket',
    'star',
    'heart',
    'zap',
  ];

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[var(--c3-surface-primary)] rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-xl font-semibold mb-4 text-[var(--c3-text-primary)]">
            Create New Project
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
                className="w-full px-3 py-2 rounded-lg bg-[var(--c3-surface-secondary)] border border-[var(--c3-border-subtle)] focus:border-[var(--c3-border-strong)] focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this project about?"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[var(--c3-surface-secondary)] border border-[var(--c3-border-subtle)] focus:border-[var(--c3-border-strong)] focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg border-2 ${
                      color === c ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Icon</label>
              <div className="flex gap-2 flex-wrap">
                {icons.map((i) => {
                  const IconComponent = getIconComponent(i);
                  return (
                    <button
                      key={i}
                      onClick={() => setIcon(i)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 ${
                        icon === i
                          ? 'border-[var(--c3-border-strong)] bg-[var(--c3-surface-secondary)]'
                          : 'border-[var(--c3-border-subtle)] hover:bg-[var(--c3-surface-secondary)]'
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={onClose}
              variant="secondary"
              className="flex-1"
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1"
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProjectMenuProps {
  project: Project;
  onClose: () => void;
  onUpdate: (args: any) => Promise<void>;
  onDelete: (args: any) => Promise<void>;
}

function ProjectMenu({ project, onClose, onUpdate, onDelete }: ProjectMenuProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-10"
        onClick={onClose}
      />
      <div className="absolute right-0 top-10 z-20 w-48 bg-[var(--c3-surface-primary)] rounded-lg shadow-lg border border-[var(--c3-border-subtle)] py-2">
        <button
          onClick={() => {
            // TODO: Implement edit modal
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--c3-surface-secondary)] flex items-center gap-2"
        >
          <PencilIcon className="w-4 h-4" />
          Edit Project
        </button>
        <button
          onClick={() => {
            // TODO: Implement archive
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--c3-surface-secondary)] flex items-center gap-2"
        >
          <ArchiveIcon className="w-4 h-4" />
          Archive Project
        </button>
        <hr className="my-2 border-[var(--c3-border-subtle)]" />
        <button
          onClick={async () => {
            if (confirm('Are you sure you want to delete this project? All threads will be archived.')) {
              await onDelete({ projectId: project._id });
              onClose();
            }
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--c3-surface-secondary)] flex items-center gap-2 text-red-500"
        >
          <TrashIcon className="w-4 h-4" />
          Delete Project
        </button>
      </div>
    </>
  );
}

// Helper functions
function getIconComponent(iconName: string) {
  const icons: Record<string, any> = {
    folder: FolderIcon,
    briefcase: require('lucide-react').BriefcaseIcon,
    book: require('lucide-react').BookIcon,
    code: require('lucide-react').CodeIcon,
    rocket: require('lucide-react').RocketIcon,
    star: require('lucide-react').StarIcon,
    heart: require('lucide-react').HeartIcon,
    zap: require('lucide-react').ZapIcon,
  };
  return icons[iconName] || FolderIcon;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
