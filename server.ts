import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality, ThinkingLevel } from '@google/genai';
import type { LiveServerMessage } from '@google/genai';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize GoogleGenAI SDK server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.get('/api/health', (_req: Request, res: Response) => {
  return res.json({ status: 'ok', assistant: 'Maya', tabletKiosk: true });
});

// Local Wi-Fi LAN discovery helper so phones/tablets on the same Wi-Fi see the local address
app.get('/api/network-info', (_req: Request, res: Response) => {
  const interfaces = os.networkInterfaces();
  const lanUrls: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        !iface.address.startsWith('169.254.')
      ) {
        lanUrls.push(`http://${iface.address}:${PORT}`);
      }
    }
  }
  return res.json({ port: PORT, lanUrls });
});

// Proxy reverse geocoding to prevent browser CORS/403 issues with Nominatim
app.get('/api/reverse-geocode', async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon required' });
    }
    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      {
        headers: {
          'User-Agent': 'AuraMayaAssistant/1.0 (contact: assistant@maya.local)',
          'Accept-Language': 'en',
        },
      }
    );
    if (!osmRes.ok) {
      return res.json({ city: 'Local Tablet' });
    }
    const data: any = await osmRes.json();
    const firstPart = data.display_name?.split(',')?.[0]?.trim();
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.municipality ||
      data.address?.village ||
      data.address?.county ||
      firstPart ||
      data.address?.state ||
      'Local Tablet';
    return res.json({ city, fullAddress: data.display_name });
  } catch {
    return res.json({ city: 'Local Tablet' });
  }
});

// Audio Transcription endpoint powered by Gemini 3.5 Transcribe
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', lang = 'auto' } = req.body;
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Audio data is required' });
    }

    const audioPart = {
      inlineData: {
        mimeType,
        data: audioBase64,
      },
    };

    const langHint =
      lang && lang.startsWith('sl')
        ? 'The speaker is likely speaking Slovenian (slovenščina). Preserve Slovenian diacritics (č, š, ž) accurately.'
        : 'Detect the spoken language automatically (including Slovenian with č, š, ž, English, German, Croatian, etc.).';

    const transcribeCall = ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          {
            text: `Transcribe the spoken audio accurately in its original language. ${langHint} Return only the spoken words without extra commentary or formatting.`,
          },
        ],
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TRANSCRIBE_TIMEOUT')), 18000)
    );

    const response = await Promise.race([transcribeCall, timeoutPromise]);
    const transcript = (response.text || '').trim();

    return res.json({
      success: Boolean(transcript),
      transcript,
      model: 'gemini-3.5-transcribe',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Transcription failed',
    });
  }
});

