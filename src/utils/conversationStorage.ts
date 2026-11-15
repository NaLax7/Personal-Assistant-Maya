/**
 * Persistent Conversation Logs Manager
 * Saves all user queries, Maya replies, timestamps, languages, and web search grounding sources
 * to tablet / browser localStorage. Supports export as text and downloading.
 */

export interface SourceLink {
  title: string;
  url: string;
}

export interface ConversationLogEntry {
  id: string;
  timestamp: number;
  timeString: string;
  dateString: string;
  sender: 'user' | 'assistant';
  text: string;
  language?: string;
  sources?: SourceLink[];
  engine?: string;
}

const STORAGE_KEY = 'maya_conversation_logs_v1';
const MAX_LOGS = 500; // Store up to 500 conversation turns locally

export const conversationStorage = {
  getLogs(): ConversationLogEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  addEntry(entry: Omit<ConversationLogEntry, 'id' | 'timestamp' | 'timeString' | 'dateString'>): ConversationLogEntry {
    const now = new Date();
    const newLog: ConversationLogEntry = {
      ...entry,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      timeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dateString: now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    };

    try {
      const current = this.getLogs();
      const updated = [...current, newLog].slice(-MAX_LOGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota
    }

    return newLog;
  },

  clearLogs(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },

  exportAsText(): string {
    const logs = this.getLogs();
    if (logs.length === 0) {
      return 'Maya Conversation History: [No recorded conversations yet]';
    }

    let output = `========================================\n`;
    output += `MAYA COMPANION - CONVERSATION LOGS\n`;
    output += `Export Date: ${new Date().toLocaleString()}\n`;
    output += `Total Recorded Turns: ${logs.length}\n`;
    output += `========================================\n\n`;

    logs.forEach((log, index) => {
      const senderLabel = log.sender === 'user' ? 'YOU (USER)' : 'MAYA';
      output += `[#${index + 1}] ${log.dateString} at ${log.timeString}\n`;
      output += `${senderLabel}: ${log.text}\n`;
      if (log.language && log.language !== 'auto') {
        output += `Language: ${log.language}\n`;
      }
      if (log.sources && log.sources.length > 0) {
        output += `Live Web Sources Referenced:\n`;
        log.sources.forEach((src) => {
          output += `  • ${src.title || 'Web Link'}: ${src.url}\n`;
        });
      }
      output += `----------------------------------------\n\n`;
    });

    return output;
  },

  downloadLogsFile(): void {
    const text = this.exportAsText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maya_conversations_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
