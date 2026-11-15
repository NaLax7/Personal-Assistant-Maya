import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Send,
  Square,
  CheckCircle2,
  Trash2,
  Activity,
  Timer,
  Globe,
  ExternalLink,
  Sparkles,
  Loader2,
  History,
} from 'lucide-react';
import { Task, ScheduleEvent, WeatherData } from '../types/assistant';
import { UserProfile, tabletVoiceSensor } from '../utils/voiceSensor';
import { TabletLocation } from '../utils/locationWeather';
import {
  audioManager,
  AudioFrequencyData,
} from '../utils/audioHardwareManager';
import { liveVoiceClient, LiveConnectionState } from '../utils/liveVoiceClient';
import { conversationStorage } from '../utils/conversationStorage';
import { ConversationLogsModal } from './ConversationLogsModal';

// Single, permanent, photorealistic portrait of Maya smiling warmly with her whole face visible
const MAYA_SMILING_PHOTO = '/src/assets/images/companion_maya_1793524129665.jpg';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  lang?: string;
  sources?: Array<{ title: string; url: string }>;
  engine?: string;
}

interface GestureFeedback {
  title: string;
  subtitle: string;
  type: 'dismiss' | 'complete' | 'silenced' | 'wish' | 'greet' | 'diagnostic';
}

interface RealisticMayaCardProps {
  tasks: Task[];
  schedule: ScheduleEvent[];
  weather: WeatherData;
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  location: TabletLocation;
  onOpenProfileModal: () => void;
  onAddTask: (task: Omit<Task, 'id'>) => void;
  onAddEvent: (event: Omit<ScheduleEvent, 'id'>) => void;
  onToggleTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  isNightDim?: boolean;
  layoutMode?: 'full' | 'clock';
}

