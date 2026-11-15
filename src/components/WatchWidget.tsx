import React, { useState, useEffect } from 'react';
import { CloudSun, Moon, Calendar, MapPin } from 'lucide-react';
import { WeatherData } from '../types/assistant';
import ambientBackdrop from '../assets/images/tablet_ambient_backdrop_1794582844111.jpg';

interface WatchWidgetProps {
  weather: WeatherData;
  isNightDim?: boolean;
  variant?: 'compact' | 'hero';
  locationCity?: string;
}

const AMBIENT_BACKDROP = ambientBackdrop;

export const WatchWidget: React.FC<WatchWidgetProps> = ({
  weather,
  isNightDim = false,
  variant = 'compact',
  locationCity,
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const isPM = hours >= 12;
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');

  const dayName = time.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDayLong = time.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const monthDayShort = time.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeOfDayGreeting =
    hours < 6 ? 'Late Night' : hours < 12 ? 'Good Morning' : hours < 17 ? 'Good Afternoon' : 'Good Evening';

  if (variant === 'hero') {
    return (
      <div
        className={`relative h-full w-full rounded-3xl overflow-hidden border flex flex-col justify-between p-6 sm:p-8 lg:p-10 transition-all duration-300 ${
          isNightDim
            ? 'bg-black border-amber-950/40 text-amber-100/90'
            : 'bg-slate-950 border-slate-800/80 text-white shadow-2xl'
        }`}
      >
        {/* Subtle Ambient Tablet Backdrop Artwork with Measured Scrim */}
        {!isNightDim && (
          <>
            <img
              src={AMBIENT_BACKDROP}
              alt="Calm bedside tablet atmosphere"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/75 to-slate-900/85 pointer-events-none" />
          </>
        )}

        {/* Top Row: Greeting & Location */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <span className="text-sm font-medium tracking-wide text-sky-300 font-display">
            {timeOfDayGreeting}
          </span>
          {(locationCity || weather.city) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[180px]">{locationCity || weather.city}</span>
            </div>
          )}
        </div>

        {/* Centerpiece: Large Tabular Hour, Minutes, Seconds & Date */}
        <div className="relative z-10 flex flex-col justify-center my-auto py-4">
          <div className="flex items-baseline gap-3">
            <span
              className={`text-7xl sm:text-8xl lg:text-[7.5rem] font-black tracking-tight font-display tabular-nums leading-none ${
                isNightDim ? 'text-amber-300' : 'text-slate-50'
              }`}
            >
              {formattedHours}:{formattedMinutes}
            </span>
            <div className="flex flex-col items-start justify-end gap-1 pb-1">
              <span className="text-sm sm:text-base font-bold font-mono text-sky-400 uppercase tracking-wider">
                {isPM ? 'PM' : 'AM'}
              </span>
              <span className="text-2xl sm:text-3xl font-semibold font-mono text-slate-400 tabular-nums leading-none">
                :{formattedSeconds}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2.5 text-lg sm:text-xl text-slate-200 font-medium">
            <Calendar className="w-5 h-5 text-sky-400 shrink-0" />
            <span>{dayName}</span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-slate-300 font-normal">{monthDayLong}</span>
          </div>
        </div>

        {/* Bottom Hairline Divider & Clean Weather Readout */}
        <div className="relative z-10 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {hours >= 6 && hours < 19 ? (
              <CloudSun className="w-6 h-6 text-amber-400 shrink-0" />
            ) : (
              <Moon className="w-6 h-6 text-sky-300 shrink-0" />
            )}
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl font-bold font-display text-white tabular-nums">
                {weather.temp}°C
              </span>
              <span className="text-sm text-slate-300">{weather.condition}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
            <span>High {weather.high}°</span>
            <span aria-hidden="true">·</span>
            <span>Low {weather.low}°</span>
            <span aria-hidden="true">·</span>
            <span>Humidity {weather.humidity}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl transition-all duration-300 px-4 py-2.5 border flex items-center justify-between gap-4 shrink-0 ${
        isNightDim
          ? 'bg-slate-900/60 border-amber-950/40 text-amber-100/90 shadow-none'
          : 'bg-slate-900/85 border-slate-800 text-white shadow-xl backdrop-blur-md'
      }`}
    >
      {/* Left Side: Crisp Digital Time & Date */}
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-4xl sm:text-5xl font-black tracking-tight font-display tabular-nums leading-none ${
              isNightDim ? 'text-amber-300' : 'text-slate-50'
            }`}
          >
            {formattedHours}:{formattedMinutes}
          </span>
          <div className="flex flex-col items-start leading-none gap-0.5">
            <span className="text-[10px] font-bold font-mono text-sky-400 uppercase">
              {isPM ? 'PM' : 'AM'}
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-slate-400 tabular-nums">
              :{formattedSeconds}
            </span>
          </div>
        </div>

        <div className="h-9 w-px bg-slate-800 hidden sm:block" />

        <div className="flex flex-col justify-center">
          <span className="text-xs font-medium text-sky-400">
            {timeOfDayGreeting}
          </span>
          <div className="flex items-center gap-1.5 text-slate-200 text-sm font-semibold mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>{dayName}</span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-slate-300 font-normal">{monthDayShort}</span>
          </div>
        </div>
      </div>

      {/* Right Side: Clean Weather Summary */}
      <div className="flex items-center gap-3 pl-3 border-l border-slate-800/80 shrink-0">
        {hours >= 6 && hours < 19 ? (
          <CloudSun className="w-5 h-5 text-amber-400 shrink-0" />
        ) : (
          <Moon className="w-5 h-5 text-sky-300 shrink-0" />
        )}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-display text-white tabular-nums leading-none">
              {weather.temp}°C
            </span>
            <span className="text-[11px] text-slate-300 truncate max-w-[100px]">
              {weather.condition}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-mono tabular-nums">
            <span>H: {weather.high}° L: {weather.low}°</span>
            <span aria-hidden="true">·</span>
            <span>{weather.humidity}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
