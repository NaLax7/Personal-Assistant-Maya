import React, { useState } from 'react';
import { RefreshCw, Volume2 } from 'lucide-react';
import { audioManager } from '../utils/audioHardwareManager';

interface WishesWidgetProps {
  isNightDim?: boolean;
}

const OFFLINE_WISHES = [
  'May you find ease in the steady moments today, breathing deeply and letting each task take its own time.',
  'May your morning begin with quiet clarity, and your evening settle into peaceful rest.',
  'May small steps today bring steady progress without rush or noise.',
  'May warmth, patience, and good energy stay beside you through every hour of the day.',
  'May you notice one calm detail around you right now and let your shoulders soften.',
  'May your focus feel effortless and your breaks feel genuinely restorative.',
];

export const WishesWidget: React.FC<WishesWidgetProps> = ({ isNightDim = false }) => {
  const [wish, setWish] = useState<string>(OFFLINE_WISHES[0]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const rotateOfflineWish = () => {
    const candidates = OFFLINE_WISHES.filter((w) => w !== wish);
    const next = candidates[Math.floor(Math.random() * candidates.length)] || OFFLINE_WISHES[0];
    setWish(next);
  };

  const fetchNewWish = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      rotateOfflineWish();
      return;
    }
    setIsRefreshing(true);
    try {
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      const res = await fetch('/api/wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeOfDay }),
      });
      if (!res.ok) throw new Error('Wish endpoint unavailable');
      const data = await res.json();
      if (data.wish) {
        setWish(data.wish);
      } else {
        rotateOfflineWish();
      }
    } catch {
      rotateOfflineWish();
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
      className={`rounded-2xl transition-all duration-300 px-4 py-2.5 border flex items-center justify-between gap-3 shrink-0 ${
        isNightDim
          ? 'bg-slate-900/40 border-amber-950/40 text-amber-100/70'
          : 'bg-slate-900/65 border-slate-800/70 text-slate-200 backdrop-blur-md'
      }`}
    >
      <div className="min-w-0">
        <span className="text-[11px] font-medium text-amber-300/90 block">
          Daily Wish &amp; Wisdom
        </span>
        <p className="text-xs text-slate-200/95 italic leading-snug truncate mt-0.5">
          &ldquo;{wish}&rdquo;
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleSpeakWish}
          className={`p-2 rounded-xl text-slate-400 hover:text-sky-300 hover:bg-slate-800/80 transition-colors cursor-pointer ${
            isSpeaking ? 'text-sky-400' : ''
          }`}
          title="Listen to Maya read this wish"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={fetchNewWish}
          disabled={isRefreshing}
          className="p-2 rounded-xl text-slate-400 hover:text-amber-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="Get fresh daily wish"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
