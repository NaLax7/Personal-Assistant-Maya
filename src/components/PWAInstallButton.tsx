import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Tablet,
  Check,
  Copy,
  X,
  ShieldCheck,
  Wifi,
  Download,
  Share,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [lanUrls, setLanUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!showInstallModal) return;
    fetch('/api/network-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.lanUrls)) {
          setLanUrls(data.lanUrls);
        }
      })
      .catch(() => {});
  }, [showInstallModal]);

  // Automatically suppress install trigger once launched as an installed standalone PWA
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
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-5tmrjifgewv7msa5cu7a4f-715881743066.europe-west2.run.app';

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 hover:text-white transition-colors whitespace-nowrap shrink-0 border border-slate-800 cursor-pointer"
        title="Install Maya on your Phone or Tablet"
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
                  Install Maya on Phone &amp; Tablet
                </h3>
                <p className="text-xs text-slate-400">
                  Android, iPhone, and Huawei MediaPad T3 (Same Wi-Fi)
                </p>
              </div>
            </div>

            <div className="space-y-3 my-3">
              {/* Primary HTTPS URL */}
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Recommended: Instant Install &amp; Live Mic (HTTPS)
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Open this secure link on your phone (Android Chrome or iPhone Safari) to enable
                  one-tap app install and microphone access:
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
                  <span>{isIOS ? 'iPhone / iPad (Safari)' : 'Android Phone & Tablet (Chrome)'}</span>
                </div>

                {isIOS ? (
                  <ol className="space-y-1.5 text-slate-300 list-decimal list-inside">
                    <li>
                      Open the link above in <strong>Safari</strong> on your iPhone.
                    </li>
                    <li>
                      Tap the <strong>Share</strong> icon (<Share className="w-3 h-3 inline mx-0.5" />) at the bottom bar.
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong> → <strong>Add</strong>.
                    </li>
                  </ol>
                ) : (
                  <ol className="space-y-1.5 text-slate-300 list-decimal list-inside">
                    <li>
                      Open the link in <strong>Google Chrome</strong> on your phone.
                    </li>
                    <li>
                      Tap the <strong>three dots (⋮)</strong> in the top-right corner of Chrome.
                    </li>
                    <li>
                      Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                    </li>
                  </ol>
                )}
              </div>

              {/* Local Wi-Fi Server Mode */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-amber-500/30 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Same Wi-Fi Local Server Guide</span>
                </div>
                {lanUrls.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">Detected local Wi-Fi URLs:</span>
                    {lanUrls.map((url) => (
                      <div
                        key={url}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-200"
                      >
                        <span className="truncate">{url}</span>
                        <button
                          onClick={() => handleCopyLink(url)}
                          className="text-sky-400 hover:text-sky-300 font-sans text-[11px] font-semibold shrink-0 cursor-pointer"
                        >
                          {copiedUrl === url ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  If running locally on your PC (<code className="text-amber-300">http://192.168.x.x:3000</code>):
                  Android Chrome blocks microphone and PWA install on plain <code className="text-amber-300">http://</code> LAN URLs unless you open{' '}
                  <code className="text-sky-300">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> on the phone, add your PC&apos;s <code className="text-amber-300">http://192.168.x.x:3000</code> URL, enable it, and relaunch Chrome.
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