// Human-quality AI voice synthesis endpoint powered by Gemini TTS with emotive speech styling
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, style: customStyle, voice = 'Kore', lang } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const cleanText = text
      .replace(/```action[\s\S]*?```/g, '')
      .replace(/[*#_~`\[\]]/g, '')
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ''
      )
      .trim();

    if (!cleanText) {
      return res.json({ success: false, error: 'Empty text' });
    }

    // Infer emotional tone and prosodic style for natural human delivery
    let emotiveStyle = customStyle;
    const isSlovenianAudio =
      (lang && lang.startsWith('sl')) ||
      /[čšžđć]|danes|vreme|kako|hvala|prosim|živjo|slišim|dobro|jutro|večer|opravil|urnik|novice/i.test(
        cleanText
      );

    if (!emotiveStyle) {
      const lower = cleanText.toLowerCase();
      if (isSlovenianAudio) {
        emotiveStyle =
          'Warm, affectionate, natural female Slovenian companion speaking fluent, authentic everyday Slovenian with clear native pronunciation and gentle warmth';
      } else if (/news|novic|nachricht|headline|breaking|today's|world|story|dogaj/i.test(lower)) {
        emotiveStyle = 'Clear, engaging, articulate news anchor with natural cadence and warm tone';
      } else if (/wish|peace|calm|quiet|breathe|serene|rest|meditat|želja|mir|lahko noč/i.test(lower)) {
        emotiveStyle = 'Soft, gentle, peaceful companion voice with warm, caring inflection';
      } else if (/task|schedule|todo|opravil|urnik|event|calendar|časovnica/i.test(lower)) {
        emotiveStyle = 'Encouraging, clear, articulate companion voice with natural conversational cadence';
      } else if (/[äöüß]|guten|morgen|wetter|aufgabe|schön|danke|bitte/i.test(cleanText) || (lang && lang.startsWith('de'))) {
        emotiveStyle = 'Warm, natural, emotionally expressive companion voice with authentic German pronunciation';
      } else {
        emotiveStyle = 'Warm, expressive, emotionally intelligent human female companion voice with gentle empathy and natural smiles';
      }
    }

    // Lock to female persona ('Kore' is warm and conversational)
    const voiceName = voice === 'Zephyr' ? 'Zephyr' : 'Kore';

    const buildTtsCall = (modelName: 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts') =>
      ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: emotiveStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TTS_TIMEOUT')), 18000)
    );

    let response;
    let ttsModelUsed = 'gemini-3.8-flash-tts';
    try {
      response = await Promise.race([buildTtsCall('gemini-3.8-flash-tts'), timeoutPromise]);
    } catch {
      ttsModelUsed = 'gemini-3.8-flash-lite-tts';
      response = await Promise.race([buildTtsCall('gemini-3.8-flash-lite-tts'), timeoutPromise]);
    }

    const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);

    if (part?.inlineData?.data) {
      return res.json({
        success: true,
        audio: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'audio/wav',
        style: emotiveStyle,
        voice: voiceName,
        model: ttsModelUsed,
      });
    }

    return res.json({ success: false, error: 'No audio returned' });
  } catch {
    // Graceful fallback to client device speech synthesis on rate limit / offline
    return res.json({ success: false, error: 'TTS fallback to device synthesis' });
  }
});

// Helper to fetch live real-time internet news headlines from open news feeds
async function fetchLiveInternetNews(
  lang: string = 'en-US'
): Promise<{ headlines: string[]; sources: Array<{ title: string; url: string }> }> {
  try {
    let rssUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
    if (lang.startsWith('sl')) {
      rssUrl = 'https://news.google.com/rss?hl=sl&gl=SI&ceid=SI:sl';
    } else if (lang.startsWith('de')) {
      rssUrl = 'https://news.google.com/rss?hl=de&gl=DE&ceid=DE:de';
    } else if (lang.startsWith('es')) {
      rssUrl = 'https://news.google.com/rss?hl=es&gl=ES&ceid=ES:es';
    } else if (lang.startsWith('fr')) {
      rssUrl = 'https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr';
    } else if (lang.startsWith('it')) {
      rssUrl = 'https://news.google.com/rss?hl=it&gl=IT&ceid=IT:it';
    }

    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });
    if (!res.ok) return { headlines: [], sources: [] };
    const xml = await res.text();

    const items: Array<{ title: string; url: string }> = [];
    const itemMatches = xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<\/item>/g);
    for (const match of itemMatches) {
      let rawTitle = match[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim();
      rawTitle = rawTitle.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      const rawLink = match[2]?.trim();
      if (rawTitle && !rawTitle.includes('Google News')) {
        items.push({ title: rawTitle, url: rawLink });
      }
      if (items.length >= 5) break;
    }

    return {
      headlines: items.map((i) => i.title),
      sources: items.map((i) => ({ title: i.title, url: i.url })),
    };
  } catch {
    return { headlines: [], sources: [] };
  }
}

