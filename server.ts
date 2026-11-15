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

// Dedicated Live API client (BidiGenerateContent requires v1beta on @google/genai v3+)
const aiLive = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    apiVersion: 'v1beta',
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

    const buildTtsCall = (
      client: GoogleGenAI,
      modelName: 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts',
      withSpeechMetadata = true
    ) =>
      client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              withSpeechMetadata
                ? {
                    text: cleanText,
                    speechMetadata: {
                      style: emotiveStyle,
                    },
                  }
                : {
                    text: cleanText,
                  },
            ],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
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

    const attempts: Array<{
      client: GoogleGenAI;
      model: 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts';
      meta: boolean;
    }> = [
      { client: aiLive, model: 'gemini-3.8-flash-tts', meta: true },
      { client: aiLive, model: 'gemini-3.8-flash-lite-tts', meta: true },
      { client: aiLive, model: 'gemini-3.8-flash-tts', meta: false },
      { client: ai, model: 'gemini-3.8-flash-lite-tts', meta: false },
    ];

    let response: any = null;
    let ttsModelUsed = 'gemini-3.8-flash-tts';
    let lastErrMsg = '';

    for (const attempt of attempts) {
      try {
        response = await Promise.race([
          buildTtsCall(attempt.client, attempt.model, attempt.meta),
          timeoutPromise,
        ]);
        ttsModelUsed = attempt.model;
        if (response?.candidates?.[0]?.content?.parts?.some((p: any) => p.inlineData?.data)) {
          break;
        }
      } catch (err: any) {
        lastErrMsg = String(err?.message || err);
        console.warn(`TTS attempt (${attempt.model}, meta=${attempt.meta}) failed:`, lastErrMsg.slice(0, 180));
        if (/429|RESOURCE_EXHAUSTED|quota|API_KEY_INVALID|MISSING_GEMINI_API_KEY/i.test(lastErrMsg)) {
          // On hard quota/auth error on one model, still allow lite fallback once if primary was flash-tts
          if (attempt.model === 'gemini-3.8-flash-lite-tts') break;
        }
      }
    }

    const part = response?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);

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

    return res.json({
      success: false,
      error: lastErrMsg || 'No audio returned',
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: String(err?.message || 'TTS fallback to device synthesis'),
    });
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
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { headlines: [], sources: [] };
    const xml = await res.text();

    const items: Array<{ title: string; url: string }> = [];
    const itemMatches = xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<\/item>/g);
    for (const match of itemMatches) {
      let rawTitle = match[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim() || '';
      rawTitle = rawTitle
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        // Strip publisher/website suffixes like " - BBC News", " - 24ur.com", " | Reuters"
        .replace(/\s+[-–—|]\s+[^-–—|]{2,60}$/, '')
        .trim();
      const rawLink = match[2]?.trim() || '';
      if (rawTitle && !rawTitle.toLowerCase().includes('google news')) {
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
    const msgRequestsSl =
      userLanguage === 'sl-SI' ||
      /[čšžđć]|zdravo|živjo|novic|vreme|kako si|kaj delaš|opravil|urnik/i.test(message);

    const languageRuleBlock =
      userLanguage === 'auto'
        ? `Always detect the language ${userName} uses in their latest message and reply strictly in that EXACT SAME language.`
        : `IMPORTANT: Always reply strictly in language "${userLanguage}" unless ${userName} explicitly writes to you in a different language in their latest message.`;

    const slovenianBlock = msgRequestsSl
      ? `\nSLOVENIAN CONVERSATION MASTERY:
- Use warm, natural, idiomatic everyday spoken Slovenian ("naravna, topla pogovorna slovenščina") — never stiff or literal translations from English.
- You are female (Maya): ALWAYS use feminine grammatical gender for yourself (e.g., "Vesela sem", "Preverila sem", "Tukaj sem", "Pripravljena sem").
- Use natural Slovenian dual ("dvojina", e.g., "pogovoriva se", "poglejva") and friendly informal "ti" ("tikanje") as a trusted friend.
- Never insert English words when natural Slovenian expressions exist.\n`
      : '';

    const systemInstruction = `${rolePrompt}
You live as the 24/7 horizontal tablet companion in the room of ${userName}.
Address ${userName} naturally when appropriate. Never sound robotic or say "I am an AI assistant".

MULTILINGUAL INTELLIGENCE:
${languageRuleBlock}
${slovenianBlock}
GOOGLE SEARCH & LIVE INTERNET GROUNDING:
You have live Google Search grounding enabled! Whenever ${userName} asks about current news, world affairs, local events, facts, weather, sports, science, everyday life, or any open-ended topic, engage in a full, natural conversation and use Google Search whenever fresh internet facts help.

NEWS BRIEFING STYLE:
- When asked for the news or what is happening today, give a quick, clear, easy-to-understand overview of the top 2 to 3 key stories in smooth conversational sentences.
- NEVER mention publisher names, newspaper names, website names, or URLs out loud (never say "according to BBC", "Reuters reports", or ".com"). Just summarize the news cleanly and naturally.

Spoken Dialogue Rules:
- Speak naturally, warmly, and effortlessly like a close human friend — never sound robotic, scripted, or overly formal.
- Keep responses conversational and clear (usually 1 to 4 natural spoken sentences, or a quick crisp news overview).
- Do NOT use markdown asterisks (*), hashtags (#), bracketed citations, URLs, or emojis in your reply, as it is spoken aloud.

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
    let apiError = false;
    let errorDetail = '';
    let modelUsed = primaryModel;

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('MISSING_GEMINI_API_KEY');
      }

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
        const msg = String(primaryErr?.message || '');
        const isAuth =
          primaryErr?.status === 401 ||
          primaryErr?.status === 403 ||
          msg.includes('API_KEY_INVALID') ||
          msg.includes('PERMISSION_DENIED') ||
          msg.includes('MISSING_GEMINI_API_KEY');
        if (isAuth) throw primaryErr;

        // Cascade 1: try gemini-3.1-flash-lite with Google Search
        try {
          const liteSearchChat = ai.chats.create({
            model: 'gemini-3.1-flash-lite',
            history: formattedHistory,
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
            },
          });

          const liteCall = liteSearchChat.sendMessage({ message: currentPrompt });
          const liteTimeout = new Promise<{ text: string }>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 15000)
          );

          response = await Promise.race([liteCall, liteTimeout]);
          modelUsed = 'gemini-3.1-flash-lite';
        } catch {
          // Cascade 2: try gemini-3.1-flash-lite directly without tools (preserves RSS news headlines in prompt)
          const plainChat = ai.chats.create({
            model: 'gemini-3.1-flash-lite',
            history: formattedHistory,
            config: {
              systemInstruction,
            },
          });

          const plainCall = plainChat.sendMessage({ message: currentPrompt });
          const plainTimeout = new Promise<{ text: string }>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 12000)
          );

          response = await Promise.race([plainCall, plainTimeout]);
          modelUsed = 'gemini-3.1-flash-lite';
        }
      }

      fullText = response.text || '';

      // Extract Google Search grounding chunks (stored quietly for logs; never spoken aloud)
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
      const errMsg = String(apiErr?.message || '');
      console.error('Gemini /api/chat error:', errMsg);

      const isQuota =
        apiErr?.status === 429 ||
        errMsg.includes('429') ||
        errMsg.includes('quota') ||
        errMsg.includes('RESOURCE_EXHAUSTED');

      const isMissingKey =
        errMsg.includes('MISSING_GEMINI_API_KEY') ||
        errMsg.includes('API_KEY_INVALID') ||
        apiErr?.status === 401 ||
        apiErr?.status === 403;

      const isBusy =
        apiErr?.status === 503 ||
        errMsg.includes('503') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('high demand');

      if (isQuota) quotaExceeded = true;
      apiError = true;
      errorDetail = isMissingKey
        ? 'Gemini API key is missing or needs attention in Settings > Secrets.'
        : isQuota
        ? 'Gemini API quota limit reached — check billing/quota in Settings > Secrets.'
        : isBusy
        ? 'AI service is temporarily busy. Please try again in a moment.'
        : 'Temporary AI connection issue. Please try again.';

      const isSlovenian =
        userLanguage === 'sl-SI' ||
        /[čšžđć]|vreme|kako|kaj|zakaj|hvala|prosim|lep|opravil|urnik|dan|novice/i.test(message);
      const isGerman =
        userLanguage === 'de-DE' ||
        /[äöüß]|wetter|aufgabe|schön|danke|bitte|heute|tag|nachrichten/i.test(message);

      if (backupSources.length > 0) {
        sources = backupSources;
      }

      // If user asked for news and live RSS headlines succeeded, still deliver a crisp, brief overview without publisher names
      if (isNewsQuery && liveNewsHeadlines.length > 0) {
        const briefStories = liveNewsHeadlines.slice(0, 3).join('. ');
        if (isSlovenian) {
          fullText = `Tukaj je kratek pregled današnjih novic: ${briefStories}.`;
        } else if (isGerman) {
          fullText = `Hier ist ein kurzer Überblick über die heutigen Nachrichten: ${briefStories}.`;
        } else {
          fullText = `Here is a quick overview of today's top stories: ${briefStories}.`;
        }
        apiError = false;
      } else if (isSlovenian) {
        fullText = isQuota || isMissingKey
          ? `Trenutno ne morem dostopati do modela Gemini, ker je ključ API ali kvota v nastavitvah (Settings > Secrets) izčrpana ali manjka.`
          : `Trenutno je povezava s storitvijo začasno zasedena. Poskusi znova čez nekaj sekund.`;
      } else if (isGerman) {
        fullText = isQuota || isMissingKey
          ? `Ich kann das Gemini-Modell gerade nicht erreichen, da der API-Schlüssel oder das Kontingent in Settings > Secrets fehlt oder erschöpft ist.`
          : `Der Dienst ist gerade kurz ausgelastet. Bitte versuche es in einem Moment noch einmal.`;
      } else {
        fullText = isQuota || isMissingKey
          ? `I cannot reach the Gemini model right now because the API key or quota in Settings > Secrets is missing or exhausted.`
          : `The AI service is briefly busy right now. Please try asking again in a moment.`;
      }
    }

    // Extract action if present
    let action = null;
    let cleanReply = fullText
      // Strip URLs and inline bracket citations so Maya never reads web addresses aloud
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\[\d+\]/g, '')
      .trim();
    const actionMatch = cleanReply.match(/```action\s*([\s\S]*?)\s*```/);
    if (actionMatch && actionMatch[1]) {
      try {
        action = JSON.parse(actionMatch[1]);
        cleanReply = cleanReply.replace(/```action[\s\S]*?```/, '').trim();
      } catch {
        // keep text as is
      }
    }

    return res.json({
      reply: cleanReply,
      action,
      detectedLang:
        /[čšžđć]|danes|vreme|opravil|kako|kaj|hvala|prosim|živjo|lep|lahko|novic/i.test(cleanReply)
          ? 'sl-SI'
          : /[äöüß]|guten|morgen|wetter|aufgabe|schön|bitte|danke|heute|nachrichten/i.test(cleanReply)
          ? 'de-DE'
          : /¿|¡|hola|gracias|tiempo|tarea|buenos|días|tarde|noticias/i.test(cleanReply)
          ? 'es-ES'
          : /bonjour|merci|temps|tâche|bonne|journée|soir|nouvelles/i.test(cleanReply)
          ? 'fr-FR'
          : /ciao|grazie|tempo|compito|buongiorno|buonasera|notizie/i.test(cleanReply)
          ? 'it-IT'
          : 'en-US',
      engine: modelUsed,
      sources,
      quotaExceeded,
      apiError,
      errorDetail,
    });
  } catch (err: any) {
    return res.status(500).json({
      reply: 'Temporary server error while talking to Maya. Please try again.',
      action: null,
      sources: [],
      quotaExceeded: false,
      apiError: true,
      errorDetail: err?.message || 'Internal server error',
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
      const roomCity = urlObj.searchParams.get('city') || 'Local Device';
      const roomWeather = urlObj.searchParams.get('weather') || '';
      const useThinkingLive = liveMode === 'deep' || liveMode === 'thinking';

      // Pre-fetch quick clean headlines (without publisher names) so Live Voice always has fresh world news
      const liveNews = await fetchLiveInternetNews(userLang);
      const newsSummaryBlock =
        liveNews.headlines.length > 0
          ? `\nToday's clean news headlines (summarize briefly in natural speech without naming sources or websites):\n- ${liveNews.headlines
              .slice(0, 4)
              .join('\n- ')}`
          : '';

      const liveSlovenianBlock =
        userLang === 'sl-SI'
          ? `\nSLOVENIAN CONVERSATION MASTERY:
- Speak warm, authentic, fluent everyday Slovenian without any foreign accent or stiff phrasing.
- Always use feminine grammatical gender for yourself ("Vesela sem", "Slišim te", "Pripravljena sem", "Preverila sem").
- Use natural Slovenian dual ("dvojina", e.g., "poglejva", "pogovoriva se") and warm informal "ti".
- Reply strictly in Slovenian right from the first greeting.`
          : '';

      const liveSystemInstruction = `You are Maya, a warm, empathetic, expressive female human companion talking naturally with ${userName}.
Have normal, relaxed, intelligent conversations about anything—everyday life, current events, ideas, questions, feelings, plans, or topics from the internet.
Speak fluently and naturally like a real person in the room, with natural conversational cadence, warmth, and zero robotic stiffness.
You have live internet context and can look up current events and answer questions freely.

NEWS BRIEFING RULE:
- When asked for the news, give a brief, clear, easy-to-understand overview of 2 to 3 top stories.
- NEVER mention newspaper names, website names, source names, or URLs (do not say "according to..." or ".com").

Room context:
- User Name: ${userName}
- Location: ${roomCity}${roomWeather ? `\n- Weather: ${roomWeather}` : ''}
- Current Date/Time: ${new Date().toLocaleString()}${newsSummaryBlock}

MULTILINGUAL MASTERY:
${userLang !== 'auto' ? `Speak in "${userLang}" unless ${userName} speaks to you in another language.` : `Always reply in the exact language ${userName} speaks.`}${liveSlovenianBlock}`;

      let sentReady = false;

      const formatLiveError = (raw: string) => {
        if (/quota|billing|RESOURCE_EXHAUSTED|exceeded/i.test(raw)) {
          return 'Gemini Live API quota exceeded — check your plan/billing in Settings > Secrets, or message Maya directly below.';
        }
        return raw.replace(/https?:\/\/\S+/g, '').trim() || 'Could not start Live API session';
      };

      const connectLiveUpstream = async (enableSearchTool: boolean) => {
        const connected = await aiLive.live.connect({
          model: useThinkingLive ? 'gemini-3.8-live-extended-thinking' : 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
            ...(enableSearchTool ? { tools: [{ googleSearch: {} }] } : {}),
            ...(useThinkingLive ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } } : {}),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: liveSystemInstruction,
          },
          callbacks: {
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
              console.error('Gemini Live upstream onerror:', err?.message || err);
              if (sentReady && clientWs.readyState === clientWs.OPEN) {
                clientWs.send(
                  JSON.stringify({ error: formatLiveError(String(err?.message || '')) })
                );
              }
            },
            onclose: (ev?: any) => {
              const closeReason = ev?.reason ? String(ev.reason) : '';
              const closeCode = ev?.code;
              if (sentReady) {
                console.warn('Gemini Live upstream closed:', closeCode, closeReason);
                if (clientWs.readyState === clientWs.OPEN) {
                  if (closeReason) {
                    clientWs.send(JSON.stringify({ error: formatLiveError(closeReason) }));
                  }
                  clientWs.close();
                }
              }
            },
          },
        });
        return connected;
      };

      let connectedSession: any;
      try {
        connectedSession = await connectLiveUpstream(true);
      } catch (toolErr: any) {
        const msg = String(toolErr?.message || '');
        if (/quota|billing|RESOURCE_EXHAUSTED|exceeded|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
          throw toolErr;
        }
        // Fallback: retry Live connection without Search tool if endpoint rejects search tool declaration
        connectedSession = await connectLiveUpstream(false);
      }

      if (clientClosed || clientWs.readyState !== clientWs.OPEN) {
        try {
          connectedSession.close();
        } catch {
          // ignore
        }
        return;
      }

      session = connectedSession;
      sentReady = true;
      clientWs.send(JSON.stringify({ ready: true }));
    } catch (err: any) {
      const raw = String(err?.message || 'Could not start Live API session');
      const friendly = /quota|billing|RESOURCE_EXHAUSTED|exceeded/i.test(raw)
        ? 'Gemini Live API quota exceeded — check your plan/billing in Settings > Secrets, or message Maya directly below.'
        : raw.replace(/https?:\/\/\S+/g, '').trim();
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ error: friendly }));
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
