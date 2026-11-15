import React, { useState } from 'react';
import { Sparkles, RefreshCw, Volume2 } from 'lucide-react';
import { audioManager } from '../utils/audioHardwareManager';

interface WishesWidgetProps {
  isNightDim?: boolean;
}

export const WishesWidget: React.FC<WishesWidgetProps> = ({ isNightDim = false }) => {
  const [wish, setWish] = useState<string>(
    'May you find ease in the steady moments today, breathing deeply and letting each task take its own time.'
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fetchNewWish = async () => {
    setIsRefreshing(true);
    try {
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      const res = await fetch('/api/wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeOfDay }),
      });
      const data = await res.json();
      if (data.wish) {
        setWish(data.wish);
      }
    } catch {
      // Quiet fallback to existing wish
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSpeakWish = () => {
    audioManager.speakHuman(
      wish,
      undefined,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
  };

  return (
    <div
      className={`rounded-2xl transition-all duration-300 px-3.5 py-2 border flex items-center justify-between gap-3 shrink-0 ${
        isNightDim
          ? 'bg-slate-900/40 border-amber-950/40 text-amber-100/70'
          : 'bg-slate-900/80 border-slate-800/80 text-slate-200 shadow-md backdrop-blur-md'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 font-mono">
              Daily Wish & Wisdom
            </span>
          </div>
          <p className="text-xs text-slate-200 italic leading-snug truncate">
            "{wish}"
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleSpeakWish}
          className={`p-2 rounded-xl text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors ${
            isSpeaking ? 'text-sky-400 animate-pulse' : ''
          }`}
          title="Listen to Maya read this wish"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={fetchNewWish}
          disabled={isRefreshing}
          className="p-2 rounded-xl text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
          title="Get fresh daily wish"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