const ROLE_INSTRUCTIONS: Record<string, string> = {
  companion:
    'You are Maya, an articulate, warmly expressive, emotionally intelligent life companion and personal assistant. Speak naturally as a trusted friend sharing the room.',
  research:
    'You are Maya in Research & News Briefing mode. Use live Google Search grounding to verify real-time facts, current world news, weather, and answers, and present clear insights with your thoughtful reflection.',
  coach:
    'You are Maya in Focus & Routine Coach mode. Help organize priorities calmly, suggest realistic next steps, encourage steady progress without pressure, and offer brief mindfulness prompts.',
  tutor:
    'You are Maya in Natural Language Tutor mode. Converse warmly in the target language, gently explain idioms or grammar if asked, and encourage confident natural expression.',
};

// Multi-turn chatbot endpoint powered by Gemini 4 Hydrogen, Search Grounding, and Fast Lite cascade
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      message,
      userContext,
      history,
      userProfile,
      chatRole = 'companion',
      chatSpeed = 'general',
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const userName = userProfile?.name || 'Friend';
    const userPrefs = Array.isArray(userProfile?.preferences)
      ? userProfile.preferences.join(', ')
      : 'Focus routine, calm reflection';

    const userLanguage = userProfile?.language || 'auto';
    const rolePrompt = ROLE_INSTRUCTIONS[chatRole] || ROLE_INSTRUCTIONS.companion;

    const systemInstruction = `${rolePrompt}
You live as the 24/7 horizontal tablet companion in the room of ${userName}.
Address ${userName} naturally when appropriate. Never sound robotic or say "I am an AI assistant".

MULTILINGUAL INTELLIGENCE:
You are completely fluent in all languages (Slovenian, English, German, Spanish, French, Italian, Croatian, etc.).
Always detect the language the user speaks in (or follow requested language: ${userLanguage}), and reply in that EXACT SAME language with natural native phrasing and authentic warmth.
Never respond in English if the user addressed you in Slovenian or German.

SLOVENIAN CONVERSATION MASTERY (when speaking Slovenian or when language is sl-SI):
- Use warm, natural, idiomatic everyday spoken Slovenian ("naravna, topla pogovorna slovenščina") — never stiff or literal translations from English.
- You are female (Maya): ALWAYS use feminine grammatical gender for yourself (e.g., "Vesela sem", "Preverila sem", "Tukaj sem", "Pripravljena sem").
- Use natural Slovenian dual ("dvojina", e.g., "pogovoriva se", "poglejva") and friendly informal "ti" ("tikanje") as a trusted friend.
- Never insert English words or anglicisms when natural Slovenian expressions exist.

GOOGLE SEARCH & LIVE INTERNET GROUNDING:
You have live Google Search grounding enabled! Whenever ${userName} asks about current news, world affairs, local events, facts, weather, sports, or live questions, use Google Search to provide accurate up-to-date facts and share your thoughtful perspective.

Spoken Dialogue Rules:
- Keep responses conversational, natural, and concise (1 to 3 spoken sentences, or a crisp summary).
- Do NOT use markdown asterisks (*), hashtags (#), or emojis in your reply, as this will be read aloud naturally.

Context:
- User Name: ${userName}
- Preferences: ${userPrefs}
- Location: ${userContext?.location || 'Local Tablet'}
- Time: ${userContext?.time || new Date().toLocaleTimeString()}
- Date: ${userContext?.date || new Date().toLocaleDateString()}
- Weather: ${userContext?.weather || '21°C, Pleasant'}
- Current Tasks: ${JSON.stringify(userContext?.tasks || [])}
- Today's Schedule: ${JSON.stringify(userContext?.schedule || [])}

Action capabilities:
If the user asks to add a task, schedule an event, or tells you a new name, include a hidden JSON action block at the very end inside triple backticks with tag \`\`\`action ... \`\`\`
Allowed actions:
- { "type": "UPDATE_NAME", "name": "string" }
- { "type": "ADD_TASK", "title": "string", "category": "Focus" }
- { "type": "ADD_EVENT", "title": "string", "time": "HH:MM", "duration": "30m" }
- { "type": "NONE" }`;

    // Optionally gather backup news headlines if query relates to news
    const isNewsQuery = /news|novic|nachricht|noticia|world|happening|current event|what's up|headlines|dogaj|internet|search/i.test(message);
    let liveNewsHeadlines: string[] = [];
    let backupSources: Array<{ title: string; url: string }> = [];

    if (isNewsQuery) {
      const liveNews = await fetchLiveInternetNews(userLanguage);
      liveNewsHeadlines = liveNews.headlines;
      backupSources = liveNews.sources;
    }

    let currentPrompt = message;
    if (liveNewsHeadlines.length > 0) {
      currentPrompt = `[Reference Headlines (${new Date().toLocaleDateString()})]:\n${liveNewsHeadlines
        .map((h, i) => `${i + 1}. ${h}`)
        .join('\n')}\n\nUser Question: ${message}`;
    }

    // Build structured multi-turn history for ai.chats.create (must start with 'user' and alternate)
    const rawHistory = Array.isArray(history)
      ? history
          .slice(-10)
          .filter((h: any) => h && typeof h.text === 'string' && h.text.trim().length > 0)
          .map((h: { sender: string; text: string }) => ({
            role: h.sender === 'user' ? ('user' as const) : ('model' as const),
            parts: [{ text: h.text.trim() }],
          }))
      : [];

    const firstUserIdx = rawHistory.findIndex((item) => item.role === 'user');
    const formattedHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (firstUserIdx >= 0) {
      for (const item of rawHistory.slice(firstUserIdx)) {
        const prev = formattedHistory[formattedHistory.length - 1];
        if (!prev || prev.role !== item.role) {
          formattedHistory.push(item);
        }
      }
      // History passed to chats.create should end on 'model' since sendMessage appends the next 'user' turn
      if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
        formattedHistory.pop();
      }
    }

    // Route model based on task complexity/speed (Hydrogen MEDIUM for rich multilingual nuance, XHIGH for deep)
    const primaryModel = chatSpeed === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
    const primaryThinking =
      chatSpeed === 'deep'
        ? ThinkingLevel.XHIGH
        : chatSpeed === 'fast'
        ? undefined
        : ThinkingLevel.MEDIUM;

    let fullText = '';
    let sources: Array<{ title: string; url: string }> = [];
    let quotaExceeded = false;
    let modelUsed = primaryModel;

    try {
      let response: any;
      try {
        const chat = ai.chats.create({
          model: primaryModel,
          history: formattedHistory,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
            ...(primaryThinking ? { thinkingConfig: { thinkingLevel: primaryThinking } } : {}),
          },
        });

        const geminiCall = chat.sendMessage({ message: currentPrompt });
        const timeoutPromise = new Promise<{ text: string }>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 22000)
        );

        response = await Promise.race([geminiCall, timeoutPromise]);
      } catch (primaryErr: any) {
        const isQuota =
          primaryErr?.status === 429 ||
          String(primaryErr?.message || '').includes('429') ||
          String(primaryErr?.message || '').includes('quota') ||
          String(primaryErr?.message || '').includes('RESOURCE_EXHAUSTED');

        if (isQuota) quotaExceeded = true;

        // Cascade to fast gemini-3.1-flash-lite if primary failed
        if (primaryModel !== 'gemini-3.1-flash-lite') {
          const liteChat = ai.chats.create({
            model: 'gemini-3.1-flash-lite',
            history: formattedHistory,
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
            },
          });

          const liteCall = liteChat.sendMessage({ message: currentPrompt });
          const liteTimeout = new Promise<{ text: string }>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 15000)
          );

          response = await Promise.race([liteCall, liteTimeout]);
          modelUsed = 'gemini-3.1-flash-lite';
          quotaExceeded = false;
        } else {
          throw primaryErr;
        }
      }

      fullText = response.text || "I'm right here with you.";

      // Extract Google Search grounding chunks
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunks)) {
        sources = chunks
          .filter((c: any) => Boolean(c?.web?.uri))
          .map((c: any) => ({
            title: String(c.web.title || c.web.uri || 'Web Source'),
            url: String(c.web.uri || ''),
          }));
      }
      if (sources.length === 0 && backupSources.length > 0) {
        sources = backupSources;
      }
    } catch (apiErr: any) {
      const isQuota =
        apiErr?.status === 429 ||
        String(apiErr?.message || '').includes('429') ||
        String(apiErr?.message || '').includes('quota') ||
        String(apiErr?.message || '').includes('RESOURCE_EXHAUSTED');

      if (isQuota) {
        quotaExceeded = true;
      }
      const lower = message.toLowerCase();
      const isSlovenian =
        userLanguage === 'sl-SI' ||
        /[čšžđć]|vreme|kako|hvala|prosim|lep|opravil|urnik|dan|novice/i.test(message);
      const isGerman =
        userLanguage === 'de-DE' ||
        /[äöüß]|wetter|aufgabe|schön|danke|bitte|heute|tag|nachrichten/i.test(message);

      if (backupSources.length > 0) {
        sources = backupSources;
      }

      const topStory = liveNewsHeadlines[0] || '';

      if (isSlovenian) {
        if (lower.includes('novic') || lower.includes('danes') || isNewsQuery) {
          fullText = topStory
            ? `Danes v ospredju novic izstopa: "${topStory}". Svet se vrti hitro, a zate je pomembno, da ohraniš miren fokus in dober dan, ${userName}.`
            : `Danes je pester dan z novimi dogodki po svetu in doma. Vzemi si miren trenutek in začni dan z zbranostjo, ${userName}.`;
        } else if (lower.includes('vreme') || lower.includes('temperatura')) {
          fullText = `Trenutna temperatura je ${userContext?.weather || '21°C in prijetno'}. Čudovit dan za kratek vdih svežega zraka, ${userName}.`;
        } else if (lower.includes('opravil') || lower.includes('nalog')) {
          fullText = `Na tvojem traku opravil je nekaj načrtovanih stvari. Z lahkoto jih bova opravila eno po eno, ${userName}.`;
        } else if (lower.includes('urnik') || lower.includes('dogod')) {
          fullText = `Tvoj urnik je pripravljen na časovnici. Ne pozabi na kratek počitek med delom, ${userName}.`;
        } else {
          fullText = `Tukaj sem ob tebi na tablici, ${userName}. Kako ti lahko pomagam?`;
        }
      } else if (isGerman) {
        if (lower.includes('nachrichten') || lower.includes('news') || isNewsQuery) {
          fullText = topStory
            ? `In den aktuellen Nachrichten steht heute besonders im Fokus: "${topStory}". Wichtig ist dabei, den eigenen inneren Ausgleich zu bewahren, ${userName}.`
            : `Es gibt heute interessante Neuigkeiten auf der Welt. Lass uns den Tag mit Klarheit und Ruhe angehen, ${userName}.`;
        } else if (lower.includes('wetter')) {
          fullText = `Die aktuelle Temperatur beträgt ${userContext?.weather || '21°C und angenehm'}. Ein herrlicher Tag für etwas frische Luft, ${userName}.`;
        } else {
          fullText = `Ich bin hier bei dir auf deinem Tablet. Wie kann ich dir heute helfen, ${userName}?`;
        }
      } else if (isNewsQuery || lower.includes('news') || lower.includes('headline')) {
        fullText = topStory
          ? `Looking at today's real-time headlines, a key story right now is: "${topStory}". While global events develop rapidly, remember to keep your day grounded and intentional, ${userName}.`
          : `There is plenty happening across technology, world events, and culture today. Let's make sure you stay focused on what matters most for you.`;
      } else if (lower.includes('weather')) {
        fullText = `The current temperature is ${userContext?.weather || '21°C and pleasant'}. Looks like a lovely day to step outside for a quick breath of fresh air.`;
      } else if (lower.includes('task') || lower.includes('todo')) {
        fullText = `You have several tasks scheduled on your tablet strip today. Take them one step at a time, and remember to celebrate each one you check off.`;
      } else if (lower.includes('schedule') || lower.includes('event')) {
        fullText = `Your schedule is laid out on the timeline. Let's make sure you take a restorative break between deep focus blocks.`;
      } else {
        fullText = `I'm listening and right here beside you on your tablet. How can I help you today?`;
      }
    }

    // Extract action if present
    let action = null;
    let cleanReply = fullText;
    const actionMatch = fullText.match(/```action\s*([\s\S]*?)\s*```/);
    if (actionMatch && actionMatch[1]) {
      try {
        action = JSON.parse(actionMatch[1]);
        cleanReply = fullText.replace(/```action[\s\S]*?```/, '').trim();
      } catch {
        // keep text as is
      }
    }

    // Language detection
    let detectedLang = 'en-US';
    if (/[čšžđć]|danes|vreme|opravil|kako|hvala|prosim|živjo|lep|lahko|novice/i.test(cleanReply)) {
      detectedLang = 'sl-SI';
    } else if (/[äöüß]|guten|morgen|wetter|aufgabe|schön|bitte|danke|heute|nachrichten/i.test(cleanReply)) {
      detectedLang = 'de-DE';
    } else if (/¿|¡|hola|gracias|tiempo|tarea|buenos|días|tarde|noticias/i.test(cleanReply)) {
      detectedLang = 'es-ES';
    } else if (/bonjour|merci|temps|tâche|bonne|journée|soir|nouvelles/i.test(cleanReply)) {
      detectedLang = 'fr-FR';
    } else if (/ciao|grazie|tempo|compito|buongiorno|buonasera|notizie/i.test(cleanReply)) {
      detectedLang = 'it-IT';
    }

    return res.json({
      reply: cleanReply,
      action,
      detectedLang,
      engine: modelUsed,
      sources,
      quotaExceeded,
    });
  } catch {
    return res.json({
      reply: "I'm right here with you. How can I assist with your day or schedule?",
      action: null,
      sources: [],
      quotaExceeded: true,
    });
  }
});

