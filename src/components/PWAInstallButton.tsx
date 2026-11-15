import React, { useState } from 'react';
import {
  Smartphone,
  Tablet,
  Check,
  Copy,
  X,
  ShieldCheck,
  Download,
  Share,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Automatically suppress install trigger once launched as an installed standalone app
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const handleCopyLink = (url: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2400);
    }
  };

  const currentUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 hover:text-white transition-colors whitespace-nowrap shrink-0 border border-slate-800 cursor-pointer"
        title="Install Maya directly onto your Tablet or Phone"
      >
        <Download className="w-3.5 h-3.5 text-sky-400" />
        <span>Install</span>
      </button>

      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-700/80 p-5 sm:p-6 shadow-2xl text-slate-100 relative">
            <button
              onClick={() => setShowInstallModal(false)}
              className="sticky top-0 float-right p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Install Maya on Tablet or Phone
                </h3>
                <p className="text-xs text-slate-400">
                  Runs independently by itself — no computer needed
                </p>
              </div>
            </div>

            <div className="space-y-3 my-3">
              {/* Primary Standalone HTTPS URL */}
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Direct Standalone App Link (HTTPS)
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Open this link directly on your Android tablet (Chrome) or iPhone/iPad (Safari) to install Maya as its own standalone app:
                </p>
                <div className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-sky-300">
                  <span className="truncate flex-1 font-semibold">{currentUrl}</span>
                  <button
                    onClick={() => handleCopyLink(currentUrl)}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-sans text-xs font-semibold shrink-0 transition flex items-center gap-1 cursor-pointer"
                  >
                    {copiedUrl === currentUrl ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Android vs iPhone steps */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                  <Tablet className="w-3.5 h-3.5 text-sky-400" />
                  <span>{isIOS ? 'iPhone / iPad (Safari)' : 'Android Tablet & Phone (Chrome)'}</span>
                </div>

                {isIOS ? (
                  <ol className="space-y-1.5 text-slate-300 list-decimal list-inside">
                    <li>
                      Open this link in <strong>Safari</strong> on your iPhone or iPad.
                    </li>
                    <li>
                      Tap the <strong>Share</strong> icon (<Share className="w-3 h-3 inline mx-0.5" />) at the bottom or top bar.
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong> → <strong>Add</strong>.
                    </li>
                  </ol>
                ) : (
                  <ol className="space-y-1.5 text-slate-300 list-decimal list-inside">
                    <li>
                      Open this link in <strong>Google Chrome</strong> directly on your tablet or phone.
                    </li>
                    <li>
                      Tap Chrome&apos;s <strong>three dots (⋮)</strong> in the top-right corner.
                    </li>
                    <li>
                      Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>) → <strong>Install</strong>.
                    </li>
                    <li>
                      Open the new <strong>Maya</strong> icon on your home screen — it runs full-screen by itself.
                    </li>
                  </ol>
                )}
              </div>

              {/* Standalone & Offline Summary */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-sky-500/30 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Works Standalone &amp; Offline</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Once installed, Maya stays on your tablet home screen with no computer required. Clock, date, Night Dim, tasks, schedule, wishes, and quick device voice commands even continue working offline.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowInstallModal(false)}
                className="py-2 px-5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
