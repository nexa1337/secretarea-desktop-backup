import { useEffect, useState } from 'react';
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  DownloadSimple,
  Eye,
  EyeSlash,
  Key,
  Magnet,
  Play,
  ShieldCheck,
  SpinnerGap,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import type {
  QbitSetupStage,
  QbitSetupState,
  TorrentConnectionTestResult,
  TorrentIntegrationConfig,
} from '../types';
import type { AppLanguage } from '../services/launcherSettings';
import { getTranslations } from '../i18n/translations';
import { formatBytes, formatDownloadSpeed, formatEta } from '../services/downloadManager';
import { QBIT_OFFICIAL_DOWNLOAD_URL, QBIT_OFFICIAL_LOGO_URL } from '../services/qbitSetup';

interface QbitSetupWizardModalProps {
  isOpen: boolean;
  isDesktopApp: boolean;
  language?: AppLanguage;
  setupState: QbitSetupState;
  torrentConfig: TorrentIntegrationConfig;
  torrentConnected: boolean;
  onClose: () => void;
  onDismissFirstLaunch: () => void;
  onRecheck: () => Promise<void> | void;
  onStartInstall: (userConfirmed: boolean) => Promise<void> | void;
  onLaunchClient: () => Promise<void> | void;
  onOpenOfficialDownload: () => void;
  onGeneratePassword: () => Promise<string>;
  onSaveAndVerifyWebUi: (
    cfg: Partial<TorrentIntegrationConfig>
  ) => Promise<TorrentConnectionTestResult | null>;
  onOpenSettings?: () => void;
}

const ORDERED_STEPS: QbitSetupStage[] = [
  'checking_dependencies',
  'detecting_qbit',
  'downloading',
  'verifying',
  'installing',
  'configuring',
  'completed',
];

function getStepRank(stage: QbitSetupStage): number {
  switch (stage) {
    case 'checking_dependencies':
      return 0;
    case 'detecting_qbit':
    case 'fetching_release':
      return 1;
    case 'downloading':
      return 2;
    case 'verifying':
      return 3;
    case 'installing':
      return 4;
    case 'configuring':
      return 5;
    case 'completed':
      return 6;
    default:
      return -1;
  }
}

