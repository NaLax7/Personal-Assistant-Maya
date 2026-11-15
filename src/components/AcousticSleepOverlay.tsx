import React from 'react';
import { Mic, Moon, Sparkles, Volume2 } from 'lucide-react';

interface AcousticSleepOverlayProps {
  isSleeping: boolean;
  onWakeUp: () => void;
  liveDb: number;
  isVoiceDetected: boolean;
  userName: string;
}

export const AcousticSleepOverlay: React.FC<AcousticSleepOverlayProps> = ({
  isSleeping,
  onWakeUp,
  liveDb,
  isVoiceDetected,
  userName,
}) => {
  if (!isSleeping) return null;

  return (
    <div
      onClick={onWakeUp}
      className="fixed inset-0 z-50 bg-black cursor-pointer select-none flex flex-col items-center justify-between p-8 transition-opacity duration-700 ease-in-out"
      style={{
        backgroundColor: '#000000',
      }}
    >
      {/* Top minimal status indicator */}
      <div className="w-full flex items-center justify-between opacity-30 hover:opacity-80 transition-opacity">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <Moon className="w-3.5 h-3.5" />
          <span>Screen Asleep (Power Saving & Anti-Burn-in)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
          <Mic className={`w-3.5 h-3.5 ${isVoiceDetected ? 'text-emerald-400' : 'text-zinc-600'}`} />
          <span>Voice Sentinel Active ({liveDb} dB)</span>
        </div>
      </div>

      {/* Center Subtle Pulse */}
      <div className="flex flex-col items-center justify-center text-center">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
            isVoiceDetected
              ? 'bg-emerald-500/20 text-emerald-400 ring-8 ring-emerald-500/20 scale-110'
              : 'bg-zinc-900/60 text-zinc-600 border border-zinc-800/80'
          }`}
        >
          {isVoiceDetected ? (
            <Volume2 className="w-8 h-8 animate-pulse text-emerald-400" />
          ) : (
            <Mic className="w-8 h-8 opacity-40" />
          )}
        </div>

        <p className="mt-4 text-xs font-mono text-zinc-600 tracking-wide uppercase">
          {isVoiceDetected
            ? 'Voice Sound Detected · Waking Up...'
            : 'Listening for voice to wake up'}
        </p>
        <span className="text-[11px] text-zinc-700 mt-1">
          Speak near tablet or tap anywhere to wake
        </span>
      </div>

      {/* Bottom hint */}
      <div className="text-center opacity-25">
        <span className="text-[10px] font-mono text-zinc-600">
          Maya Standby Display · Listening for {userName}
        </span>
      </div>
    </div>
  );
};
