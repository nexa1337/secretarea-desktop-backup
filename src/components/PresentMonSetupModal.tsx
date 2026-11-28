import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  DownloadSimple,
  Gauge,
  ShieldCheck,
  SpinnerGap,
  WarningCircle,
  Wrench,
  X,
} from '@phosphor-icons/react';
import type { PresentMonSetupState } from '../types';
import type { AppLanguage } from '../services/launcherSettings';
import { getTranslations } from '../i18n/translations';
import { formatBytes, formatDownloadSpeed, formatEta } from '../services/downloadManager';

interface PresentMonSetupModalProps {
  isOpen: boolean;
  isDesktopApp: boolean;
  language?: AppLanguage;
  setupState: PresentMonSetupState;
  onClose: () => void;
  onDismiss: (declinePermanently: boolean) => void;
  onCheckUpdates: () => Promise<void> | void;
  onStartInstallOrUpdate: (
    userConfirmed: boolean,
    mode?: 'auto' | 'install' | 'update' | 'repair' | 'reinstall'
  ) => Promise<void> | void;
  onCancelOperation: () => void;
  onOpenOfficialReleases: () => void;
}

export function PresentMonSetupModal({
  isOpen,
  isDesktopApp,
  language = 'en',
  setupState,
  onClose,
  onDismiss,
  onCheckUpdates,
  onStartInstallOrUpdate,
  onCancelOperation,
  onOpenOfficialReleases,
}: PresentMonSetupModalProps) {
  if (!isOpen) return null;

  const tr = getTranslations(language);
  const t = tr.presentMonSetup;

  const isBusy =
    setupState.stage === 'checking' ||
    setupState.stage === 'downloading' ||
    setupState.stage === 'verifying' ||
    setupState.stage === 'installing';

  const isDownloading = setupState.stage === 'downloading';
  const isInstallNeeded = setupState.actionNeeded === 'install_required';
  const isUpdateNeeded =
    setupState.actionNeeded === 'update_available' ||
    setupState.actionNeeded === 'close_required_for_update';
  const isRepairNeeded = setupState.actionNeeded === 'repair_required';
  const isUpToDate =
    setupState.actionNeeded === 'up_to_date' || setupState.actionNeeded === 'newer_installed';

  let modalTitle = t.modalTitleManage;
  if (isInstallNeeded) modalTitle = t.modalTitleInstall;
  else if (isUpdateNeeded) modalTitle = t.modalTitleUpdate;
  else if (isRepairNeeded) modalTitle = t.modalTitleRepair;

  let activeStepMessage = '';
  if (setupState.stage === 'checking') activeStepMessage = t.stepChecking;
  else if (setupState.stage === 'downloading') activeStepMessage = t.stepDownloading;
  else if (setupState.stage === 'verifying') activeStepMessage = t.stepVerifying;
  else if (setupState.stage === 'installing') activeStepMessage = t.stepInstalling;
  else if (setupState.stage === 'completed') activeStepMessage = t.stepCompleted;
  else if (setupState.stage === 'cancelled') activeStepMessage = t.stepCancelled;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="presentmon-setup-modal-title"
      className="fixed inset-0 z-[92] flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 dark:bg-black/75 backdrop-blur-sm overflow-y-auto"
    >
      <div className="sa-ps5-panel w-full max-w-xl my-auto rounded-[var(--sa-card-radius)] bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="sa-icon-badge w-11 h-11 shrink-0">
              <Gauge className="w-5.5 h-5.5" />
            </div>
            <div className="min-w-0">
              <h2
                id="presentmon-setup-modal-title"
                className="font-display text-base sm:text-lg font-semibold tracking-normal text-slate-900 dark:text-white truncate"
              >
                {modalTitle}
              </h2>
              <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-snug">
                {t.modalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              if (!isUpToDate && !isBusy) {
                onDismiss(false);
              }
              onClose();
            }}
            aria-label={tr.detail.close}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-[#8b9bb4] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-4 space-y-4">
          {!isDesktopApp && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-200 dark:border-amber-400/25 px-3.5 py-2.5 text-[12px] text-amber-900 dark:text-amber-200">
              {t.statusWebPreview}
            </div>
          )}

          {/* Version & Path Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sa-ps5-subpanel rounded-xl bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.07] p-3">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-[#8b9bb4]">
                {t.installedVersionLabel}
              </div>
              <div dir="ltr" className="mt-0.5 text-[13.5px] font-bold font-mono-tabular text-slate-900 dark:text-white truncate">
                {setupState.installedVersion ? `v${setupState.installedVersion}` : t.notInstalledValue}
              </div>
            </div>

            <div className="sa-ps5-subpanel rounded-xl bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.07] p-3">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-[#8b9bb4]">
                {t.latestVersionLabel}
              </div>
              <div dir="ltr" className="mt-0.5 text-[13.5px] font-bold font-mono-tabular text-[var(--sa-accent)] truncate">
                {setupState.latestRelease?.version
                  ? `v${setupState.latestRelease.version}`
                  : setupState.stage === 'checking'
                  ? t.checkingBtn
                  : tr.hardware.naValue}
              </div>
            </div>

            <div className="sa-ps5-subpanel rounded-xl bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.07] p-3">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-[#8b9bb4]">
                {t.downloadSizeLabel}
              </div>
              <div dir="ltr" className="mt-0.5 text-[13.5px] font-bold font-mono-tabular text-slate-900 dark:text-white truncate">
                {setupState.latestRelease?.assetSizeBytes
                  ? formatBytes(setupState.latestRelease.assetSizeBytes)
                  : tr.hardware.naValue}
              </div>
            </div>
          </div>

          {setupState.executablePath && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.07] px-3.5 py-2.5 flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8b9bb4]">
                {t.installPathLabel}
              </span>
              <span dir="ltr" className="text-[11.5px] font-mono-tabular text-slate-800 dark:text-[#cbd5e1] break-all">
                {setupState.executablePath}
              </span>
            </div>
          )}

          {/* Corruption / Conflict / Error Alerts */}
          {isRepairNeeded && setupState.healthIssue && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-300 dark:border-amber-400/30 p-3.5 flex items-start gap-2.5 text-[12px]">
              <Wrench className="w-4.5 h-4.5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-amber-900 dark:text-amber-200">
                <div className="font-bold">{t.statusRepairRequired}</div>
                <div>
                  {t.corruptedIssuePrefix}: {setupState.healthIssue}
                </div>
              </div>
            </div>
          )}

          {setupState.actionNeeded === 'close_required_for_update' && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-300 dark:border-amber-400/30 p-3.5 flex items-start gap-2.5 text-[12px] text-amber-900 dark:text-amber-200">
              <WarningCircle className="w-4.5 h-4.5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <span>{t.runningConflictMsg}</span>
            </div>
          )}

          {setupState.stage === 'error' && setupState.error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-500/[0.08] border border-rose-300 dark:border-rose-400/30 p-3.5 flex items-start gap-2.5 text-[12px] text-rose-900 dark:text-rose-200">
              <WarningCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{setupState.error}</span>
            </div>
          )}

          {setupState.releaseError && setupState.stage !== 'error' && !setupState.latestRelease && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-300 dark:border-amber-400/30 p-3 text-[12px] text-amber-900 dark:text-amber-200">
              {t.lookupErrorMsg} ({setupState.releaseError})
            </div>
          )}

          {/* Active Operation Progress & Verification */}
          {(isBusy || setupState.stage === 'completed' || setupState.stage === 'cancelled') && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.08] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-slate-900 dark:text-white">
                <span className="inline-flex items-center gap-2">
                  {isBusy ? (
                    <SpinnerGap className="w-4 h-4 text-[var(--sa-accent)] motion-safe:animate-spin shrink-0" />
                  ) : setupState.stage === 'completed' ? (
                    <CheckCircle weight="fill" className="w-4 h-4 text-emerald-600 dark:text-[#34d399] shrink-0" />
                  ) : (
                    <WarningCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <span>{activeStepMessage || setupState.statusMessage}</span>
                </span>

                {isDownloading && setupState.downloadProgress && (
                  <span dir="ltr" className="font-mono-tabular text-[12px] text-[var(--sa-accent)]">
                    {setupState.downloadProgress.percent.toFixed(1)}%
                  </span>
                )}
              </div>

              {isDownloading && setupState.downloadProgress && (
                <>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--sa-accent)] to-[var(--sa-secondary)] transition-[width] duration-150"
                      style={{ width: `${Math.min(100, Math.max(0, setupState.downloadProgress.percent))}%` }}
                    />
                  </div>
                  <div
                    dir="ltr"
                    className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-500 dark:text-[#8b9bb4]"
                  >
                    <span>
                      {formatBytes(setupState.downloadProgress.downloadedBytes)} /{' '}
                      {setupState.downloadProgress.totalBytes > 0
                        ? formatBytes(setupState.downloadProgress.totalBytes)
                        : '—'}
                    </span>
                    <span>
                      {formatDownloadSpeed(setupState.downloadProgress.speedBytesPerSec)} · ETA{' '}
                      {formatEta(setupState.downloadProgress.etaSeconds)}
                    </span>
                  </div>
                </>
              )}

              {setupState.verification && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {setupState.verification.sha256Verified && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/12 border border-emerald-500/30 text-[11px] font-semibold text-emerald-700 dark:text-[#34d399]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{t.shaVerifiedLabel}</span>
                    </span>
                  )}
                  {setupState.verification.signatureVerified && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--sa-accent-soft)] border border-[var(--sa-accent-ring)] text-[11px] font-semibold text-[var(--sa-accent)]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{t.sigVerifiedLabel}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Benefits list for first install or repair */}
          {(isInstallNeeded || isRepairNeeded) && setupState.stage !== 'completed' && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.07] p-3.5 space-y-2">
              <div className="text-[12px] font-bold text-slate-900 dark:text-white">
                {t.benefitsHeading}
              </div>
              <ul className="space-y-1.5 text-[12px] text-slate-600 dark:text-[#9cb0c9]">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[var(--sa-accent)] shrink-0 mt-0.5" />
                  <span>{t.benefit1}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[var(--sa-accent)] shrink-0 mt-0.5" />
                  <span>{t.benefit2}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[var(--sa-accent)] shrink-0 mt-0.5" />
                  <span>{t.benefit3}</span>
                </li>
              </ul>
            </div>
          )}

          <p className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4] leading-relaxed">
            {t.consentNote}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50/80 dark:bg-[#11161d] border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onOpenOfficialReleases}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-900 dark:text-[#8b9bb4] dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowSquareOut className="w-3.5 h-3.5" />
            <span>{t.officialReleasesBtn}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 ms-auto">
            {isDownloading ? (
              <button
                type="button"
                onClick={onCancelOperation}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-semibold transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.cancelDownloadBtn}</span>
              </button>
            ) : (
              <>
                {isDesktopApp && (!setupState.latestRelease || isUpToDate || setupState.stage === 'completed') && (
                  <>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onCheckUpdates()}
                      className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-[12px] font-semibold disabled:opacity-45 cursor-pointer"
                    >
                      <ArrowClockwise className={`w-4 h-4 ${isBusy ? 'motion-safe:animate-spin' : ''}`} />
                      <span>{t.checkUpdatesBtn}</span>
                    </button>
                    {(isUpToDate || setupState.stage === 'completed') && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onStartInstallOrUpdate(true, 'reinstall')}
                        className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-[12px] font-semibold disabled:opacity-45 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>{t.reinstallBtn}</span>
                      </button>
                    )}
                  </>
                )}

                {!isBusy && (isInstallNeeded || isUpdateNeeded || isRepairNeeded) && (
                  <button
                    type="button"
                    onClick={() => {
                      onDismiss(isInstallNeeded || isRepairNeeded);
                      onClose();
                    }}
                    className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-[12.5px] font-semibold cursor-pointer"
                  >
                    <span>{isUpdateNeeded ? t.laterBtn : t.notNowBtn}</span>
                  </button>
                )}

                {isDesktopApp && isInstallNeeded && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onStartInstallOrUpdate(true, 'install')}
                    className="sa-btn-primary inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-[12.5px] font-bold disabled:opacity-45 cursor-pointer"
                  >
                    <DownloadSimple className="w-4 h-4" />
                    <span>{setupState.stage === 'error' ? t.retryBtn : t.allowInstallBtn}</span>
                  </button>
                )}

                {isDesktopApp && isUpdateNeeded && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onStartInstallOrUpdate(true, 'update')}
                    className="sa-btn-primary inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-[12.5px] font-bold disabled:opacity-45 cursor-pointer"
                  >
                    <DownloadSimple className="w-4 h-4" />
                    <span>{setupState.stage === 'error' ? t.retryBtn : t.updateNowBtn}</span>
                  </button>
                )}

                {isDesktopApp && isRepairNeeded && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onStartInstallOrUpdate(true, 'repair')}
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[12.5px] font-bold disabled:opacity-45 transition-colors cursor-pointer"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>{setupState.stage === 'error' ? t.retryBtn : t.repairBtn}</span>
                  </button>
                )}

                {(isUpToDate || setupState.stage === 'completed' || !isDesktopApp) && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-bold disabled:opacity-45 transition-colors cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{t.doneBtn}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
