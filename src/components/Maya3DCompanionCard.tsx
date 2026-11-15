import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Shirt,
  Check,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { MayaRoomScene } from '../3d/MayaRoomScene';
import { OUTFIT_OPTIONS, OutfitOption } from '../3d/MayaCharacter';
import { Task, ScheduleEvent, WeatherData } from '../types/assistant';
import { UserProfile, tabletVoiceSensor } from '../utils/voiceSensor';
import { TabletLocation } from '../utils/locationWeather';

interface Maya3DCompanionCardProps {
  tasks: Task[];
  schedule: ScheduleEvent[];
  weather: WeatherData;
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  location: TabletLocation;
  onOpenProfileModal: () => void;
  onAddTask: (task: Omit<Task, 'id'>) => void;
  onAddEvent: (event: Omit<ScheduleEvent, 'id'>) => void;
  isNightDim?: boolean;
}

export const Maya3DCompanionCard: React.FC<Maya3DCompanionCardProps> = ({
  tasks,
  schedule,
  weather,
  userProfile,
  onUpdateProfile,
  location,
  onOpenProfileModal,
  onAddTask,
  onAddEvent,
  isNightDim = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomSceneRef = useRef<MayaRoomScene | null>(null);

  const [currentOutfit, setCurrentOutfit] = useState<OutfitOption>(OUTFIT_OPTIONS[0]);
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastReply, setLastReply] = useState<string>(
    `Good to see you, ${userProfile.name}! I'm right here in my room. How can I help with your schedule, tasks, or just talking about life?`
  );
  const [transcript, setTranscript] = useState('');
  const [liveDbLevel, setLiveDbLevel] = useState<number>(36);

  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'assistant',
      text: `Good to see you, ${userProfile.name}! I'm right here in my room. How can I help with your schedule, tasks, or just talking about life?`,
    },
  ]);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioIntervalRef = useRef<any>(null);

  // Initialize 3D Room & Maya Character
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new MayaRoomScene(containerRef.current);
    roomSceneRef.current = scene;

    const handleResize = () => {
      if (containerRef.current && roomSceneRef.current) {
        roomSceneRef.current.resize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.destroy();
      roomSceneRef.current = null;
    };
  }, []);

  // Update window globals for Three.js render loop audio sync
  useEffect(() => {
    (window as any).__mayaIsSpeaking = isSpeaking;
  }, [isSpeaking]);

  // Initialize Speech Synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Change outfit helper
  const handleSelectOutfit = (outfit: OutfitOption) => {
    setCurrentOutfit(outfit);
    if (roomSceneRef.current) {
      roomSceneRef.current.maya.setOutfit(outfit.id);
    }
    setShowWardrobe(false);
  };

  // Speech output helper
  const speakText = (text: string) => {
    if (!synthRef.current || !voiceEnabled) return;

    synthRef.current.cancel();
    const cleanText = text
      .replace(/[*#_~`]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Pick pleasant female voice
    const voices = synthRef.current.getVoices();
    const preferredVoices = [
      /google.*(us|uk).*english.*female/i,
      /google.*(en_us|en_gb)/i,
      /natural.*female/i,
      /samantha.*enhanced/i,
      /samantha/i,
      /victoria/i,
      /karen/i,
      /serena/i,
      /zira/i,
      /female/i,
      /en-us/i,
      /en/i,
    ];

    let chosenVoice: SpeechSynthesisVoice | null = null;
    for (const pattern of preferredVoices) {
      const found = voices.find((v) => pattern.test(v.name) || pattern.test(v.lang));
      if (found) {
        chosenVoice = found;
        break;
      }
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.pitch = 0.98;
    utterance.rate = 0.88;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      (window as any).__mayaIsSpeaking = true;
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      (window as any).__mayaIsSpeaking = false;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      (window as any).__mayaIsSpeaking = false;
    };

    synthRef.current.speak(utterance);
  };

  // Toggle voice recognition
  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopVoiceSensor();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. You can type below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      await tabletVoiceSensor.startSensor(stream);

      audioIntervalRef.current = setInterval(() => {
        const analysis = tabletVoiceSensor.analyzeCurrentAudio();
        setLiveDbLevel(analysis.roomNoiseDb);
        if (analysis.speechEnergy > 0.02) {
          const updated = tabletVoiceSensor.recordVoiceSample(analysis);
          onUpdateProfile(updated);
        }
      }, 300);
    } catch (e) {
      console.warn('Microphone stream error:', e);
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const resultText = event.results[current][0].transcript;
      setTranscript(resultText);

      // Spoken name check
      const detectedName = tabletVoiceSensor.detectNameInText(resultText);
      if (detectedName && detectedName !== userProfile.name) {
        const updated = { ...userProfile, name: detectedName };
        onUpdateProfile(updated);
        tabletVoiceSensor.saveProfile(updated);
      }

      if (event.results[current].isFinal) {
        stopVoiceSensor();
        sendMessage(resultText);
      }
    };

    recognition.onerror = (e: any) => {
      console.error('Speech recognition error:', e);
      stopVoiceSensor();
      setIsListening(false);
    };

    recognition.onend = () => {
      stopVoiceSensor();
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceSensor = () => {
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    tabletVoiceSensor.stopSensor();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  };

  // Fluent conversation send
  const sendMessage = async (textToSend?: string) => {
    const message = (textToSend || inputText).trim();
    if (!message || isLoading) return;

    // Check voice dress change command
    const lower = message.toLowerCase();
    if (lower.includes('dress') || lower.includes('wear') || lower.includes('outfit')) {
      if (lower.includes('sage') || lower.includes('green')) {
        handleSelectOutfit(OUTFIT_OPTIONS[1]);
      } else if (lower.includes('terracotta') || lower.includes('orange') || lower.includes('silk')) {
        handleSelectOutfit(OUTFIT_OPTIONS[2]);
      } else if (lower.includes('indigo') || lower.includes('blue') || lower.includes('velvet')) {
        handleSelectOutfit(OUTFIT_OPTIONS[3]);
      } else if (lower.includes('emerald') || lower.includes('cardigan')) {
        handleSelectOutfit(OUTFIT_OPTIONS[4]);
      } else if (lower.includes('cashmere') || lower.includes('cream') || lower.includes('cozy')) {
        handleSelectOutfit(OUTFIT_OPTIONS[0]);
      }
    }

    // Name detection
    const detectedName = tabletVoiceSensor.detectNameInText(message);
    if (detectedName && detectedName !== userProfile.name) {
      const updated = { ...userProfile, name: detectedName };
      onUpdateProfile(updated);
      tabletVoiceSensor.saveProfile(updated);
    }

    setInputText('');
    setTranscript('');
    setIsLoading(true);

    const newHistory = [...chatHistory, { sender: 'user' as const, text: message }];
    setChatHistory(newHistory);

    try {
      const now = new Date();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          persona: 'maya',
          history: newHistory,
          userProfile: {
            name: userProfile.name,
            vocalRange: userProfile.vocalRange,
            preferences: userProfile.preferences,
          },
          userContext: {
            location: location.city,
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
            weather: `${weather.temp}°C, ${weather.condition}`,
            tasks: tasks.slice(0, 5).map((t) => `${t.title} (${t.completed ? 'Done' : 'Pending'})`),
            schedule: schedule.slice(0, 5).map((s) => `${s.time} - ${s.title}`),
          },
        }),
      });

      const data = await res.json();
      const reply = data.reply || `I'm right here with you in the room, ${userProfile.name}.`;

      setLastReply(reply);
      setChatHistory((prev) => [...prev, { sender: 'assistant', text: reply }]);

      // Check actions
      if (data.action) {
        if (data.action.type === 'UPDATE_NAME' && data.action.name) {
          const updated = { ...userProfile, name: data.action.name };
          onUpdateProfile(updated);
          tabletVoiceSensor.saveProfile(updated);
        } else if (data.action.type === 'ADD_TASK' && data.action.title) {
          onAddTask({
            title: data.action.title,
            category: 'Focus',
            priority: 'medium',
            completed: false,
          });
        } else if (data.action.type === 'ADD_EVENT' && data.action.title) {
          onAddEvent({
            title: data.action.title,
            time: data.action.time || '15:00',
            duration: data.action.duration || '30m',
            category: 'focus',
            completed: false,
          });
        }
      }

      if (voiceEnabled) {
        speakText(reply);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const fallback = `I'm right here beside you, ${userProfile.name}. What's on your mind?`;
      setLastReply(fallback);
      setChatHistory((prev) => [...prev, { sender: 'assistant', text: fallback }]);
      if (voiceEnabled) speakText(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    `How's my day looking, Maya?`,
    'Change your dress to emerald',
    'Give me a daily wish',
    'Let’s talk about life',
    'What should I focus on next?',
  ];

  return (
    <div
      className={`relative h-full flex flex-col rounded-3xl overflow-hidden border transition-all duration-300 shadow-2xl ${
        isNightDim
          ? 'bg-slate-950/80 border-amber-950/40 text-amber-100/80'
          : 'bg-slate-900/90 border-slate-800 text-slate-100 backdrop-blur-xl'
      }`}
    >
      {/* Top Bar on Companion 3D Card */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent">
        {/* Maya & Profile Badge */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenProfileModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-slate-700/70 shadow-md transition-colors"
            title="User Profile & Sensors"
          >
            <div className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-xs font-bold text-white tracking-wide">Maya 3D</span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] text-sky-300 font-medium">{userProfile.name}</span>
            <Settings className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {/* Change Dress / Wardrobe Button */}
          <div className="relative">
            <button
              onClick={() => setShowWardrobe(!showWardrobe)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-slate-700/70 shadow-md transition-colors text-xs text-amber-300 font-medium"
              title="Change Maya's Dress & Outfit"
            >
              <Shirt className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{currentOutfit.name}</span>
            </button>

            {/* Wardrobe Dress Selector Dropdown */}
            {showWardrobe && (
              <div className="absolute left-0 top-full mt-2 w-56 p-2 bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl z-50 backdrop-blur-md">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Maya's Wardrobe
                </div>
                {OUTFIT_OPTIONS.map((outfit) => (
                  <button
                    key={outfit.id}
                    onClick={() => handleSelectOutfit(outfit)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl mb-1 text-xs transition-colors ${
                      currentOutfit.id === outfit.id
                        ? 'bg-sky-500/20 text-sky-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: outfit.color }}
                      />
                      <span>{outfit.name}</span>
                    </div>
                    {currentOutfit.id === outfit.id && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Speaking & Audio Controls */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isSpeaking
                  ? 'bg-emerald-400 animate-ping'
                  : isListening
                  ? 'bg-rose-400 animate-pulse'
                  : isLoading
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-sky-400'
              }`}
            />
            <span className="font-mono">
              {isSpeaking ? 'Talking...' : isListening ? `Listening (${liveDbLevel}dB)` : isLoading ? 'Thinking...' : 'In Room'}
            </span>
          </div>

          {/* Voice Output Toggle */}
          <button
            onClick={() => {
              if (isSpeaking && synthRef.current) {
                synthRef.current.cancel();
              }
              setVoiceEnabled(!voiceEnabled);
            }}
            className={`p-2 rounded-full border transition-colors ${
              voiceEnabled
                ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-500'
            }`}
            title={voiceEnabled ? 'Mute companion voice' : 'Enable companion voice'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 3D WebGL Living Room Viewport (Dominant & Full Presence) */}
      <div className="relative flex-1 min-h-[420px] lg:min-h-[500px] overflow-hidden bg-slate-950">
        {/* Three.js Canvas Container */}
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Live 3D Talking Indicator overlay */}
        {isSpeaking && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/80 border border-sky-400/40 backdrop-blur-md z-10 shadow-xl pointer-events-none">
            <span className="text-[11px] font-mono text-sky-300">Maya 3D Talking · {currentOutfit.name}</span>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-sky-400 rounded-full animate-wave-bar"
                style={{
                  animationDelay: `${i * 0.12}s`,
                  height: `${12 + (i % 3) * 6}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Live speech transcript caption while user is speaking */}
        {isListening && transcript && (
          <div className="absolute bottom-16 left-4 right-4 p-3 rounded-2xl bg-slate-900/95 border border-sky-500/50 text-xs text-slate-100 text-center backdrop-blur-md shadow-2xl">
            <span className="text-sky-300 font-semibold block text-[10px] mb-0.5">
              Voice Sensor: {userProfile.vocalRange} · {liveDbLevel} dB
            </span>
            "{transcript}"
          </div>
        )}
      </div>

      {/* Dialogue Bubble & Fluent Conversational Controls */}
      <div className="relative z-10 p-4 bg-slate-950/95 border-t border-slate-800/80 flex flex-col gap-3">
        {/* Maya's Spoken Response Bubble */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-sky-400">
              Maya (in {currentOutfit.name})
            </span>
            <button
              onClick={() => speakText(lastReply)}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              title="Repeat aloud"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Listen again</span>
            </button>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-normal select-text">
            "{lastReply}"
          </p>
        </div>

        {/* Quick Conversational Suggestions */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white whitespace-nowrap transition-colors flex-shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Fluent Speech & Text Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Big Voice Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3.5 rounded-2xl transition-all shadow-lg flex items-center justify-center flex-shrink-0 ${
              isListening
                ? 'bg-rose-500 text-white ring-4 ring-rose-500/30 animate-pulse'
                : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
            title={isListening ? 'Stop listening' : `Tap to talk with Maya in her room`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Talk or type with Maya (e.g. "Maya, wear your emerald dress")`}
            disabled={isLoading}
            className="flex-1 px-4 py-3 text-sm bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />

          {/* Send */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition-colors flex-shrink-0"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