export const RealisticMayaCard: React.FC<RealisticMayaCardProps> = ({
  tasks,
  schedule,
  weather,
  userProfile,
  onUpdateProfile,
  location,
  onOpenProfileModal,
  onAddTask,
  onAddEvent,
  onToggleTask,
  onDeleteTask,
  isNightDim = false,
  layoutMode = 'full',
}) => {
  // Seamless multilingual detection (auto-adapts to Slovenian, English, German, etc.)
  const currentLangCode = userProfile.language || 'auto';
  const chatRole = 'companion';
  const chatSpeed = 'general';
  const handsFreeMode = true;

  // Conversation & Wake-word State
  const [isAwake, setIsAwake] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(5);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [quotaNotice, setQuotaNotice] = useState(false);
  const [apiErrorNotice, setApiErrorNotice] = useState('');

  // Gemini 3.8 Live API Voice Session state + seamless Voice Turn fallback
  const [liveState, setLiveState] = useState<LiveConnectionState>('disconnected');
  const [liveSpeaking, setLiveSpeaking] = useState(false);
  const [liveQuotaUnavailable, setLiveQuotaUnavailable] = useState(false);
  const [liveAmplitude, setLiveAmplitude] = useState<{
    rms: number;
    bands: number[];
    db: number;
  } | null>(null);
  const liveInputBufferRef = useRef<string>('');
  const liveOutputBufferRef = useRef<string>('');

  // Gemini 3.5 Transcribe + Gemini 3.8 Flash TTS Voice Turn state
  const [isRecordingMemo, setIsRecordingMemo] = useState(false);
  const [isTranscribingMemo, setIsTranscribingMemo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Hardware Audio Manager States
  const [audioData, setAudioData] = useState<AudioFrequencyData>({
    db: 35,
    rms: 0.05,
    isVoice: false,
    bands: [8, 10, 12, 14, 16, 15, 12, 10, 12, 14, 15, 12, 10, 8, 6, 4],
  });

  // Touch Gesture states
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [gestureFeedback, setGestureFeedback] = useState<GestureFeedback | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const [transcript, setTranscript] = useState('');

  // Scrollable multi-turn chat thread
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text:
        userProfile.language === 'sl-SI'
          ? `Živjo ${userProfile.name}! Jaz sem Maya. Tapni Talk ali moj portret za naraven pogovor v živo, ali pa mi napiši sporočilo spodaj.`
          : `Hello ${userProfile.name}! I am Maya. Tap Talk or tap my portrait for natural real-time conversation, or message me below.`,
    },
  ]);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isAwakeRef = useRef<boolean>(false);
  const pendingQueryRef = useRef<string>('');
  const countdownIntervalRef = useRef<any>(null);
  const speechSilenceTimeoutRef = useRef<any>(null);

  const effectiveSpeaking = isSpeaking || liveSpeaking;
  const activeAudioMetrics = liveSpeaking && liveAmplitude ? liveAmplitude : audioData;

  useEffect(() => {
    isSpeakingRef.current = isSpeaking || liveState === 'connected';
  }, [isSpeaking, liveState]);

  useEffect(() => {
    isAwakeRef.current = isAwake;
  }, [isAwake]);

  // Keep scrollable chat pinned to newest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  // Preload Maya's photo
  useEffect(() => {
    const img = new Image();
    img.src = MAYA_SMILING_PHOTO;
  }, []);

  // Cleanup Live session on unmount
  useEffect(() => {
    return () => {
      liveVoiceClient.disconnect();
    };
  }, []);

  // Cleanly stop Maya speaking and return to standby
  const stopSpeaking = useCallback(() => {
    audioManager.stopSpeaking();
    setIsSpeaking(false);
    isSpeakingRef.current = false;

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (speechSilenceTimeoutRef.current) clearTimeout(speechSilenceTimeoutRef.current);
    setIsAwake(false);
    isAwakeRef.current = false;
    setTranscript('');
    pendingQueryRef.current = '';

    setGestureFeedback({
      title: 'Maya Paused',
      subtitle: 'Standby mode active',
      type: 'silenced',
    });
    setTimeout(() => setGestureFeedback(null), 1500);
  }, []);

  // Speak using the Gemini Emotive Human Voice (gemini-3.8-flash-lite-tts)
  const speakText = useCallback(
    (text: string, langHint?: string, onEndCallback?: () => void) => {
      if (!voiceEnabled || liveState === 'connected') {
        if (onEndCallback) onEndCallback();
        return;
      }

      audioManager.speakHuman(
        text,
        langHint || currentLangCode,
        () => {
          setIsSpeaking(true);
          isSpeakingRef.current = true;
        },
        () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          if (onEndCallback) onEndCallback();
        }
      );
    },
    [voiceEnabled, currentLangCode, liveState]
  );

  // Sub-30ms Instant Intent Dispatcher
  const handleInstantIntent = useCallback(
    (
      rawMessage: string
    ): { handled: boolean; reply?: string; lang?: string } => {
      const lower = rawMessage.toLowerCase().trim();

      if (
        lower === 'stop' ||
        lower === 'maya stop' ||
        lower === 'quiet' ||
        lower === 'be quiet' ||
        lower === 'shh' ||
        lower === 'silence' ||
        lower === 'pause' ||
        lower === 'stop talking' ||
        lower === 'maya tiho' ||
        lower === 'maja tiho' ||
        lower === 'maya pavza' ||
        lower === 'maja pavza' ||
        lower === 'ustavi se' ||
        lower === 'nehaj' ||
        lower === 'tišina' ||
        lower === 'dovolj' ||
        lower === 'maja ustavi' ||
        lower === 'maja nehaj' ||
        lower === 'maja dovolj'
      ) {
        stopSpeaking();
        return {
          handled: true,
          reply:
            currentLangCode === 'sl-SI'
              ? 'Prav, umirila sem se. Reci "Maya..." kadarkoli želiš nadaljevati.'
              : `I have paused. Say "Maya..." whenever you want to talk again.`,
          lang: currentLangCode === 'sl-SI' ? 'sl-SI' : 'en-US',
        };
      }

      if (
        lower.includes('can you hear me') ||
        lower.includes('do you hear me') ||
        lower.includes('are you listening') ||
        lower.includes('ali me slišiš') ||
        lower.includes('a me slišiš') ||
        lower.includes('slisis me') ||
        lower.includes('me slišiš') ||
        lower.includes('hörst du mich') ||
        lower.includes('hear me')
      ) {
        audioManager.playAcousticChime('test');
        if (lower.includes('slišiš') || lower.includes('slisis')) {
          return {
            handled: true,
            reply: `Seveda, ${userProfile.name}! Slišim te zelo lepo in razločno. Tukaj sem in pripravljena na pogovor!`,
            lang: 'sl-SI',
          };
        }
        if (lower.includes('hörst')) {
          return {
            handled: true,
            reply: `Ja, ${userProfile.name}! Ich höre dich laut und deutlich. Dein Mikrofon und Ton funktionieren einwandfrei!`,
            lang: 'de-DE',
          };
        }
        return {
          handled: true,
          reply: `Yes, ${userProfile.name}! I hear you loud and clear. My human voice and microphone are ready.`,
          lang: 'en-US',
        };
      }

      if (
        lower.startsWith('add task ') ||
        lower.startsWith('create task ') ||
        lower.startsWith('remind me to ') ||
        lower.startsWith('dodaj opravilo ') ||
        lower.startsWith('dodaj nalogo ') ||
        lower.startsWith('opomni me ')
      ) {
        const isSlTask =
          lower.startsWith('dodaj opravilo ') ||
          lower.startsWith('dodaj nalogo ') ||
          lower.startsWith('opomni me ');
        const taskTitle = rawMessage
          .replace(/^(add task|create task|remind me to|dodaj opravilo|dodaj nalogo|opomni me)\s+/i, '')
          .trim();
        if (taskTitle) {
          onAddTask({
            title: taskTitle,
            category: 'Focus',
            priority: 'medium',
            completed: false,
          });
          return {
            handled: true,
            reply: isSlTask
              ? `Dodala sem "${taskTitle}" na tvoj seznam opravil.`
              : `Added "${taskTitle}" to your tasks strip.`,
            lang: isSlTask ? 'sl-SI' : 'en-US',
          };
        }
      }

      const completeMatch =
        lower.match(/^(?:complete|finish|done|check off)\s+(?:task\s+)?(.+)/i) ||
        lower.match(/^(?:mark)\s+(.+)\s+(?:done|complete)/i);
      if (completeMatch && completeMatch[1] && onToggleTask) {
        const search = completeMatch[1].trim();
        const found = tasks.find(
          (t) => !t.completed && t.title.toLowerCase().includes(search)
        );
        if (found) {
          onToggleTask(found.id);
          return {
            handled: true,
            reply: `Great work! Marked "${found.title}" as completed.`,
          };
        }
      }

      const dismissMatch = lower.match(/^(?:delete|remove|dismiss)\s+(?:task\s+)?(.+)/i);
      if (dismissMatch && dismissMatch[1] && onDeleteTask) {
        const search = dismissMatch[1].trim();
        const found = tasks.find((t) => t.title.toLowerCase().includes(search));
        if (found) {
          onDeleteTask(found.id);
          return {
            handled: true,
            reply: `Removed "${found.title}" from your tasks.`,
          };
        }
      }

      if (
        lower === 'what is the time' ||
        lower === "what's the time" ||
        lower === 'what time is it' ||
        lower === 'kolk je ura' ||
        lower === 'koliko je ura' ||
        lower === 'katera ura je'
      ) {
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (lower.includes('ura')) {
          return { handled: true, reply: `Trenutno je ${nowStr}.`, lang: 'sl-SI' };
        }
        return { handled: true, reply: `It is currently ${nowStr}.`, lang: 'en-US' };
      }

      if (
        lower === 'how is the weather' ||
        lower === "what's the weather" ||
        lower === 'kakšno je vreme' ||
        lower === 'kaksno je vreme' ||
        lower === 'kakšno je vreme?' ||
        lower === 'vreme' ||
        lower === 'maya, how is the weather?'
      ) {
        if (lower.includes('vreme')) {
          return {
            handled: true,
            reply: `V kraju ${location.city} je trenutno ${weather.temp}°C, ${weather.condition}, najvišja dnevna pa bo ${weather.high}°C.`,
            lang: 'sl-SI',
          };
        }
        return {
          handled: true,
          reply: `It is currently ${weather.temp}°C and ${weather.condition} in ${location.city}, with a high of ${weather.high}°C.`,
          lang: 'en-US',
        };
      }

      if (
        lower === 'what are my tasks' ||
        lower === 'read my tasks' ||
        lower === 'list tasks' ||
        lower === 'maya, what are my tasks?' ||
        lower === 'katera so moja opravila' ||
        lower === 'katera so moja opravila?' ||
        lower === 'moje naloge' ||
        lower === 'kaj moram narediti'
      ) {
        const isSl =
          lower.includes('opravila') || lower.includes('naloge') || lower.includes('narediti');
        const pending = tasks.filter((t) => !t.completed);
        if (pending.length === 0) {
          return {
            handled: true,
            reply: isSl
              ? `Vsa današnja opravila si že uspešno zaključil, ${userProfile.name}!`
              : `You have completed all your tasks for today, ${userProfile.name}.`,
            lang: isSl ? 'sl-SI' : 'en-US',
          };
        }
        const topTitles = pending
          .slice(0, 3)
          .map((t) => t.title)
          .join(', ');
        return {
          handled: true,
          reply: isSl
            ? `Imaš še ${pending.length} odprtih opravil. Naslednja na vrsti so: ${topTitles}.`
            : `You have ${pending.length} pending tasks. Next up: ${topTitles}.`,
          lang: isSl ? 'sl-SI' : 'en-US',
        };
      }

      if (
        lower === 'what is on my schedule' ||
        lower === "what's my schedule" ||
        lower === 'read my schedule' ||
        lower === "maya, what's my schedule?" ||
        lower === 'kaj je na mojem urniku' ||
        lower === 'kaj je na mojem urniku?' ||
        lower === 'moj urnik' ||
        lower === 'kakšen je moj urnik'
      ) {
        const isSl = lower.includes('urnik');
        const upcoming = schedule.filter((s) => !s.completed);
        if (upcoming.length === 0) {
          return {
            handled: true,
            reply: isSl
              ? `Tvoj urnik je za preostanek dneva povsem prost, ${userProfile.name}.`
              : `Your schedule is clear for the rest of the day, ${userProfile.name}.`,
            lang: isSl ? 'sl-SI' : 'en-US',
          };
        }
        const nextItem = upcoming[0];
        return {
          handled: true,
          reply: isSl
            ? `Naslednje na tvojem urniku je ${nextItem.title} ob ${nextItem.time} (${nextItem.duration}).`
            : `Next on your schedule is ${nextItem.title} at ${nextItem.time} for ${nextItem.duration}.`,
          lang: isSl ? 'sl-SI' : 'en-US',
        };
      }

      return { handled: false };
    },
    [
      userProfile.name,
      weather,
      location.city,
      tasks,
      schedule,
      onAddTask,
      onToggleTask,
      onDeleteTask,
      stopSpeaking,
    ]
  );

  // Send multi-turn message to Gemini (/api/chat)
  const sendMessage = useCallback(
    async (textToSend?: string) => {
      audioManager.unlockAudioContext();
      const message = (textToSend || inputText).trim();
      if (!message || isLoading) return;

      setInputText('');
      setTranscript('');
      pendingQueryRef.current = '';

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        sender: 'user',
        text: message,
      };

      const updatedHistory = [...chatHistory, userMsg];
      setChatHistory(updatedHistory);
      conversationStorage.addEntry({
        sender: 'user',
        text: message,
        language: currentLangCode,
      });

      const detectedName = tabletVoiceSensor.detectNameInText(message);
      if (detectedName && detectedName !== userProfile.name) {
        const updated = { ...userProfile, name: detectedName };
        onUpdateProfile(updated);
        tabletVoiceSensor.saveProfile(updated);
      }

      // If Gemini 3.8 Live Voice is active, send typed/quick prompts straight into the live human voice session
      if (liveState === 'connected' && liveVoiceClient.sendText(message)) {
        return;
      }

      const instantResult = handleInstantIntent(message);
      if (instantResult.handled) {
        if (instantResult.reply) {
          conversationStorage.addEntry({
            sender: 'assistant',
            text: instantResult.reply,
            language: instantResult.lang || currentLangCode,
          });
          setChatHistory((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              sender: 'assistant',
              text: instantResult.reply!,
              lang: instantResult.lang,
            },
          ]);
          if (voiceEnabled) {
            speakText(instantResult.reply, instantResult.lang);
          }
        }
        return;
      }

      setIsLoading(true);
      setApiErrorNotice('');

      try {
        const now = new Date();
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            chatRole,
            chatSpeed,
            history: chatHistory.map((m) => ({ sender: m.sender, text: m.text })),
            userProfile: {
              name: userProfile.name,
              vocalRange: userProfile.vocalRange,
              preferences: userProfile.preferences,
              language: currentLangCode,
            },
            userContext: {
              location: location.city,
              time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              date: now.toLocaleDateString([], {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              }),
              weather: `${weather.temp}°C, ${weather.condition}`,
              tasks: tasks
                .slice(0, 5)
                .map((t) => `${t.title} (${t.completed ? 'Done' : 'Pending'})`),
              schedule: schedule.slice(0, 5).map((s) => `${s.time} - ${s.title}`),
            },
          }),
        });

        const data = await res.json();
        if (!res.ok && !data?.reply) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }

        const reply =
          data.reply ||
          (currentLangCode === 'sl-SI'
            ? `Tukaj sem, ${userProfile.name}. O čem bi se pogovorila?`
            : `I'm right here, ${userProfile.name}. What would you like to talk about?`);
        const detectedLang = data.detectedLang;
        const sources: Array<{ title: string; url: string }> = data.sources || [];
        setQuotaNotice(Boolean(data.quotaExceeded));
        setApiErrorNotice(data.apiError ? data.errorDetail || 'Gemini connection issue' : '');

        conversationStorage.addEntry({
          sender: 'assistant',
          text: reply,
          language: detectedLang || currentLangCode,
          sources,
          engine: data.engine,
        });

        setChatHistory((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: reply,
            lang: detectedLang,
            sources,
            engine: data.engine,
          },
        ]);

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
          speakText(reply, detectedLang);
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Unable to reach Maya server';
        setApiErrorNotice(errMsg);
        const errorReply =
          currentLangCode === 'sl-SI'
            ? `Trenutno ni povezave s strežnikom (${errMsg}). Preveri Wi-Fi povezavo in poskusi znova.`
            : `I couldn't reach Maya's server right now (${errMsg}). Please check your connection and try again.`;
        conversationStorage.addEntry({
          sender: 'assistant',
          text: errorReply,
          language: currentLangCode,
        });
        setChatHistory((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, sender: 'assistant', text: errorReply },
        ]);
        if (voiceEnabled) speakText(errorReply, currentLangCode);
      } finally {
        setIsLoading(false);
      }
    },
    [
      inputText,
      isLoading,
      chatHistory,
      chatRole,
      chatSpeed,
      userProfile,
      onUpdateProfile,
      handleInstantIntent,
      voiceEnabled,
      speakText,
      location.city,
      weather.temp,
      weather.condition,
      tasks,
      schedule,
      onAddTask,
      onAddEvent,
      currentLangCode,
      liveState,
    ]
  );

  // Toggle Real-Time Gemini 3.8 Live API Voice Conversation
  const toggleLiveVoice = useCallback(async () => {
    if (liveState === 'connected' || liveState === 'connecting') {
      liveVoiceClient.disconnect();
      setLiveSpeaking(false);
      setLiveAmplitude(null);
      return;
    }

    // Pause Web SpeechRecognition & TTS while Live API owns audio
    audioManager.stopSpeaking();
    audioManager.stopRecognition();
    liveInputBufferRef.current = '';
    liveOutputBufferRef.current = '';
    setApiErrorNotice('');

    await liveVoiceClient.connect(
      {
        userName: userProfile.name,
        lang: currentLangCode,
        mode: chatSpeed,
        city: location.city,
        weather: `${weather.temp}°C, ${weather.condition}`,
      },
      {
        onStateChange: (state) => {
          setLiveState(state);
          if (state === 'disconnected' && handsFreeMode && audioManager.getMicStatus() === 'active') {
            setTimeout(() => audioManager.startRecognition(), 400);
          }
        },
        onSpeakingChange: (speaking) => {
          setLiveSpeaking(speaking);
        },
        onAudioAmplitude: (rms, bands, db) => {
          setLiveAmplitude({ rms, bands, db });
        },
        onInputTranscript: (text) => {
          liveInputBufferRef.current += text;
          setTranscript(liveInputBufferRef.current.trim());
        },
        onOutputTranscript: (text) => {
          liveOutputBufferRef.current += text;
        },
        onTurnComplete: () => {
          const userSaid = liveInputBufferRef.current.trim();
          const mayaSaid = liveOutputBufferRef.current.trim();
          liveInputBufferRef.current = '';
          liveOutputBufferRef.current = '';
          setTranscript('');

          if (userSaid) {
            conversationStorage.addEntry({
              sender: 'user',
              text: userSaid,
              language: currentLangCode,
              engine: 'gemini-3.8-live',
            });
            setChatHistory((prev) => [
              ...prev,
              { id: `lu-${Date.now()}`, sender: 'user', text: userSaid },
            ]);
          }
          if (mayaSaid) {
            conversationStorage.addEntry({
              sender: 'assistant',
              text: mayaSaid,
              language: currentLangCode,
              engine: 'gemini-3.8-live',
            });
            setChatHistory((prev) => [
              ...prev,
              {
                id: `la-${Date.now() + 1}`,
                sender: 'assistant',
                text: mayaSaid,
                engine: 'gemini-3.8-live',
              },
            ]);
          }
        },
        onError: (msg) => {
          const isLiveQuota = /quota|billing|RESOURCE_EXHAUSTED|exceeded/i.test(msg);
          if (isLiveQuota) {
            setLiveQuotaUnavailable(true);
          }
          setApiErrorNotice(msg);
          setGestureFeedback({
            title: isLiveQuota ? 'Switched to Voice Turn' : 'Live Voice Notice',
            subtitle: isLiveQuota
              ? 'Tap Talk anytime to speak naturally with Maya.'
              : msg,
            type: 'silenced',
          });
          setTimeout(() => setGestureFeedback(null), 3200);
        },
      }
    );
  }, [
    liveState,
    userProfile.name,
    currentLangCode,
    chatSpeed,
    location.city,
    weather.temp,
    weather.condition,
    handsFreeMode,
  ]);

  // Toggle Voice Memo Recording + Gemini 3.5 Transcribe
  const toggleTranscribeMemo = useCallback(async () => {
    if (isRecordingMemo && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingMemo(false);
      return;
    }

    try {
      audioManager.stopRecognition();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size < 400) return;

        setIsTranscribingMemo(true);
        try {
          const reader = new FileReader();
          const base64: string = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
              const result = String(reader.result || '');
              resolve(result.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              mimeType: blob.type || 'audio/webm',
              lang: currentLangCode,
            }),
          });

          const data = await res.json();
          if (data.success && data.transcript) {
            sendMessage(data.transcript);
          } else {
            setGestureFeedback({
              title: 'Transcription Notice',
              subtitle: 'No speech detected in recording.',
              type: 'silenced',
            });
            setTimeout(() => setGestureFeedback(null), 2200);
          }
        } catch {
          setGestureFeedback({
            title: 'Transcription Unavailable',
            subtitle: 'Please try speaking or typing again.',
            type: 'silenced',
          });
          setTimeout(() => setGestureFeedback(null), 2200);
        } finally {
          setIsTranscribingMemo(false);
          if (handsFreeMode && audioManager.getMicStatus() === 'active') {
            setTimeout(() => audioManager.startRecognition(), 300);
          }
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingMemo(true);
    } catch {
      setGestureFeedback({
        title: 'Microphone Required',
        subtitle: 'Allow microphone access to record audio.',
        type: 'silenced',
      });
      setTimeout(() => setGestureFeedback(null), 2400);
    }
  }, [isRecordingMemo, handsFreeMode, sendMessage, currentLangCode]);

  // SPEECH RECOGNITION & 5-SECOND SILENCE LISTENER
  useEffect(() => {
    audioManager.setLanguage(currentLangCode);
    audioManager.setHandsFree(handsFreeMode);

    const unsubAudio = audioManager.subscribeAudioData((data) => {
      setAudioData(data);
    });

    const unsubTranscript = audioManager.subscribeTranscript((text, isFinal) => {
      if (isSpeakingRef.current || liveState === 'connected') return;

      const lower = text.toLowerCase().trim();

      if (
        lower === 'stop' ||
        lower.startsWith('maya stop') ||
        lower.startsWith('stop talking') ||
        lower.startsWith('maya tiho') ||
        lower.startsWith('maya pavza')
      ) {
        stopSpeaking();
        return;
      }

      const WAKE_START_REGEX =
        /^\s*(?:hey|hi|ok|hello|zdravo|živjo|zivjo|hej|oj|halo|aloha|poslušaj)?\s*(?:maya|maja|maia|mya|majo|maji|may\s*i)\b[\s,.:;!-]*(.*)/i;
      const WAKE_CONTAINS_REGEX = /(?:^|\b)(?:maya|maja|maia|mya|majo|maji)\b[\s,.:;!-]*(.*)/i;

      if (!isAwakeRef.current) {
        const match = text.match(WAKE_START_REGEX) || text.match(WAKE_CONTAINS_REGEX);
        if (match) {
          audioManager.playAcousticChime('wake');
          setIsAwake(true);
          isAwakeRef.current = true;
          setSecondsRemaining(5);

          const queryAfterWake = match[1] ? match[1].trim() : '';
          pendingQueryRef.current = queryAfterWake;
          setTranscript(queryAfterWake || 'Maya');

          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = setInterval(() => {
            setSecondsRemaining((prev) => {
              if (prev <= 1) {
                clearInterval(countdownIntervalRef.current);
                const queryToSend = pendingQueryRef.current.trim();
                setIsAwake(false);
                isAwakeRef.current = false;
                if (queryToSend.length > 1) {
                  sendMessage(queryToSend);
                }
                return 5;
              }
              return prev - 1;
            });
          }, 1000);

          if (queryAfterWake.length > 1) {
            if (speechSilenceTimeoutRef.current) clearTimeout(speechSilenceTimeoutRef.current);
            speechSilenceTimeoutRef.current = setTimeout(() => {
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              setIsAwake(false);
              isAwakeRef.current = false;
              setSecondsRemaining(5);
              sendMessage(queryAfterWake);
            }, 1200);
          } else {
            const wakeAcknowledge =
              currentLangCode === 'sl-SI'
                ? `Ja, ${userProfile.name}? Poslušam te!`
                : currentLangCode === 'de-DE'
                ? `Ja, ${userProfile.name}? Ich höre zu!`
                : `Yes, ${userProfile.name}? I'm listening!`;
            setChatHistory((prev) => [
              ...prev,
              { id: `w-${Date.now()}`, sender: 'assistant', text: wakeAcknowledge },
            ]);
            speakText(wakeAcknowledge, currentLangCode);
          }
          return;
        } else {
          return;
        }
      }

      const cleanText = text
        .replace(/^\s*(?:hey\s+|ok\s+|hi\s+|zdravo\s+)?maya\b[\s,.:;!]*/i, '')
        .trim();
      pendingQueryRef.current = cleanText;
      setTranscript(cleanText || text);
      setSecondsRemaining(5);

      if (speechSilenceTimeoutRef.current) {
        clearTimeout(speechSilenceTimeoutRef.current);
      }

      if (isFinal) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setIsAwake(false);
        isAwakeRef.current = false;
        setSecondsRemaining(5);
        if (cleanText.length > 1) {
          sendMessage(cleanText);
        }
      } else {
        speechSilenceTimeoutRef.current = setTimeout(() => {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          setIsAwake(false);
          isAwakeRef.current = false;
          setSecondsRemaining(5);
          if (cleanText && cleanText.length > 1 && !isSpeakingRef.current) {
            sendMessage(cleanText);
          }
        }, 1300);
      }
    });

    return () => {
      unsubAudio();
      unsubTranscript();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (speechSilenceTimeoutRef.current) clearTimeout(speechSilenceTimeoutRef.current);
    };
  }, [handsFreeMode, currentLangCode, sendMessage, speakText, stopSpeaking, userProfile.name, liveState]);

  // Unified primary Talk handler: uses Gemini 3.8 Live voice when available, or seamless Voice Turn recording
  const handlePrimaryTalk = useCallback(() => {
    audioManager.unlockAudioContext();
    if (isSpeaking) {
      stopSpeaking();
      return;
    }
    if (isRecordingMemo || liveQuotaUnavailable) {
      toggleTranscribeMemo();
      return;
    }
    toggleLiveVoice();
  }, [isSpeaking, isRecordingMemo, liveQuotaUnavailable, stopSpeaking, toggleTranscribeMemo, toggleLiveVoice]);

  // Touch & Swipe Gestures
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartRef.current = { x: clientX, y: clientY, time: Date.now() };
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartRef.current || !isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const diffX = clientX - touchStartRef.current.x;
    const diffY = clientY - touchStartRef.current.y;
    setDragOffset({
      x: Math.max(-50, Math.min(50, diffX * 0.35)),
      y: Math.max(-35, Math.min(35, diffY * 0.35)),
    });
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) {
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      return;
    }

    const { time: startTime } = touchStartRef.current;
    const duration = Date.now() - startTime;
    const diffX = dragOffset.x * 2.8;
    const diffY = dragOffset.y * 2.8;

    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    touchStartRef.current = null;

    if (duration < 380 && Math.hypot(diffX, diffY) < 16) {
      handlePrimaryTalk();
      return;
    }

    if (diffX < -35 && Math.abs(diffX) > Math.abs(diffY)) {
      const pendingTask = tasks.find((t) => !t.completed);
      if (pendingTask) {
        if (onDeleteTask) onDeleteTask(pendingTask.id);
        else if (onToggleTask) onToggleTask(pendingTask.id);
        setGestureFeedback({
          title: 'Dismissed Task',
          subtitle: pendingTask.title,
          type: 'dismiss',
        });
        setTimeout(() => setGestureFeedback(null), 2000);
        if (voiceEnabled) speakText(`Dismissed ${pendingTask.title} for you.`);
      }
      return;
    }

    if (diffX > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      const pendingTask = tasks.find((t) => !t.completed);
      if (pendingTask) {
        if (onToggleTask) onToggleTask(pendingTask.id);
        setGestureFeedback({
          title: 'Task Completed',
          subtitle: pendingTask.title,
          type: 'complete',
        });
        setTimeout(() => setGestureFeedback(null), 2000);
        if (voiceEnabled) speakText(`Great job completing ${pendingTask.title}, ${userProfile.name}!`);
      }
      return;
    }

    if (diffY > 35 && Math.abs(diffY) > Math.abs(diffX)) {
      stopSpeaking();
      return;
    }
  };

  const quickPrompts =
    currentLangCode === 'sl-SI'
      ? ['Katere so današnje novice?', 'Kakšno je vreme?', 'Kaj je na urniku?']
      : [`What's today's news?`, 'How is the weather?', `What's on my schedule?`];

  return (
    <div
      className={`relative min-h-[540px] md:min-h-0 h-full flex flex-col rounded-2xl overflow-hidden border transition-all duration-300 ${
        isNightDim
          ? 'bg-slate-950/90 border-amber-950/40 text-amber-100/80'
          : 'bg-slate-900/65 border-slate-800/70 text-slate-100 backdrop-blur-md'
      }`}
    >
      {/* Clean Minimal Top Bar (No Companion dropdown, No Language dropdown, No Settings clutter) */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-950/50 border-b border-slate-800/60 shrink-0 z-20">
        <button
          onClick={onOpenProfileModal}
          className="flex items-center gap-2 text-left hover:opacity-85 transition-opacity cursor-pointer min-w-0"
          title="Edit Profile & Location"
        >
          <span className="text-sm font-semibold text-white font-display">Maya</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-xs text-slate-400 truncate max-w-[110px]">
            {userProfile.name}
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsLogsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Saved Conversation History"
          >
            <History className="w-3.5 h-3.5 text-sky-400" />
            <span>History</span>
          </button>

          <button
            onClick={() => {
              if (isSpeaking) stopSpeaking();
              setVoiceEnabled(!voiceEnabled);
            }}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              voiceEnabled
                ? 'text-sky-300 hover:bg-slate-800/80'
                : 'text-slate-500 hover:bg-slate-800/80'
            }`}
            title={voiceEnabled ? 'Mute Maya voice' : 'Unmute Maya voice'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* MAYA SMILING PORTRAIT FRAME (CLEAN, UNOBSTRUCTED FACE) */}
      <div
        className={`relative w-full overflow-hidden bg-slate-950 flex items-center justify-center select-none cursor-pointer touch-pan-y shrink-0 transition-all duration-300 border-b ${
          layoutMode === 'clock'
            ? 'h-[235px] sm:h-[265px]'
            : 'h-[205px] sm:h-[235px]'
        } ${effectiveSpeaking || isRecordingMemo ? 'border-sky-500/60' : 'border-slate-800/70'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        style={{
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <img
          src={MAYA_SMILING_PHOTO}
          alt="Maya smiling"
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover object-[center_28%] transition-transform duration-500 pointer-events-none ${
            effectiveSpeaking ? 'scale-[1.018] animate-companion-breathe' : 'animate-companion-breathe'
          }`}
        />

        {/* Measured edge gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/15 pointer-events-none" />

        {/* Live Session / Speaking / Recording Indicator */}
        {(liveState === 'connected' || isSpeaking || isRecordingMemo) && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/85 border border-sky-400/40 backdrop-blur-md">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isRecordingMemo ? 'bg-rose-400' : 'bg-emerald-400'
              }`}
            />
            <span className="text-xs font-medium text-slate-100">
              {liveState === 'connected'
                ? 'Live Voice Active'
                : isRecordingMemo
                ? 'Listening — tap to send'
                : 'Maya Speaking'}
            </span>
          </div>
        )}

        {/* Stop Speaking Button */}
        {isSpeaking && liveState !== 'connected' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              stopSpeaking();
            }}
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/95 hover:bg-rose-500 text-white font-medium text-xs shadow-lg cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
          </button>
        )}

        {/* Dynamic Sound Visualizer */}
        {effectiveSpeaking && (
          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-center pointer-events-none">
            <div className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-2xl bg-slate-950/85 border border-sky-400/35 backdrop-blur-md">
              {Array.from({ length: 20 }).map((_, i) => {
                const distFromCenter = Math.abs(i - 9.5);
                const bandIndex = Math.min(15, Math.floor((1 - distFromCenter / 10) * 15));
                const rawBand = activeAudioMetrics.bands[bandIndex] || 15;
                const centerWeight = 1 - (distFromCenter / 11) * 0.42;
                const dynamicHeight = Math.max(
                  5,
                  Math.min(38, Math.round((rawBand * 0.34 + activeAudioMetrics.rms * 28) * centerWeight))
                );
                const hueStop = Math.round(170 + (i / 19) * 125);

                return (
                  <div
                    key={i}
                    className="flex items-center justify-center"
                    style={{ height: '40px' }}
                  >
                    <div
                      className="w-1 sm:w-1.5 rounded-full transition-all duration-75 ease-out"
                      style={{
                        height: `${dynamicHeight}px`,
                        background: `linear-gradient(to top, hsl(${hueStop}, 85%, 55%), hsl(${hueStop + 25}, 92%, 68%))`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gesture Feedback Overlay */}
        {gestureFeedback && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 pointer-events-none">
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-700 text-slate-100 shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
              {gestureFeedback.type === 'dismiss' && <Trash2 className="w-4 h-4 text-rose-400" />}
              {gestureFeedback.type === 'complete' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {gestureFeedback.type === 'diagnostic' && <Activity className="w-4 h-4 text-sky-400" />}
              {(gestureFeedback.type === 'greet' || gestureFeedback.type === 'wish' || gestureFeedback.type === 'silenced') && (
                <Sparkles className="w-4 h-4 text-sky-400" />
              )}
              <div>
                <div className="text-xs font-semibold">{gestureFeedback.title}</div>
                <div className="text-[11px] text-slate-300">{gestureFeedback.subtitle}</div>
              </div>
            </div>
          </div>
        )}

        {/* Quiet Portrait Caption when Idle (Zero loud overlay buttons blocking Maya's face) */}
        {!effectiveSpeaking && !transcript && !isAwake && !isRecordingMemo && liveState === 'disconnected' && (
          <div className="absolute bottom-2.5 inset-x-0 z-10 flex justify-center pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-slate-950/65 text-[11px] text-slate-200/90 backdrop-blur-sm">
              Tap portrait or Talk below
            </span>
          </div>
        )}

        {/* Live Transcript Ticker */}
        {!effectiveSpeaking && (transcript || isAwake) && (
          <div className="absolute bottom-2.5 left-3 right-3 z-20 pointer-events-none">
            <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-emerald-500/40 text-center backdrop-blur-md">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-emerald-300">
                <Timer className="w-3 h-3" />
                <span>
                  {liveState === 'connected'
                    ? 'Listening'
                    : `Answering in ${secondsRemaining}s`}
                </span>
              </div>
              {transcript && (
                <p className="text-xs font-medium text-white truncate mt-0.5">&ldquo;{transcript}&rdquo;</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SPACIOUS MULTI-TURN CHAT THREAD & CLEAN CONTROLS */}
      <div className="p-3.5 bg-slate-950/60 flex flex-col gap-2.5 flex-1 min-h-0">
        {(quotaNotice || apiErrorNotice) && (
          <div className="text-[11px] text-amber-300/95 px-1 truncate shrink-0" title={apiErrorNotice}>
            {apiErrorNotice || 'API quota notice — check Settings > Secrets'}
          </div>
        )}

        {/* Scrollable Multi-Turn Conversation Thread */}
        <div
          ref={chatScrollRef}
          className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1"
        >
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-sky-600/20 border border-sky-500/30 text-slate-100'
                    : 'bg-slate-900/85 border border-slate-800/80 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span
                    className={`text-[11px] font-medium ${
                      msg.sender === 'user' ? 'text-sky-300' : 'text-emerald-300'
                    }`}
                  >
                    {msg.sender === 'user' ? userProfile.name : 'Maya'}
                  </span>
                  {msg.sender === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => speakText(msg.text, msg.lang)}
                      className="text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                      title="Play aloud"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="select-text whitespace-pre-wrap">{msg.text}</p>

                {/* Optional quiet disclosure for saved web links (never read aloud) */}
                {msg.sources && msg.sources.length > 0 && (
                  <details className="mt-2 pt-1.5 border-t border-slate-800/70">
                    <summary className="list-none flex items-center gap-1 text-[10px] text-slate-400 hover:text-sky-300 cursor-pointer select-none">
                      <Globe className="w-3 h-3" />
                      <span>Links ({Math.min(3, msg.sources.length)})</span>
                    </summary>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {msg.sources.slice(0, 3).map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-slate-300 hover:text-white underline truncate max-w-[200px]"
                        >
                          <span className="truncate">{src.title || 'Article'}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start">
              <div className="px-3.5 py-2 rounded-2xl bg-slate-900/85 border border-slate-800 text-xs text-sky-300 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* 3 Clean Quick Suggestions */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 shrink-0">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="px-3 py-1.5 text-[11px] rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-slate-300 hover:text-white whitespace-nowrap transition-colors shrink-0 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Clean 3-Control Input Row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={handlePrimaryTalk}
            disabled={isTranscribingMemo}
            className={`px-3.5 min-h-[42px] rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer font-medium text-xs ${
              liveState === 'connected'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : isRecordingMemo
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : liveState === 'connecting' || isTranscribingMemo
                ? 'bg-amber-600/80 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700/80'
            }`}
            title="Talk naturally with Maya"
          >
            {liveState === 'connecting' || isTranscribingMemo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : liveState === 'connected' || isRecordingMemo ? (
              <Square className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            <span className="text-xs whitespace-nowrap">
              {liveState === 'connected'
                ? 'End'
                : isRecordingMemo
                ? 'Send Voice'
                : liveState === 'connecting'
                ? 'Connecting'
                : isTranscribingMemo
                ? 'Listening'
                : 'Talk'}
            </span>
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message Maya..."
            disabled={isLoading}
            className="flex-1 min-w-0 min-h-[42px] px-3.5 text-xs bg-slate-900/90 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Conversation Logs Modal */}
      <ConversationLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        isNightDim={isNightDim}
      />
    </div>
  );
};
