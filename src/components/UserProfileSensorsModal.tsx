import React, { useState, useEffect } from 'react';
import {
  User,
  Mic,
  MapPin,
  Battery,
  Sparkles,
  Check,
  Edit2,
  RefreshCw,
  X,
  Activity,
  Shield,
  Trash2,
} from 'lucide-react';
import { UserProfile, tabletVoiceSensor, VoiceAnalysisResult } from '../utils/voiceSensor';
import { TabletLocation, detectTabletLocation, fetchLiveWeather } from '../utils/locationWeather';
import { WeatherData } from '../types/assistant';

interface UserProfileSensorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  location: TabletLocation;
  onLocationUpdate: (loc: TabletLocation, weather: WeatherData) => void;
  isNightDim: boolean;
}

export const UserProfileSensorsModal: React.FC<UserProfileSensorsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  location,
  onLocationUpdate,
  isNightDim,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [isLocating, setIsLocating] = useState(false);
  const [isSamplingVoice, setIsSamplingVoice] = useState(false);
  const [voiceSampleStatus, setVoiceSampleStatus] = useState<string>('');
  const [privacyCleared, setPrivacyCleared] = useState(false);
  const [livePitch, setLivePitch] = useState<number>(profile.voicePitchHz);
  const [liveDb, setLiveDb] = useState<number>(profile.roomNoiseLevel);
  const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean }>({
    level: 100,
    charging: true,
  });

  useEffect(() => {
    setNameInput(profile.name);
  }, [profile.name, isOpen]);

  // Battery Sensor
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryInfo({
          level: Math.round(battery.level * 100),
          charging: battery.charging,
        });
        battery.addEventListener('levelchange', () => {
          setBatteryInfo((prev) => ({ ...prev, level: Math.round(battery.level * 100) }));
        });
        battery.addEventListener('chargingchange', () => {
          setBatteryInfo((prev) => ({ ...prev, charging: battery.charging }));
        });
      }).catch(() => {});
    }
  }, []);

  if (!isOpen) return null;

  const handleSaveName = () => {
    if (nameInput.trim()) {
      const updated = { ...profile, name: nameInput.trim() };
      onUpdateProfile(updated);
      tabletVoiceSensor.saveProfile(updated);
    }
    setIsEditingName(false);
  };

  // Re-detect approximate city location
  const handleRefreshLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await detectTabletLocation();
      const weather = await fetchLiveWeather(loc);
      onLocationUpdate(loc, weather);
    } catch {
      // Keep current cached weather/location quietly
    } finally {
      setIsLocating(false);
    }
  };

  // Voice sensor calibration test
  const handleStartVoiceCalibration = async () => {
    setIsSamplingVoice(true);
    setVoiceSampleStatus('Listening to your natural voice... Say a few words to Maya');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await tabletVoiceSensor.startSensor(stream);

      const samples: VoiceAnalysisResult[] = [];
      const interval = setInterval(() => {
        const analysis = tabletVoiceSensor.analyzeCurrentAudio();
        if (analysis.speechEnergy > 0.02) {
          samples.push(analysis);
          setLivePitch(analysis.pitchHz);
          setLiveDb(analysis.roomNoiseDb);
        }
      }, 150);

      setTimeout(() => {
        clearInterval(interval);
        tabletVoiceSensor.stopSensor();
        stream.getTracks().forEach((t) => t.stop());
        setIsSamplingVoice(false);

        if (samples.length > 0) {
          const avgPitch = Math.round(
            samples.reduce((acc, s) => acc + s.pitchHz, 0) / samples.length
          );
          const lastSample = samples[samples.length - 1];
          const updated = tabletVoiceSensor.recordVoiceSample({
            ...lastSample,
            pitchHz: avgPitch,
          });
          onUpdateProfile(updated);
          setVoiceSampleStatus(`Voice calibrated! Recognized ${updated.vocalRange} (~${avgPitch} Hz)`);
        } else {
          setVoiceSampleStatus('Sample was too quiet, please try again speaking closer to mic.');
        }
      }, 3500);
    } catch {
      setIsSamplingVoice(false);
      setVoiceSampleStatus('Microphone permission required to calibrate voice sensor.');
    }
  };

  const handleEraseLocalData = () => {
    try {
      const keysToClear = [
        'maya_user_profile',
        'aura_user_profile',
        'maya_tablet_location',
        'aura_tablet_location',
        'maya_cached_weather',
        'aura_cached_weather',
        'maya_conversation_logs_v1',
        'maya_tasks_v1',
        'maya_schedule_v1',
        'maya_view_mode',
        'maya_acoustic_mode',
        'aura_acoustic_mode',
      ];
      keysToClear.forEach((k) => localStorage.removeItem(k));
      setPrivacyCleared(true);
      setTimeout(() => setPrivacyCleared(false), 3000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-white">
                User Profile & Tablet Sensors
              </h2>
              <p className="text-xs text-slate-400">
                Voice recognition, location sensing & companion personalization
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: User Profile & Name */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono block mb-2">
            Companion User Profile
          </span>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {profile.name.charAt(0)}
              </div>
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="px-3 py-1 bg-slate-800 border border-sky-500 rounded-lg text-white text-base font-bold focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="p-1.5 bg-sky-500 text-white rounded-lg hover:bg-sky-400"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-white font-display">
                      {profile.name}
                    </span>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-slate-400 hover:text-sky-400"
                      title="Edit Name"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <span className="text-xs text-slate-400">
                  Maya speaks to you as <strong className="text-sky-300">{profile.name}</strong>
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Primary Tablet Owner
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Voice Recognition & Vocal Sensor */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Voice Sensor & Audio Profile
              </span>
            </div>

            <button
              onClick={handleStartVoiceCalibration}
              disabled={isSamplingVoice}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isSamplingVoice
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isSamplingVoice ? 'Sampling Voice...' : 'Calibrate Voice'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">Vocal Classification</span>
              <span className="text-sm font-semibold text-slate-100 font-mono">
                {profile.vocalRange}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">Fundamental Pitch</span>
              <span className="text-sm font-semibold text-sky-400 font-mono">
                ~{livePitch || profile.voicePitchHz} Hz
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">Room Ambient Noise</span>
              <span className="text-sm font-semibold text-emerald-400 font-mono">
                {liveDb || profile.roomNoiseLevel} dB (Quiet)
              </span>
            </div>
          </div>

          {voiceSampleStatus && (
            <p className="mt-3 text-xs text-sky-300 font-medium bg-sky-950/40 p-2.5 rounded-xl border border-sky-500/30">
              {voiceSampleStatus}
            </p>
          )}
        </div>

        {/* Section 3: Hardware Sensors Grid (Location, Power, Network) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Location Sensor */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                  Location Sensor (GPS)
                </span>
              </div>
              <button
                onClick={handleRefreshLocation}
                disabled={isLocating}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Detect Tablet GPS"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div>
              <div className="text-sm font-bold text-white font-display">
                {location.city}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Stored locally on this device only
              </div>
            </div>
          </div>

          {/* Battery & 24/7 Power Sensor */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Battery className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Power & Battery Sensor
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-display">
                  {batteryInfo.level}% Battery
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {batteryInfo.charging ? '24/7 AC Connected' : 'Battery Mode'}
                </span>
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block">
                Continuous Keep-Awake Sentinel Active
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: What Maya knows about you */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              Learned Preferences & Routine
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {profile.preferences.map((pref, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
              >
                {pref}
              </span>
            ))}
          </div>
        </div>

        {/* Section 5: Spoken Language & Privacy */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-white">
                Spoken Language &amp; Privacy
              </span>
            </div>
            <span className="text-[11px] text-emerald-300 font-medium">
              On-device storage
            </span>
          </div>

          <div className="text-xs text-slate-300 mb-3">
            Maya adapts automatically to Slovenian, English, and other languages. Your profile, tasks, schedule, and conversation history stay strictly in your device&apos;s local storage with no IP tracking or server database.
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { code: 'auto', label: 'Auto Detect' },
              { code: 'en-US', label: 'English' },
              { code: 'sl-SI', label: 'Slovenščina' },
              { code: 'de-DE', label: 'Deutsch' },
              { code: 'es-ES', label: 'Español' },
              { code: 'fr-FR', label: 'Français' },
              { code: 'it-IT', label: 'Italiano' },
              { code: 'hr-HR', label: 'Hrvatski' },
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  const updated = { ...profile, language: lang.code };
                  onUpdateProfile(updated);
                  tabletVoiceSensor.saveProfile(updated);
                }}
                className={`p-2 rounded-xl text-left border text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  (profile.language || 'auto') === lang.code
                    ? 'bg-sky-500/20 text-sky-200 border-sky-500/50 font-semibold'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{lang.label}</span>
                {(profile.language || 'auto') === lang.code && (
                  <Check className="w-3 h-3 text-sky-400" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              {privacyCleared
                ? 'All local data erased from this device.'
                : 'Reset stored profile, tasks, schedule, and chat history'}
            </span>
            <button
              type="button"
              onClick={handleEraseLocalData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/30 text-rose-200 text-xs font-medium transition-colors cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Erase Local Data</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-md transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
