import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Trash2,
  Copy,
  Check,
  Search,
  ExternalLink,
  MessageSquare,
  Globe,
  Clock,
  Sparkles,
  Bot,
} from 'lucide-react';
import {
  conversationStorage,
  ConversationLogEntry,
} from '../utils/conversationStorage';

interface ConversationLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNightDim?: boolean;
}

export const ConversationLogsModal: React.FC<ConversationLogsModalProps> = ({
  isOpen,
  onClose,
  isNightDim = false,
}) => {
  const [logs, setLogs] = useState<ConversationLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLogs(conversationStorage.getLogs());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = () => {
    conversationStorage.downloadLogsFile();
  };

  const handleCopyAll = async () => {
    const text = conversationStorage.exportAsText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleClear = () => {
    conversationStorage.clearLogs();
    setLogs([]);
    setShowClearConfirm(false);
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.sources && l.sources.some((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-3xl rounded-3xl border shadow-2xl flex flex-col h-[88vh] max-h-[700px] overflow-hidden ${
          isNightDim
            ? 'bg-slate-950 border-amber-950/60 text-amber-100'
            : 'bg-slate-900 border-slate-700/80 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-display text-white">
                  Maya Conversation History & Logs
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                  {logs.length} Turns
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Saved on tablet storage · Includes news links and timestamps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export / Download button */}
            <button
              onClick={handleDownload}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              title="Save conversation file to tablet"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save to Tablet</span>
            </button>

            {/* Copy button */}
            <button
              onClick={handleCopyAll}
              disabled={logs.length === 0}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
              title="Copy all conversation text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar & Clear Action Strip */}
        <div className="p-3 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations, news topics, or answers..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {showClearConfirm ? (
            <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-500/50 px-2 py-1 rounded-xl">
              <span className="text-[11px] text-rose-200">Delete all logs?</span>
              <button
                onClick={handleClear}
                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
              >
                Yes
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-1.5 py-0.5 text-slate-300 hover:text-white text-[10px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
              title="Clear all stored logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[11px]">Clear</span>
            </button>
          )}
        </div>

        {/* Scrollable Conversation Turns List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center">
              <MessageSquare className="w-10 h-10 text-slate-700 mb-2" />
              <p className="text-sm font-medium text-slate-400">
                {searchQuery ? 'No matching logs found' : 'No recorded conversations yet'}
              </p>
              <span className="text-xs text-slate-500 mt-1 max-w-sm">
                Say "Maya..." or ask questions about news, weather, or schedules to start recording conversations automatically.
              </span>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const isUser = entry.sender === 'user';
              return (
                <div
                  key={entry.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isUser
                      ? 'bg-slate-800/40 border-slate-700/60 ml-8'
                      : 'bg-slate-900/90 border-sky-500/30 mr-8 shadow-md'
                  }`}
                >
                  {/* Top metadata tag */}
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800/60 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      {isUser ? (
                        <span className="font-semibold text-emerald-400">You</span>
                      ) : (
                        <div className="flex items-center gap-1 text-sky-400 font-semibold">
                          <Bot className="w-3 h-3" />
                          <span>Maya</span>
                          <span className="text-[9px] px-1 rounded bg-sky-950 text-sky-300 border border-sky-500/30">
                            Gemini 3.8
                          </span>
                        </div>
                      )}
                      {entry.language && entry.language !== 'auto' && (
                        <span className="text-slate-400">· {entry.language}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{entry.dateString} at {entry.timeString}</span>
                    </div>
                  </div>

                  {/* Message body */}
                  <p className="text-xs text-slate-200 leading-relaxed font-normal whitespace-pre-wrap select-text">
                    {entry.text}
                  </p>

                  {/* Grounded Web Sources (if available from Google Search Grounding) */}
                  {entry.sources && entry.sources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-1.5">
                        <Globe className="w-3 h-3 text-sky-400" />
                        <span>Live Internet Sources Referenced:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.sources.map((src, sIdx) => (
                          <a
                            key={sIdx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-sky-500/30 text-[10px] text-sky-300 hover:text-white transition-colors truncate max-w-[260px]"
                            title={src.title}
                          >
                            <span className="truncate">{src.title || 'Web Source'}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="text-[11px] font-mono">
            Conversations persist across tablet reboots in local storage
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