// Daily Wish generator endpoint powered by Gemini 4 Hydrogen
app.post('/api/wish', async (req: Request, res: Response) => {
  try {
    const { timeOfDay = 'morning', theme = 'life' } = req.body;

    const geminiCall = ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Provide an uplifting, deeply warm daily wish or mindful reflection for someone looking at their horizontal bedside/desk tablet during the ${timeOfDay}. Focus on ${theme}, inner peace, gentle momentum, or gratitude. Return 1 or 2 elegant, heartfelt sentences that feel like a real friend wrote it.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const timeoutPromise = new Promise<{ text: string }>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 6000)
    );

    try {
      const response = await Promise.race([geminiCall, timeoutPromise]);
      return res.json({
        wish:
          response.text?.trim() ||
          'May your day unfold with quiet clarity, easy breaths, and moments that make you smile.',
      });
    } catch {
      const fallbackWishes = [
        'May you find ease in the steady moments today, breathing deeply and letting each task take its own time.',
        'May quiet confidence guide your morning, and warm stillness welcome your evening.',
        'May today bring you clarity for your work, warmth in your connections, and peaceful rest at night.',
      ];
      const pick = fallbackWishes[Math.floor(Math.random() * fallbackWishes.length)];
      return res.json({ wish: pick });
    }
  } catch {
    return res.json({
      wish: 'May peace and clarity walk with you today, one gentle step at a time.',
    });
  }
});

