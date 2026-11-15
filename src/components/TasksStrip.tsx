import React, { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { Task } from '../types/assistant';

interface TasksStripProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onAddTask: (task: Omit<Task, 'id'>) => void;
  onDeleteTask: (id: string) => void;
  isNightDim?: boolean;
}

export const TasksStrip: React.FC<TasksStripProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  isNightDim = false,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask({
      title: newTitle.trim(),
      category: 'Focus',
      priority: 'medium',
      completed: false,
    });
    setNewTitle('');
    setIsAdding(false);
  };

  return (
    <div
      className={`rounded-2xl transition-all duration-300 flex flex-col h-full ${
        isNightDim
          ? 'bg-slate-900/50 border border-amber-950/40 text-amber-100/80'
          : 'bg-slate-900/65 border border-slate-800/70 text-slate-100 backdrop-blur-md'
      }`}
    >
      {/* Clean Header bar */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-800/60">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-sm font-semibold text-slate-100 font-display">
            Tasks
          </h2>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {completedCount}/{tasks.length} done
          </span>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700/70 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      {/* Progress line */}
      <div className="w-full bg-slate-800/60 h-1">
        <div
          className="bg-sky-400 h-1 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Clean Add Task Input */}
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="p-3 mx-4 mt-3 bg-slate-800/90 border border-slate-700/80 rounded-xl flex items-center gap-2"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs bg-sky-500 hover:bg-sky-400 text-white rounded-lg font-medium"
          >
            Save
          </button>
        </form>
      )}

      {/* Simplified, Clean Tasks List */}
      <div className="p-3.5 space-y-2 overflow-y-auto flex-1 min-h-0">
        {tasks.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No tasks right now. Tap Add Task to add one.
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onToggleTask(task.id)}
              className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                task.completed
                  ? 'bg-slate-950/30 border-slate-800/40 text-slate-500'
                  : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-800/70 text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                {/* Touch Checkbox */}
                <button
                  type="button"
                  aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                  className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                    task.completed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'border border-slate-600 hover:border-sky-400 text-transparent'
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${task.completed ? 'opacity-100' : 'opacity-0'}`} />
                </button>

                {/* Clean Task Title & Time */}
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      task.completed ? 'line-through text-slate-500' : 'text-slate-100'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.time && (
                    <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                      {task.time}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTask(task.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/60 transition-all flex-shrink-0"
                title="Delete task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
