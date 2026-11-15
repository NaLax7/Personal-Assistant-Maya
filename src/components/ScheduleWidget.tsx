import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Trash2,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Coffee,
} from 'lucide-react';
import { ScheduleEvent } from '../types/assistant';
import { audioManager } from '../utils/audioHardwareManager';

interface ScheduleWidgetProps {
  events: ScheduleEvent[];
  onAddEvent: (event: Omit<ScheduleEvent, 'id'>) => void;
  onToggleEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  isNightDim?: boolean;
}

export const ScheduleWidget: React.FC<ScheduleWidgetProps> = ({
  events,
  onAddEvent,
  onToggleEvent,
  onDeleteEvent,
  isNightDim = false,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('14:00');
  const [newDuration, setNewDuration] = useState('45m');
  const [newCategory, setNewCategory] = useState<'routine' | 'focus' | 'health' | 'break'>('focus');

  // Pomodoro Focus Countdown Timer (25 minutes = 1500 seconds)
  const POMODORO_DURATION = 25 * 60;
  const [pomodoroSeconds, setPomodoroSeconds] = useState<number>(POMODORO_DURATION);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState<boolean>(false);
  const [showBreakAlert, setShowBreakAlert] = useState<boolean>(false);
  const pomodoroIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isPomodoroRunning) {
      pomodoroIntervalRef.current = setInterval(() => {
        setPomodoroSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(pomodoroIntervalRef.current);
            setIsPomodoroRunning(false);
            setShowBreakAlert(true);
            audioManager.playAcousticChime('test');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current);
      }
    }

    return () => {
      if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
    };
  }, [isPomodoroRunning]);

  const togglePomodoro = () => {
    if (pomodoroSeconds === 0) {
      setPomodoroSeconds(POMODORO_DURATION);
      setShowBreakAlert(false);
    }
    setIsPomodoroRunning((prev) => !prev);
  };

  const resetPomodoro = () => {
    setIsPomodoroRunning(false);
    setPomodoroSeconds(POMODORO_DURATION);
    setShowBreakAlert(false);
  };

  const formatPomodoroTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine current active event based on current hour/minute
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const sortedEvents = [...events].sort((a, b) => parseMinutes(a.time) - parseMinutes(b.time));

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddEvent({
      title: newTitle.trim(),
      time: newTime,
      duration: newDuration,
      category: newCategory,
      completed: false,
    });
    setNewTitle('');
    setIsAdding(false);
  };

  return (
    <div
      className={`rounded-2xl transition-all duration-300 flex flex-col ${
        isNightDim
          ? 'bg-slate-900/50 border border-amber-950/40 text-amber-100/70'
          : 'bg-slate-900/80 border border-slate-800/80 text-slate-100 shadow-xl backdrop-blur-md'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Day Schedule
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">
            {events.length} Events
          </span>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700/60 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>New</span>
        </button>
      </div>

      {/* Pomodoro 25-Minute Focus Countdown Timer Strip */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg ${
              isPomodoroRunning
                ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-300">
                25m Pomodoro Focus
              </span>
              {isPomodoroRunning && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 tracking-wider">
              {formatPomodoroTime(pomodoroSeconds)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={togglePomodoro}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              isPomodoroRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
            title={isPomodoroRunning ? 'Pause Focus Timer' : 'Start 25m Focus Block'}
          >
            {isPomodoroRunning ? (
              <>
                <Pause className="w-3 h-3" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Start</span>
              </>
            )}
          </button>
          <button
            onClick={resetPomodoro}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Reset to 25:00"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Break Time Alert Notification Modal/Banner */}
      {showBreakAlert && (
        <div className="m-3 p-3 rounded-xl bg-gradient-to-r from-emerald-950 to-teal-950 border border-emerald-500/60 shadow-xl flex items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300">
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-200 block uppercase tracking-wider">
                ☕ Break Time!
              </span>
              <p className="text-[11px] text-emerald-300 font-medium">
                Great job! You finished 25 minutes of deep focus. Take a 5-minute stretch or coffee break.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowBreakAlert(false)}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add event inline form */}
      {isAdding && (
        <form
          onSubmit={handleAddSubmit}
          className="p-3 mx-3 mt-2 bg-slate-800/95 border border-slate-700/90 rounded-xl flex flex-col gap-2"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Event name (e.g. Daily Standup, Afternoon Walk)"
            className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs focus:outline-none"
              />
              <select
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-xs focus:outline-none"
              >
                <option value="15m">15m</option>
                <option value="30m">30m</option>
                <option value="45m">45m</option>
                <option value="1h">1h</option>
                <option value="1.5h">1.5h</option>
              </select>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-xs focus:outline-none"
              >
                <option value="focus">Focus</option>
                <option value="routine">Routine</option>
                <option value="health">Health</option>
                <option value="break">Break</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2 py-0.5 text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-0.5 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Timeline items list */}
      <div className="p-3 space-y-1.5 overflow-y-auto flex-1 min-h-0">
        {sortedEvents.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500">
            No schedule events. Tap New to plan your day.
          </div>
        ) : (
          sortedEvents.map((evt) => {
            const eventMinutes = parseMinutes(evt.time);
            const durationMinutes = evt.duration.includes('h')
              ? parseFloat(evt.duration) * 60
              : parseInt(evt.duration, 10) || 30;
            const isOngoing =
              currentMinutes >= eventMinutes && currentMinutes < eventMinutes + durationMinutes;

            return (
              <div
                key={evt.id}
                onClick={() => onToggleEvent(evt.id)}
                className={`group flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  isOngoing
                    ? 'bg-sky-950/40 border-sky-500/50 shadow-sm shadow-sky-950/30'
                    : evt.completed
                    ? 'bg-slate-950/30 border-slate-800/40 opacity-60'
                    : 'bg-slate-800/30 hover:bg-slate-800/60 border-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {/* Time badge */}
                  <div className="flex flex-col items-center justify-center w-12 py-0.5 bg-slate-900/80 border border-slate-800 rounded-lg flex-shrink-0">
                    <span className="text-[11px] font-mono font-semibold text-sky-400 tabular-nums">
                      {evt.time}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      {evt.duration}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-xs font-medium truncate ${
                          evt.completed ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      >
                        {evt.title}
                      </p>
                      {isOngoing && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-sky-300 bg-sky-500/20 px-1 py-0.2 rounded">
                          Now
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="capitalize">{evt.category}</span>
                      {evt.notes && (
                        <>
                          <span>·</span>
                          <span className="truncate">{evt.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEvent(evt.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 rounded transition-all cursor-pointer"
                    title="Delete event"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      evt.completed
                        ? 'bg-emerald-400'
                        : isOngoing
                        ? 'bg-sky-400 animate-pulse'
                        : 'bg-slate-600'
                    }`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