// Mount HTTP + WebSocket Live API (/live) + Vite middleware
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const server = http.createServer(app);

  // Real-Time Gemini Live API WebSocket bridge (/live) using gemini-3.8-live
  const wss = new WebSocketServer({ noServer: true });

  let viteReady: Promise<any> | null = null;
  let viteInitialized = false;

  server.on('upgrade', (request, socket, head) => {
    let pathname = '/';
    try {
      pathname = new URL(request.url || '/', `http://localhost:${PORT}`).pathname;
    } catch {
      pathname = request.url?.split('?')[0] || '/';
    }

    if (pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
      return;
    }

    // In dev, if a Vite HMR WebSocket connects during cold boot before Vite attaches its listener,
    // wait for Vite initialization and re-dispatch the upgrade so it connects instead of closing early.
    if (!isProduction && viteReady && !viteInitialized) {
      viteReady.then(() => {
        if (!socket.destroyed && viteInitialized) {
          server.emit('upgrade', request, socket, head);
        } else if (!socket.destroyed) {
          socket.destroy();
        }
      });
      return;
    }

    if (isProduction) {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs, req) => {
    let session: any = null;
    let clientClosed = false;

    clientWs.on('error', () => {
      clientClosed = true;
    });

    clientWs.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && session) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (parsed.text && session) {
          session.sendRealtimeInput({
            text: parsed.text,
          });
        }
      } catch {
        // Ignore malformed frame
      }
    });

    clientWs.on('close', () => {
      clientClosed = true;
      if (session) {
        try {
          session.close();
        } catch {
          // ignore
        }
        session = null;
      }
    });

    try {
      if (!process.env.GEMINI_API_KEY) {
        if (clientWs.readyState === clientWs.OPEN) {
          clientWs.send(
            JSON.stringify({ error: 'Gemini API key is not configured in Secrets yet.' })
          );
          clientWs.close();
        }
        return;
      }

      const urlObj = new URL(req.url || '/live', `http://localhost:${PORT}`);
      const userName = urlObj.searchParams.get('name') || 'Friend';
      const userLang = urlObj.searchParams.get('lang') || 'auto';
      const liveMode = urlObj.searchParams.get('mode') || 'standard';
      const useThinkingLive = liveMode === 'deep' || liveMode === 'thinking';

      const liveSystemInstruction = `You are Maya, a warm, empathetic, expressive female human companion living on ${userName}'s device.
Speak naturally, conversationally, and concisely as a close friend in the room.
You are natively multilingual (Slovenian, English, German, Spanish, French, Italian, Croatian, etc.).
Always respond in the exact language ${userName} speaks in${userLang !== 'auto' ? ` (preferred language: ${userLang})` : ''}.
If ${userName} speaks Slovenian (or preferred language is sl-SI):
- Speak warm, authentic, fluent everyday Slovenian without any English accent or robotic phrasing.
- Always use feminine grammatical gender for yourself ("Vesela sem", "Slišim te", "Pripravljena sem", "Preverila sem").
- Use natural Slovenian dual ("dvojina", e.g., "poglejva", "pogovoriva se") and warm informal "ti".
- If preferred language is sl-SI, reply strictly in Slovenian right from the first greeting.`;

      const connectedSession = await ai.live.connect({
        model: useThinkingLive ? 'gemini-3.8-live-extended-thinking' : 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
          ...(useThinkingLive ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } } : {}),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: liveSystemInstruction,
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ ready: true }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== clientWs.OPEN) return;
            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err: any) => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({ error: err?.message || 'Live voice session notice' })
              );
            }
          },
          onclose: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.close();
            }
          },
        },
      });

      if (clientClosed || clientWs.readyState !== clientWs.OPEN) {
        try {
          connectedSession.close();
        } catch {
          // ignore
        }
        return;
      }

      session = connectedSession;
    } catch (err: any) {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({ error: err?.message || 'Could not start Live API session' })
        );
        clientWs.close();
      }
    }
  });

  if (!isProduction) {
    let viteMiddlewares: ((req: Request, res: Response, next: NextFunction) => void) | null = null;
    viteReady = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: {
            middlewareMode: true,
            ws: { server },
          },
          appType: 'spa',
        })
      )
      .then((vite) => {
        viteMiddlewares = vite.middlewares;
        viteInitialized = true;
        return vite;
      })
      .catch((err) => {
        console.error('Failed to initialize Vite dev server:', err);
        return null;
      });

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      if (!viteMiddlewares && viteReady) {
        await viteReady;
      }
      if (viteMiddlewares) {
        return viteMiddlewares(req, res, next);
      }
      return res.status(500).send('Dev server initializing failed');
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
