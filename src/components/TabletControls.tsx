import React, { useState, useEffect } from 'react';
import { Maximize, Minimize, Moon, Sun, ShieldCheck, Zap, Mic, Volume2 } from 'lucide-react';

interface TabletControlsProps {
  isNightDim: boolean;
  onToggleNightDim: () => void;
  burnInShiftIndex: number;
  acousticSleepMode: 'off' | '1m' | '2m';
  onChangeAcousticSleepMode: (mode: 'off' | '1m' | '2m') => void;
  secondsUntilSleep: number;
  isVoiceActive: boolean;
}

export const TabletControls: React.FC<TabletControlsProps> = ({
  isNightDim,
  onToggleNightDim,
  burnInShiftIndex,
  acousticSleepMode,
  onChangeAcousticSleepMode,
  secondsUntilSleep,
  isVoiceActive,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [showAcousticMenu, setShowAcousticMenu] = useState(false);

  // Screen Wake Lock API for 24/7 tablet display
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);

          wakeLockSentinel.addEventListener('release', () => {
            setWakeLockActive(false);
          });
        }
      } catch (err) {
        console.warn('Wake Lock request error:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // Fullscreen toggle for Android landscape kiosk
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Acoustic Voice Wake-Up / Auto-Sleep Toggle */}
      <div className="relative">
        <button
          onClick={() => setShowAcousticMenu(!showAcousticMenu)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
            acousticSleepMode !== 'off'
              ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300'
              : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
          }`}
          title="Voice Sound Wake-Up: Wakes on human voice, sleeps when quiet"
        >
          <Mic className={`w-3.5 h-3.5 ${isVoiceActive ? 'text-emerald-400 animate-pulse' : ''}`} />
          <span className="hidden sm:inline font-mono">
            {acousticSleepMode === 'off'
              ? 'Voice Wake: Off'
              : `Voice Wake: ${acousticSleepMode} (${formatCountdown(secondsUntilSleep)})`}
          </span>
          <span className="sm:hidden font-mono">
            {acousticSleepMode === 'off' ? 'Wake' : acousticSleepMode}
          </span>
        </button>

        {showAcousticMenu && (
          <div className="absolute right-0 top-full mt-2 w-52 p-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 text-xs">
            <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Voice Wake & Sleep
            </div>
            <p className="px-2.5 py-1 text-[11px] text-slate-300 leading-tight mb-1">
              Turns off screen when quiet. Wakes up immediately when human voice is heard.
            </p>

            <button
              onClick={() => {
                onChangeAcousticSleepMode('1m');
                setShowAcousticMenu(false);
              }}
              className={`w-full text-left px-3 py-1.5 rounded-lg mb-1 transition-colors ${
                acousticSleepMode === '1m'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Sleep after 1 min quiet
            </button>

            <button
              onClick={() => {
                onChangeAcousticSleepMode('2m');
                setShowAcousticMenu(false);
              }}
              className={`w-full text-left px-3 py-1.5 rounded-lg mb-1 transition-colors ${
                acousticSleepMode === '2m'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Sleep after 2 min quiet (Default)
            </button>

            <button
              onClick={() => {
                onChangeAcousticSleepMode('off');
                setShowAcousticMenu(false);
              }}
              className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors ${
                acousticSleepMode === 'off'
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Always On (Never sleep)
            </button>
          </div>
        )}
      </div>

      {/* Bedside Night Dim toggle */}
      <button
        onClick={onToggleNightDim}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
          isNightDim
            ? 'bg-amber-950/60 border-amber-800/60 text-amber-300'
            : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
        }`}
        title="Toggle Night Bedside Mode (warm amber display)"
      >
        {isNightDim ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-sky-400" />}
        <span className="hidden sm:inline">{isNightDim ? 'Day' : 'Dim'}</span>
      </button>

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Kiosk Fullscreen'}
      >
        {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