export function QbitSetupWizardModal({
  isOpen,
  isDesktopApp,
  language = 'en',
  setupState,
  torrentConfig,
  torrentConnected,
  onClose,
  onDismissFirstLaunch,
  onRecheck,
  onStartInstall,
  onLaunchClient,
  onOpenOfficialDownload,
  onGeneratePassword,
  onSaveAndVerifyWebUi,
  onOpenSettings,
}: QbitSetupWizardModalProps) {
  const tr = getTranslations(language);
  const t = tr.qbitSetup;
  const ts = tr.settings;

  const [logoFailed, setLogoFailed] = useState(false);
  const [port, setPort] = useState<number>(torrentConfig.port || 8080);
  const [username, setUsername] = useState<string>(torrentConfig.username || 'admin');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingWebUi, setIsVerifyingWebUi] = useState(false);
  const [isLaunchingClient, setIsLaunchingClient] = useState(false);
  const [webUiTestResult, setWebUiTestResult] = useState<TorrentConnectionTestResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPort(
      setupState.webUiConfig.configFound && setupState.webUiConfig.port
        ? setupState.webUiConfig.port
        : torrentConfig.port || 8080
    );
    setUsername(
      (setupState.webUiConfig.configFound && setupState.webUiConfig.username) ||
        torrentConfig.username ||
        'admin'
    );
  }, [
    isOpen,
    setupState.webUiConfig.configFound,
    setupState.webUiConfig.port,
    setupState.webUiConfig.username,
    torrentConfig.port,
    torrentConfig.username,
  ]);

  if (!isOpen) return null;

  const isBusy =
    setupState.stage === 'checking_dependencies' ||
    setupState.stage === 'detecting_qbit' ||
    setupState.stage === 'fetching_release' ||
    setupState.stage === 'downloading' ||
    setupState.stage === 'verifying' ||
    setupState.stage === 'installing' ||
    setupState.stage === 'configuring';

  const currentRank = getStepRank(setupState.stage);
  const needsInstallOrUpdate =
    setupState.actionNeeded === 'install_required' ||
    setupState.actionNeeded === 'update_available';
  const showWebUiPanel = setupState.installed || setupState.stage === 'completed';
  const isVerifiedConnected = torrentConnected || Boolean(webUiTestResult?.ok);

  const stepLabels: Record<QbitSetupStage, string> = {
    idle: t.stepChecking,
    checking_dependencies: t.stepChecking,
    detecting_qbit: t.stepDetecting,
    fetching_release: t.stepDetecting,
    ready: t.stepDetecting,
    downloading: t.stepDownloading,
    verifying: t.stepVerifying,
    installing: t.stepInstalling,
    configuring: t.stepConfiguring,
    waiting_for_close: t.stepInstalling,
    completed: t.stepCompleted,
    error: t.stepChecking,
  };

  let statusDescription = t.statusNotInstalled;
  if (setupState.stage === 'error' && setupState.error) {
    statusDescription = setupState.error;
  } else if (setupState.actionNeeded === 'close_required_for_update') {
    statusDescription = t.statusRunningBlocked;
  } else if (setupState.actionNeeded === 'up_to_date') {
    statusDescription = t.statusUpToDate;
  } else if (setupState.actionNeeded === 'newer_installed') {
    statusDescription = t.statusNewerInstalled;
  } else if (setupState.actionNeeded === 'update_available') {
    statusDescription = t.statusUpdateAvailable;
  } else if (setupState.actionNeeded === 'unknown_latest') {
    statusDescription = setupState.releaseError || t.statusLookupFailed;
  }

  const handleGeneratePwd = async () => {
    const generated = await onGeneratePassword();
    if (generated) {
      setPassword(generated);
      setShowPassword(true);
    }
  };

  const handleVerifyWebUi = async () => {
    setIsVerifyingWebUi(true);
    setWebUiTestResult(null);
    try {
      const res = await onSaveAndVerifyWebUi({
        enabled: true,
        host: '127.0.0.1',
        port: Number(port) || 8080,
        username: username.trim() || 'admin',
        password,
      });
      if (res) {
        setWebUiTestResult(res);
      }
    } finally {
      setIsVerifyingWebUi(false);
    }
  };

  const handleLaunch = async () => {
    if (isLaunchingClient) return;
    setIsLaunchingClient(true);
    try {
      await onLaunchClient();
    } finally {
      setIsLaunchingClient(false);
    }
  };

  const handleSkipOrClose = () => {
    if (isBusy) return;
    if (!setupState.installed && !setupState.firstLaunchDismissed) {
      onDismissFirstLaunch();
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qbit-setup-modal-title"
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 dark:bg-black/75 backdrop-blur-sm overflow-y-auto"
    >
      <div className="sa-ps5-panel w-full max-w-2xl my-auto rounded-[var(--sa-card-radius)] bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="sa-icon-badge w-11 h-11 shrink-0 overflow-hidden p-1.5">
              {!logoFailed ? (
                <img
                  src={QBIT_OFFICIAL_LOGO_URL}
                  alt="qBittorrent logo"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Magnet className="w-5.5 h-5.5 text-[var(--sa-accent)]" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="qbit-setup-modal-title"
                className="font-display text-base sm:text-lg font-semibold tracking-normal text-slate-900 dark:text-white truncate"
              >
                {t.modalTitle}
              </h2>
              <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-snug">
                {t.modalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleSkipOrClose}
            aria-label={t.closeBtn}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-[#8b9bb4] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {!isDesktopApp && (
            <div className="p-3.5 rounded-[var(--sa-card-inner-radius)] bg-[var(--sa-accent-soft)] border border-[var(--sa-accent-ring)] text-[12px] text-[var(--sa-text-primary)]">
              {t.webPreviewNotice}
            </div>
          )}

          {/* Detected Environment Summary Strip */}
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#11161d] border border-slate-200 dark:border-white/[0.07]">
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-slate-500 dark:text-[#7f91a8]">
                {t.installedLabel}
              </dt>
              <dd className="mt-0.5 text-[13px] font-bold font-mono-tabular text-slate-900 dark:text-white truncate">
                {setupState.installed
                  ? setupState.installedVersion
                    ? `v${setupState.installedVersion}`
                    : 'qBittorrent'
                  : t.notInstalledValue}
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-slate-500 dark:text-[#7f91a8]">
                {t.latestLabel}
              </dt>
              <dd className="mt-0.5 text-[13px] font-bold font-mono-tabular text-[var(--sa-accent)] truncate">
                {setupState.latestRelease?.version
                  ? `v${setupState.latestRelease.version}`
                  : '—'}
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-slate-500 dark:text-[#7f91a8]">
                {t.processLabel}
              </dt>
              <dd
                className={`mt-0.5 text-[13px] font-bold truncate ${
                  setupState.isRunning
                    ? 'text-emerald-700 dark:text-[#4ade80]'
                    : 'text-slate-600 dark:text-[#9cb0c9]'
                }`}
              >
                {setupState.isRunning ? t.processRunning : t.processStopped}
              </dd>
            </div>
          </dl>

          {/* Status Message / Action Summary */}
          <div
            className={`p-3.5 rounded-xl border text-[12.5px] leading-relaxed flex items-start gap-2.5 ${
              setupState.stage === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200'
                : setupState.actionNeeded === 'close_required_for_update'
                ? 'bg-amber-50 dark:bg-amber-950/25 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200'
                : setupState.stage === 'completed' || setupState.actionNeeded === 'up_to_date' || setupState.actionNeeded === 'newer_installed'
                ? 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-500/35 text-emerald-900 dark:text-emerald-200'
                : 'bg-slate-50 dark:bg-[#121821] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#cbd6e4]'
            }`}
          >
            {setupState.stage === 'error' || setupState.actionNeeded === 'close_required_for_update' ? (
              <WarningCircle weight="fill" className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle weight="fill" className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-medium">{statusDescription}</p>
              {setupState.latestRelease?.assetName && (
                <p dir="ltr" className="text-[11.5px] font-mono-tabular opacity-80 truncate text-start">
                  {setupState.latestRelease.assetName}
                  {setupState.latestRelease.assetSizeBytes > 0
                    ? ` · ${formatBytes(setupState.latestRelease.assetSizeBytes)}`
                    : ''}
                </p>
              )}
            </div>
          </div>

          {/* 7-Step Setup Pipeline Checklist */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-[#11161d] border border-slate-200 dark:border-white/[0.07]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {ORDERED_STEPS.map((stepKey, idx) => {
                const isDone =
                  setupState.stage === 'completed' ||
                  (currentRank > idx && setupState.stage !== 'error');
                const isCurrent =
                  setupState.stage !== 'completed' &&
                  setupState.stage !== 'error' &&
                  currentRank === idx &&
                  isBusy;

                return (
                  <div
                    key={stepKey}
                    className={`flex items-center gap-2 text-[12px] ${
                      isDone
                        ? 'text-emerald-700 dark:text-[#4ade80] font-semibold'
                        : isCurrent
                        ? 'text-[var(--sa-accent)] font-semibold'
                        : 'text-slate-500 dark:text-[#7f91a8]'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle weight="fill" className="w-4 h-4 shrink-0" />
                    ) : isCurrent ? (
                      <SpinnerGap className="w-4 h-4 shrink-0 animate-spin" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-current/40 inline-flex items-center justify-center text-[10px] font-mono-tabular shrink-0">
                        {idx + 1}
                      </span>
                    )}
                    <span className="truncate">{stepLabels[stepKey]}</span>
                  </div>
                );
              })}
            </div>

            {/* Live Installer Download Progress Bar */}
            {setupState.stage === 'downloading' && setupState.downloadProgress && (
              <div className="pt-2 space-y-1.5 border-t border-slate-200 dark:border-white/[0.07]">
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-[#0b0f14] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--sa-accent)] to-[var(--sa-secondary)] transition-all duration-200"
                    style={{ width: `${Math.min(100, Math.max(0, setupState.downloadProgress.percent))}%` }}
                  />
                </div>
                <div
                  dir="ltr"
                  className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-mono-tabular text-slate-600 dark:text-[#9cb0c9]"
                >
                  <span>
                    {formatBytes(setupState.downloadProgress.downloadedBytes)} /{' '}
                    {setupState.downloadProgress.totalBytes > 0
                      ? formatBytes(setupState.downloadProgress.totalBytes)
                      : '—'}
                  </span>
                  <span>
                    {setupState.downloadProgress.percent.toFixed(1)}% · ↓{' '}
                    {formatDownloadSpeed(setupState.downloadProgress.speedBytesPerSec)} · ETA{' '}
                    {formatEta(setupState.downloadProgress.etaSeconds)}
                  </span>
                </div>
              </div>
            )}

            {/* Cryptographic Integrity & Signature Verification Readout */}
            {setupState.verification && (
              <div className="pt-2 border-t border-slate-200 dark:border-white/[0.07] space-y-1 text-[11.5px]">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-emerald-700 dark:text-[#4ade80] font-semibold">
                  {setupState.verification.sha256Verified && (
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck weight="fill" className="w-4 h-4 shrink-0" />
                      <span>{t.shaVerifiedLabel}</span>
                    </span>
                  )}
                  {setupState.verification.signatureVerified ? (
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck weight="fill" className="w-4 h-4 shrink-0" />
                      <span>
                        {t.sigVerifiedLabel}
                        {setupState.verification.publisher
                          ? ` (${setupState.verification.publisher})`
                          : ''}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-600 dark:text-[#9cb0c9] font-normal">
                      {t.unsignedVerifiedNote}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Consent Notice & Primary Install / Update Actions */}
          {isDesktopApp && needsInstallOrUpdate && (
            <div className="space-y-3">
              <p className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4] leading-relaxed">
                {t.consentNote}
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onStartInstall(true)}
                  className="sa-btn-primary inline-flex items-center gap-2 min-h-[42px] px-4 py-2 disabled:opacity-55 text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <DownloadSimple weight="bold" className="w-4 h-4 shrink-0" />
                  <span>
                    {setupState.actionNeeded === 'update_available' ? t.updateBtn : t.installBtn}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleSkipOrClose}
                  className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-[12.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{t.skipBtn}</span>
                </button>
              </div>
            </div>
          )}

          {/* Web UI Post-Install Configuration & Verification Section */}
          {isDesktopApp && showWebUiPanel && (
            <div className="p-4 rounded-[var(--sa-card-inner-radius)] bg-slate-50 dark:bg-[#11161d] border border-slate-200 dark:border-white/[0.08] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-white">
                  {t.webUiSectionTitle}
                </h3>
                <button
                  type="button"
                  disabled={isLaunchingClient}
                  onClick={() => void handleLaunch()}
                  className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 disabled:opacity-60 text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isLaunchingClient ? (
                    <SpinnerGap className="w-3.5 h-3.5 animate-spin text-[var(--sa-accent)]" />
                  ) : (
                    <Play weight="fill" className="w-3.5 h-3.5 text-emerald-600 dark:text-[#4ade80]" />
                  )}
                  <span>{t.launchQbitBtn}</span>
                </button>
              </div>

              {isVerifiedConnected ? (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/35 text-[12px] font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle weight="fill" className="w-4 h-4 shrink-0" />
                  <span>{t.webUiConnectedMsg}</span>
                </div>
              ) : (
                <>
                  <p className="text-[12px] text-slate-600 dark:text-[#9cb0c9] leading-relaxed">
                    {setupState.webUiConfig.webUiEnabled
                      ? t.webUiDetectedEnabled
                      : t.webUiNotEnabledHint}
                  </p>

                  {setupState.webUiConfig.configFound &&
                    setupState.webUiConfig.webUiEnabled &&
                    !setupState.webUiConfig.isLoopbackOnly && (
                      <p className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 text-[11.5px] text-amber-800 dark:text-amber-200">
                        {t.webUiLoopbackWarning}
                      </p>
                    )}

                  {!setupState.webUiConfig.webUiEnabled && (
                    <ol className="space-y-1 text-[11.5px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                      <li>{t.webUiGuide1}</li>
                      <li>{t.webUiGuide2}</li>
                      <li>{t.webUiGuide3}</li>
                      <li>{t.webUiGuide4}</li>
                      <li>{t.webUiGuide5}</li>
                    </ol>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#b8c6d8]">
                        {ts.torrentPortLabel} (127.0.0.1)
                      </label>
                      <input
                        type="number"
                        dir="ltr"
                        min={1}
                        max={65535}
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value) || 8080)}
                        className="sa-search-input w-full min-h-[38px] px-2.5 py-1.5 text-[12px] font-mono-tabular"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#b8c6d8]">
                        {ts.torrentUsernameLabel}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        className="sa-search-input w-full min-h-[38px] px-2.5 py-1.5 text-[12px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#b8c6d8]">
                        {ts.torrentPasswordLabel}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          dir="ltr"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={
                            torrentConfig.hasSavedPassword
                              ? ts.torrentPasswordSavedPlaceholder
                              : '••••••••'
                          }
                          className="sa-search-input w-full min-h-[38px] ps-2.5 pe-9 py-1.5 text-[12px]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {webUiTestResult && !webUiTestResult.ok && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/40 text-[11.5px] text-rose-800 dark:text-rose-200 space-y-0.5">
                      <p className="font-semibold">{webUiTestResult.message}</p>
                      {webUiTestResult.hint && <p className="opacity-90">{webUiTestResult.hint}</p>}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleGeneratePwd}
                      className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 text-[var(--sa-accent)]" />
                      <span>{t.generatePasswordBtn}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isVerifyingWebUi}
                      onClick={handleVerifyWebUi}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isVerifyingWebUi ? t.verifyingBtn : t.saveAndVerifyBtn}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/75 dark:bg-[#12171f]">
          <button
            type="button"
            onClick={onOpenOfficialDownload}
            title={QBIT_OFFICIAL_DOWNLOAD_URL}
            className="sa-link inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-[var(--sa-btn-radius)] text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowSquareOut className="w-3.5 h-3.5" />
            <span>{t.officialDownloadBtn}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {isDesktopApp &&
              (setupState.stage === 'error' ||
                setupState.actionNeeded === 'close_required_for_update' ||
                !needsInstallOrUpdate) && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    setupState.stage === 'error' && needsInstallOrUpdate
                      ? onStartInstall(true)
                      : onRecheck()
                  }
                  className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 disabled:opacity-50 text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowClockwise className="w-3.5 h-3.5" />
                  <span>
                    {setupState.stage === 'error' ? t.retryBtn : t.recheckBtn}
                  </span>
                </button>
              )}

            {onOpenSettings && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 disabled:opacity-50 text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.openSettingsBtn}</span>
              </button>
            )}

            <button
              type="button"
              disabled={isBusy}
              onClick={handleSkipOrClose}
              className="sa-btn-primary inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 disabled:opacity-50 text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t.closeBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
