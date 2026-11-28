import { useEffect, useState } from 'react';
import {
  CheckCircle,
  DownloadSimple,
  HardDrives,
  Monitor,
  ShieldCheck,
  Sparkle,
  WarningCircle,
  WifiSlash,
  X,
} from '@phosphor-icons/react';
import {
  detectClientPlatformTarget,
  getConfiguredDesktopExeUrl,
  PLATFORM_ASSET_FILENAMES,
  resolvePlatformInstallerUrl,
  saveDesktopExeUrl,
  triggerExeDownload,
  type PlatformDownloadTarget,
} from '../services/desktopDownload';

interface DesktopAppModalProps {
  isOpen: boolean;
  downloadStarted: boolean;
  onClose: () => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const PLATFORM_OPTIONS: Array<{
  id: PlatformDownloadTarget;
  shortLabel: string;
  subtitle: string;
  buttonLabel: string;
}> = [
  {
    id: 'win64',
    shortLabel: 'Windows',
    subtitle: 'Windows Installer · SecretArea.exe (64-bit)',
    buttonLabel: 'Download SecretArea.exe (Windows x64)',
  },
  {
    id: 'macos-arm64',
    shortLabel: 'macOS Apple Silicon',
    subtitle: 'macOS Disk Image · SecretArea-macOS-AppleSilicon.dmg (M1–M4)',
    buttonLabel: 'Download for macOS (Apple Silicon)',
  },
  {
    id: 'macos-x64',
    shortLabel: 'macOS Intel',
    subtitle: 'macOS Disk Image · SecretArea-macOS-Intel.dmg (x64)',
    buttonLabel: 'Download for macOS (Intel)',
  },
  {
    id: 'linux-appimage',
    shortLabel: 'Linux AppImage',
    subtitle: 'Linux AppImage · SecretArea-linux-x86_64.AppImage (x64)',
    buttonLabel: 'Download AppImage (Linux x64)',
  },
  {
    id: 'linux-deb',
    shortLabel: 'Linux .deb',
    subtitle: 'Debian / Ubuntu · SecretArea-linux-amd64.deb (amd64)',
    buttonLabel: 'Download .deb (Ubuntu / Debian)',
  },
];

export function DesktopAppModal({
  isOpen,
  downloadStarted,
  onClose,
  onNotify,
}: DesktopAppModalProps) {
  const [exeUrl, setExeUrl] = useState<string>(() => getConfiguredDesktopExeUrl());
  const [selectedTarget, setSelectedTarget] = useState<PlatformDownloadTarget>(() =>
    detectClientPlatformTarget()
  );
  const [repoInput, setRepoInput] = useState('');
  const [showConfigEditor, setShowConfigEditor] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const current = getConfiguredDesktopExeUrl();
    setExeUrl(current);
    setSelectedTarget(detectClientPlatformTarget());
    setShowConfigEditor(!current);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activePlatformMeta =
    PLATFORM_OPTIONS.find((p) => p.id === selectedTarget) || PLATFORM_OPTIONS[0];
  const targetFilename = PLATFORM_ASSET_FILENAMES[selectedTarget];
  const resolvedDownloadUrl = exeUrl
    ? resolvePlatformInstallerUrl(exeUrl, selectedTarget)
    : '';
  const previewUrl = resolvePlatformInstallerUrl(repoInput, selectedTarget);
  const isMacTarget = selectedTarget === 'macos-arm64' || selectedTarget === 'macos-x64';

  const handleSaveRepoAndDownload = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedBase = saveDesktopExeUrl(repoInput);
    if (!resolvedBase) {
      onNotify(
        'Enter a valid GitHub repo (e.g. username/secretarea) or direct release URL.',
        'error'
      );
      return;
    }
    setExeUrl(resolvedBase);
    setShowConfigEditor(false);
    triggerExeDownload(resolvedBase, selectedTarget);
    onNotify(`Starting ${targetFilename} download...`, 'success');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Download SecretArea Desktop App"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sa-ps5-panel w-full max-w-xl rounded-[var(--sa-card-radius)] bg-white border border-slate-200 text-slate-800 dark:bg-[#161c26] dark:border-white/[0.12] dark:text-[#e5e9f0] shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 dark:bg-[#11161f] dark:border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="sa-icon-badge w-9 h-9 shrink-0">
              <Monitor className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-[15.5px] sm:text-[16px] font-semibold tracking-normal text-slate-900 dark:text-white truncate">
                SecretArea Desktop App
              </h2>
              <p className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4] font-mono-tabular truncate">
                {activePlatformMeta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close desktop installer modal"
            className="sa-btn-secondary p-1.5 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Platform Switcher */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select target operating system">
            {PLATFORM_OPTIONS.map((opt) => {
              const active = opt.id === selectedTarget;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedTarget(opt.id)}
                  className={`px-2.5 py-1.5 rounded-[var(--sa-btn-radius)] text-[11.5px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[var(--sa-btn-bg,var(--sa-accent))] border-[var(--sa-btn-border,var(--sa-secondary))] text-[var(--sa-btn-fg,var(--sa-accent-fg))] shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-[#10151d] dark:hover:bg-white/[0.06] dark:border-white/[0.08] dark:text-[#9cb0c9]'
                  }`}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>

          {downloadStarted && resolvedDownloadUrl && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-400/40 dark:text-emerald-200 flex items-start gap-2.5 text-[12.5px]">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Downloading <strong>{targetFilename}</strong> installer.{' '}
                {isMacTarget
                  ? 'Open the .dmg and drag SecretArea.app into Applications.'
                  : 'Run the downloaded package to install SecretArea on your system.'}
              </span>
            </div>
          )}

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sa-ps5-subpanel p-3 rounded-[var(--sa-card-inner-radius)] bg-slate-50 border border-slate-200 dark:bg-[#10151d] dark:border-white/[0.06] space-y-1">
              <HardDrives className="w-4 h-4 text-[var(--sa-accent)]" />
              <div className="text-[12px] font-semibold text-slate-900 dark:text-white">
                {isMacTarget
                  ? 'Native .dmg Bundle'
                  : selectedTarget.startsWith('linux')
                  ? 'Native Linux Build'
                  : 'Real .exe Installer'}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-[#8b9bb4]">
                Installs cleanly via {targetFilename} — no source code required.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-[#10151d] dark:border-white/[0.06] space-y-1">
              <WifiSlash className="w-4 h-4 text-emerald-600 dark:text-[#34d399]" />
              <div className="text-[12px] font-semibold text-slate-900 dark:text-white">Works Offline</div>
              <p className="text-[11px] text-slate-600 dark:text-[#8b9bb4]">
                Caches your synced library locally for browsing without Wi-Fi.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-[#10151d] dark:border-white/[0.06] space-y-1">
              <Sparkle className="w-4 h-4 text-violet-600 dark:text-[#a78bfa]" />
              <div className="text-[12px] font-semibold text-slate-900 dark:text-white">PS5 Fullscreen Mode</div>
              <p className="text-[11px] text-slate-600 dark:text-[#8b9bb4]">
                Native full-screen console theme with ambient audio &amp; SFX.
              </p>
            </div>
          </div>

          {isMacTarget && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-400/30 dark:text-amber-200 flex items-start gap-2.5 text-[11.5px] leading-relaxed">
              <WarningCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                If macOS shows an unverified developer prompt on first launch, right-click{' '}
                <strong>SecretArea.app</strong> in Applications and choose{' '}
                <strong>Open</strong> (or allow it in{' '}
                <strong>System Settings &rarr; Privacy &amp; Security</strong>).
              </span>
            </div>
          )}

          {resolvedDownloadUrl && !showConfigEditor ? (
            <div className="space-y-3 pt-1">
              <a
                href={resolvedDownloadUrl}
                download={targetFilename}
                onClick={() => onNotify(`Downloading ${targetFilename}...`, 'success')}
                className="sa-btn-primary w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-[13.5px] font-semibold shadow-lg cursor-pointer"
              >
                <DownloadSimple className="w-4 h-4" />
                <span>{activePlatformMeta.buttonLabel}</span>
              </a>

              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#7c8da3]">
                <span className="truncate font-mono-tabular">{resolvedDownloadUrl}</span>
                <button
                  type="button"
                  onClick={() => setShowConfigEditor(true)}
                  className="sa-link whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Change URL
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveRepoAndDownload} className="space-y-3 pt-1">
              <div className="sa-ps5-subpanel p-3.5 rounded-[var(--sa-card-inner-radius)] bg-slate-50 border border-slate-200 dark:bg-[#10151d] dark:border-white/[0.08] space-y-2.5">
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-900 dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-[var(--sa-accent)]" />
                  <span>Connect Your GitHub Release Link ({targetFilename})</span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-[#94a3b8] leading-relaxed">
                  Paste your GitHub repository URL (e.g.{' '}
                  <code className="text-[var(--sa-accent)]">https://github.com/yourname/secretarea</code>) or a direct{' '}
                  <code className="text-[var(--sa-accent)]">{targetFilename}</code> download URL. GitHub Actions builds{' '}
                  <strong className="text-slate-900 dark:text-white">Windows, macOS &amp; Linux</strong> assets automatically.
                </p>

                <input
                  type="text"
                  required
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="https://github.com/username/secretarea  or  username/secretarea"
                  className="sa-search-input w-full px-3 py-2 text-[12.5px]"
                />

                {previewUrl && (
                  <div className="text-[11px] text-[var(--sa-accent)] font-mono-tabular break-all">
                    Installer target: {previewUrl}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  {exeUrl && (
                    <button
                      type="button"
                      onClick={() => setShowConfigEditor(false)}
                      className="sa-btn-secondary px-3 py-1.5 text-[12px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="sa-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold cursor-pointer"
                  >
                    <DownloadSimple className="w-3.5 h-3.5" />
                    <span>Save &amp; Download</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
