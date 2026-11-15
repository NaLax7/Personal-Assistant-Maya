/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task, ScheduleEvent, WeatherData } from './types/assistant';
import { WatchWidget } from './components/WatchWidget';
import { TasksStrip } from './components/TasksStrip';
import { ScheduleWidget } from './components/ScheduleWidget';
import { WishesWidget } from './components/WishesWidget';
import { RealisticMayaCard } from './components/RealisticMayaCard';
import { PWAInstallButton } from './components/PWAInstallButton';
import { UserProfileSensorsModal } from './components/UserProfileSensorsModal';
import { AcousticSleepOverlay } from './components/AcousticSleepOverlay';
import { detectTabletLocation, fetchLiveWeather, TabletLocation } from './utils/locationWeather';
import { tabletVoiceSensor, UserProfile } from './utils/voiceSensor';
import { acousticWakeEngine } from './utils/acousticWakeEngine';
import { audioManager } from './utils/audioHardwareManager';
import { ConversationLogsModal } from './components/ConversationLogsModal';
import { Moon, Sun, Settings, MessageSquare, Clock, LayoutGrid, Mic, WifiOff } from 'lucide-react';

export default function App() {
  // User Profile with Voice Sensor integration
  const [userProfile, setUserProfile] = useState<UserProfile>(() => tabletVoiceSensor.getStoredProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);

  // View Mode: 'planner' (Full Tasks & Schedule + Clock + Maya) or 'clock' (Only Hour, Time, Date + Maya)
  const [viewMode, setViewMode] = useState<'planner' | 'clock'>(() => {
    const saved = localStorage.getItem('maya_view_mode');
    return saved === 'clock' ? 'clock' : 'planner';
  });

  const handleSetViewMode = (mode: 'planner' | 'clock') => {
    setViewMode(mode);
    localStorage.setItem('maya_view_mode', mode);
  };

  // Tablet Location & Weather
  const [location, setLocation] = useState<TabletLocation>({
    latitude: 51.5074,
    longitude: -0.1278,
    city: 'Detecting Location...',
    source: 'cached',
  });

  const [weather, setWeather] = useState<WeatherData>({
    temp: 21,
    condition: 'Partly Sunny',
    high: 24,
    low: 15,
    humidity: 52,
    windSpeed: 10,
    city: 'Locating...',
    feelsLike: 21,
  });

  // Acoustic Voice Wake-Up & Auto-Sleep State
  const [acousticSleepMode, setAcousticSleepMode] = useState<'off' | '1m' | '2m'>(() => {
    return (localStorage.getItem('aura_acoustic_mode') as 'off' | '1m' | '2m') || '2m';
  });
  const [isSleeping, setIsSleeping] = useState(false);
  const [secondsUntilSleep, setSecondsUntilSleep] = useState(120);
  const [liveDb, setLiveDb] = useState(35);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const voicePulseTimeoutRef = useRef<any>(null);

  const getTimeoutSeconds = useCallback((mode: 'off' | '1m' | '2m') => {
    if (mode === '1m') return 60;
    if (mode === '2m') return 120;
    return 999999;
  }, []);

  const resetInactivityTimer = useCallback(() => {
    setSecondsUntilSleep(getTimeoutSeconds(acousticSleepMode));
    if (isSleeping) {
      setIsSleeping(false);
    }
  }, [acousticSleepMode, isSleeping, getTimeoutSeconds]);

  const handleVoiceDetected = useCallback(() => {
    setIsVoiceActive(true);
    if (voicePulseTimeoutRef.current) clearTimeout(voicePulseTimeoutRef.current);
    voicePulseTimeoutRef.current = setTimeout(() => setIsVoiceActive(false), 1200);

    setSecondsUntilSleep(getTimeoutSeconds(acousticSleepMode));
    if (isSleeping) {
      setIsSleeping(false);
    }
  }, [acousticSleepMode, isSleeping, getTimeoutSeconds]);

  useEffect(() => {
    localStorage.setItem('aura_acoustic_mode', acousticSleepMode);
    setSecondsUntilSleep(getTimeoutSeconds(acousticSleepMode));

    if (acousticSleepMode === 'off') {
      acousticWakeEngine.stop();
      setIsSleeping(false);
      return;
    }

    acousticWakeEngine.start(handleVoiceDetected, (db, isVoice) => {
      setLiveDb(db);
      if (isVoice) {
        setIsVoiceActive(true);
        if (voicePulseTimeoutRef.current) clearTimeout(voicePulseTimeoutRef.current);
        voicePulseTimeoutRef.current = setTimeout(() => setIsVoiceActive(false), 1200);
      }
    });

    return () => {
      acousticWakeEngine.stop();
    };
  }, [acousticSleepMode, handleVoiceDetected, getTimeoutSeconds]);

  useEffect(() => {
    if (acousticSleepMode === 'off') return;

    const timer = setInterval(() => {
      setSecondsUntilSleep((prev) => {
        if (prev <= 1) {
          setIsSleeping(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [acousticSleepMode]);

  useEffect(() => {
    const handleActivity = () => {
      resetInactivityTimer();
    };

    window.addEventListener('pointerdown', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [resetInactivityTimer]);

  // Automatically detect tablet GPS location and live weather on mount
  useEffect(() => {
    let isMounted = true;

    async function initTabletSensors() {
      try {
        const detectedLoc = await detectTabletLocation();
        if (!isMounted) return;
        setLocation(detectedLoc);

        const liveWeatherData = await fetchLiveWeather(detectedLoc);
        if (!isMounted) return;
        setWeather(liveWeatherData);
      } catch {
        // Quiet fallback to default location and weather
      }
    }

    initTabletSensors();

    return () => {
      isMounted = false;
    };
  }, []);

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Morning hydration & 5m breathwork', completed: true, category: 'Wellness', priority: 'medium', time: '08:00' },
    { id: '2', title: `Review day's goals with Maya`, completed: true, category: 'Focus', priority: 'high', time: '09:30' },
    { id: '3', title: 'Stretch & brisk outdoor walk', completed: false, category: 'Wellness', priority: 'medium', time: '13:00' },
    { id: '4', title: 'Deep focus: Architecture & planning', completed: false, category: 'Focus', priority: 'high', time: '14:30' },
    { id: '5', title: 'Water indoor plants & tidy desk', completed: false, category: 'Home', priority: 'low', time: '17:30' },
    { id: '6', title: 'Evening book reading without screens', completed: false, category: 'Routine', priority: 'medium', time: '21:30' },
  ]);

  // Schedule timeline events
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([
    { id: 'e1', title: 'Gentle Wake-up & Morning Coffee', time: '07:30', duration: '30m', category: 'routine', completed: true },
    { id: 'e2', title: 'Day Alignment with Maya', time: '09:00', duration: '30m', category: 'focus', completed: true },
    { id: 'e3', title: 'Deep Work Block 1', time: '10:00', duration: '1.5h', category: 'focus', completed: false },
    { id: 'e4', title: 'Lunch & Fresh Air Break', time: '12:30', duration: '45m', category: 'break', completed: false },
    { id: 'e5', title: 'Project Deep Dive', time: '14:00', duration: '1h', category: 'focus', completed: false },
    { id: 'e6', title: 'Afternoon Tea & Reset', time: '16:00', duration: '20m', category: 'health', completed: false },
    { id: 'e7', title: 'Dinner & Relaxation', time: '19:00', duration: '1h', category: 'routine', completed: false },
  ]);

  // Tablet 24/7 Night Dim state
  const [isNightDim, setIsNightDim] = useState(false);

  // Task actions
  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleAddTask = (taskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Schedule actions
  const handleAddEvent = (eventData: Omit<ScheduleEvent, 'id'>) => {
    const newEvent: ScheduleEvent = {
      ...eventData,
      id: Date.now().toString(),
    };
    setSchedule((prev) => [...prev, newEvent]);
  };

  const handleToggleEvent = (id: string) => {
    setSchedule((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  };

  const handleDeleteEvent = (id: string) => {
    setSchedule((prev) => prev.filter((e) => e.id !== id));
  };

  const handleLocationUpdate = (newLoc: TabletLocation, newWeather: WeatherData) => {
    setLocation(newLoc);
    setWeather(newWeather);
  };

  const [micStatus, setMicStatus] = useState<string>('idle');
  useEffect(() => {
    return audioManager.subscribeMicStatus((status) => setMicStatus(status));
  }, []);

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div
      className={`min-h-screen md:h-screen w-full transition-colors duration-500 overflow-x-hidden overflow-y-auto md:overflow-hidden flex flex-col ${
        isNightDim
          ? 'bg-black text-amber-100/90'
          : 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100'
      }`}
      style={{
        filter: isNightDim ? 'brightness(0.65) contrast(0.95)' : 'none',
      }}
    >
      {/* Streamlined Responsive Header (Phones + Huawei MediaPad T3 1280x800) */}
      <header className="flex items-center justify-between gap-2 sm:gap-4 px-2.5 sm:px-4 py-2 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-md shrink-0 z-30">
        {/* Zone 1: Single-line Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <img
            src="/tablet-icon.jpg"
            alt="Maya emblem"
            className="w-7 h-7 rounded-lg object-cover border border-slate-700/70"
          />
          <span className="hidden sm:inline text-base font-bold tracking-tight text-white font-display whitespace-nowrap">
            Maya
          </span>
        </div>

        {/* Zone 2: Clean Mode Switcher (Put Tasks & Schedule Away <-> Full Planner) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div
            className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl"
            role="tablist"
            aria-label="Display Mode"
          >
            <button
              onClick={() => handleSetViewMode('clock')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'clock'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Hide Tasks & Schedule — Show only Hour, Time, Date & Maya"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="sm:hidden">Clock</span>
              <span className="hidden sm:inline">Clock &amp; Maya</span>
            </button>
            <button
              onClick={() => handleSetViewMode('planner')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'planner'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Show Tasks Strip, Daily Schedule, Daily Wish & Maya"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="sm:hidden">Tasks</span>
              <span className="hidden sm:inline">Tasks &amp; Schedule</span>
            </button>
          </div>

          {micStatus !== 'active' && (
            <button
              onClick={() => {
                audioManager.requestMicrophone();
                audioManager.startRecognition();
              }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Enable Hands-Free</span>
            </button>
          )}
        </div>

        {/* Zone 3: Phone & Tablet Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setIsLogsModalOpen(true)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border bg-slate-900 border-slate-800 hover:border-sky-500/50 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-medium whitespace-nowrap"
            title="Conversation Logs & Search Sources"
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Logs</span>
          </button>

          <PWAInstallButton />

          <button
            onClick={() => setIsNightDim(!isNightDim)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isNightDim
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title={isNightDim ? 'Disable Night Dim' : 'Enable Night Dim'}
          >
            {isNightDim ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>

          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="User Profile & Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Responsive Split (Portrait Phone: Maya first & scrollable; Landscape Tablet: 1280x800 Zero-Scroll) */}
      {viewMode === 'clock' ? (
        <main className="flex-1 p-3 sm:p-4 md:overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch w-full max-w-[1920px] mx-auto min-h-0">
          {/* Clock Hero: 2nd on phone, 1st on tablet/desktop */}
          <div className="order-2 md:order-1 md:col-span-6 md:h-full md:overflow-hidden flex flex-col min-h-[260px] md:min-h-0">
            <WatchWidget
              weather={weather}
              isNightDim={isNightDim}
              variant="hero"
              locationCity={location.city}
            />
          </div>

          {/* Maya Companion: 1st on phone, 2nd on tablet/desktop */}
          <div className="order-1 md:order-2 md:col-span-6 md:h-full flex flex-col md:overflow-hidden min-h-0">
            <RealisticMayaCard
              tasks={tasks}
              schedule={schedule}
              weather={weather}
              userProfile={userProfile}
              onUpdateProfile={setUserProfile}
              location={location}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
              onAddTask={handleAddTask}
              onAddEvent={handleAddEvent}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              isNightDim={isNightDim}
              layoutMode="clock"
            />
          </div>
        </main>
      ) : (
        <main className="flex-1 p-2 sm:p-2.5 md:overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-2.5 items-stretch w-full max-w-[1920px] mx-auto min-h-0">
          {/* Planner Left Column: 2nd on phone, 1st on tablet/desktop */}
          <div className="order-2 md:order-1 md:col-span-7 flex flex-col gap-2 md:h-full md:overflow-hidden min-h-0">
            <WatchWidget weather={weather} isNightDim={isNightDim} variant="compact" />

            <WishesWidget isNightDim={isNightDim} />

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 md:overflow-hidden">
              <div className="md:h-full md:overflow-hidden flex flex-col min-h-0">
                <TasksStrip
                  tasks={tasks}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onDeleteTask={handleDeleteTask}
                  isNightDim={isNightDim}
                />
              </div>

              <div className="md:h-full md:overflow-hidden flex flex-col min-h-0">
                <ScheduleWidget
                  events={schedule}
                  onAddEvent={handleAddEvent}
                  onToggleEvent={handleToggleEvent}
                  onDeleteEvent={handleDeleteEvent}
                  isNightDim={isNightDim}
                />
              </div>
            </div>
          </div>

          {/* Maya Companion: 1st on phone, 2nd on tablet/desktop */}
          <div className="order-1 md:order-2 md:col-span-5 md:h-full flex flex-col md:overflow-hidden min-h-0">
            <RealisticMayaCard
              tasks={tasks}
              schedule={schedule}
              weather={weather}
              userProfile={userProfile}
              onUpdateProfile={setUserProfile}
              location={location}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
              onAddTask={handleAddTask}
              onAddEvent={handleAddEvent}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              isNightDim={isNightDim}
              layoutMode="full"
            />
          </div>
        </main>
      )}

      {/* User Profile & Tablet Hardware Sensors Modal */}
      <UserProfileSensorsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={userProfile}
        onUpdateProfile={setUserProfile}
        location={location}
        onLocationUpdate={handleLocationUpdate}
        isNightDim={isNightDim}
      />

      {/* Acoustic Voice Wake-Up / Deep Black Screen Sleep Overlay */}
      <AcousticSleepOverlay
        isSleeping={isSleeping}
        onWakeUp={resetInactivityTimer}
        liveDb={liveDb}
        isVoiceDetected={isVoiceActive}
        userName={userProfile.name}
      />

      {/* Conversation History & Tablet Logs Modal */}
      <ConversationLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        isNightDim={isNightDim}
      />

      {/* Offline Connectivity Indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode — Local assistant features active</span>
        </div>
      )}
    </div>
  );
}
