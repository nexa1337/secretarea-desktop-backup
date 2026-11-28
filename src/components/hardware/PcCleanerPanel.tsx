import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import type {
  CleanerCategoryScan,
  CleanerCleanResult,
  CleanerProgressEvent,
  CleanerScanResult,
} from '../../types';
import type { AppLanguage } from '../../services/launcherSettings';
import { getTranslations } from '../../i18n/translations';
import {
  formatStorageBytes,
  getDesktopPcCleanerBridge,
} from '../../services/hardwareMonitor';

interface PcCleanerPanelProps {
  isDesktopApp: boolean;
  language: AppLanguage;
}

function getCategoryCopy(
  id: CleanerCategoryScan['id'],
  t: ReturnType<typeof getTranslations>['hardware']
) {
  switch (id) {
    case 'old_temp':
      return { title: t.cleanerCatOldTempTitle, desc: t.cleanerCatOldTempDesc };
    case 'user_temp':
      return { title: t.cleanerCatUserTempTitle, desc: t.cleanerCatUserTempDesc };
    case 'app_cache':
      return { title: t.cleanerCatAppCacheTitle, desc: t.cleanerCatAppCacheDesc };
    case 'secretarea_cache':
      return { title: t.cleanerCatSecretAreaCacheTitle, desc: t.cleanerCatSecretAreaCacheDesc };
    case 'thumbnail_cache':
      return { title: t.cleanerCatThumbnailTitle, desc: t.cleanerCatThumbnailDesc };
    case 'dx_shader_cache':
      return { title: t.cleanerCatShaderTitle, desc: t.cleanerCatShaderDesc };
    case 'recycle_bin':
      return { title: t.cleanerCatRecycleTitle, desc: t.cleanerCatRecycleDesc };
    case 'browser_cache':
      return { title: t.cleanerCatBrowserTitle, desc: t.cleanerCatBrowserDesc };
  }
}

export function PcCleanerPanel({ isDesktopApp, language }: PcCleanerPanelProps) {
  const t = getTranslations(language).hardware;
  const naLabel = t.naValue;
  const cleanerBridge = useMemo(() => getDesktopPcCleanerBridge(), []);

  const [scanResult, setScanResult] = useState<CleanerScanResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progressEvent, setProgressEvent] = useState<CleanerProgressEvent | null>(null);
  const [cleanResult, setCleanResult] = useState<CleanerCleanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isConfirmingClean, setIsConfirmingClean] = useState(false);

  useEffect(() => {
    if (!cleanerBridge) return;
    const unsubscribe = cleanerBridge.onProgress((evt) => {
      setProgressEvent(evt);
    });
    return () => {
      unsubscribe();
    };
  }, [cleanerBridge]);

  const handleScan = useCallback(async () => {
    if (!cleanerBridge || isScanning || isCleaning) return;
    setIsScanning(true);
    setCleanResult(null);
    setIsConfirmingClean(false);
    try {
      const res = await cleanerBridge.scan();
      if (res) {
        setScanResult(res);
        // Strictly check only safe default categories; keep opt-in unchecked!
        const defaults = new Set<string>(
          res.categories.filter((c) => c.defaultSelected && c.supported).map((c) => c.id)
        );
        setSelectedIds(defaults);
      }
    } finally {
      setIsScanning(false);
    }
  }, [cleanerBridge, isScanning, isCleaning]);

  const toggleCategory = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectSafeDefaults = useCallback(() => {
    if (!scanResult) return;
    setSelectedIds(
      new Set(scanResult.categories.filter((c) => c.defaultSelected && c.supported).map((c) => c.id))
    );
  }, [scanResult]);

  const selectedCategories = useMemo(() => {
    if (!scanResult) return [];
    return scanResult.categories.filter((c) => selectedIds.has(c.id));
  }, [scanResult, selectedIds]);

  const selectedBytes = useMemo(
    () => selectedCategories.reduce((sum, c) => sum + (c.estimatedBytes || 0), 0),
    [selectedCategories]
  );

  const selectedFilesCount = useMemo(
    () => selectedCategories.reduce((sum, c) => sum + (c.fileCount || 0), 0),
    [selectedCategories]
  );

  const handleConfirmClean = useCallback(async () => {
    if (!cleanerBridge || !scanResult || selectedCategories.length === 0 || isCleaning) return;
    setIsCleaning(true);
    setIsConfirmingClean(false);
    try {
      const res = await cleanerBridge.clean({
        categoryIds: selectedCategories.map((c) => c.id),
        confirmationToken: scanResult.confirmationToken,
      });
      if (res) {
        setCleanResult(res);
        // Re-scan automatically after cleanup so displayed estimates reflect actual remaining bytes
        const refreshed = await cleanerBridge.scan();
        if (refreshed) {
          setScanResult(refreshed);
          setSelectedIds(
            new Set(refreshed.categories.filter((c) => c.defaultSelected && c.supported).map((c) => c.id))
          );
        }
      }
    } finally {
      setIsCleaning(false);
    }
  }, [cleanerBridge, scanResult, selectedCategories, isCleaning]);

  const handleCancelClean = useCallback(async () => {
    setIsConfirmingClean(false);
    if (isCleaning && cleanerBridge) {
      await cleanerBridge.cancel();
    }
  }, [isCleaning, cleanerBridge]);

  return (
    <div className="space-y-5">
      {/* Header & Safety Guarantee */}
      <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs dark:shadow-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="sa-icon-badge w-9 h-9 flex items-center justify-center shrink-0">
              <Sparkle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-[16px] font-bold text-slate-900 dark:text-white">{t.cleanerTitle}</h2>
              <p className="text-[12.5px] text-slate-600 dark:text-[#9cb0c9]">{t.cleanerSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={!isDesktopApp || isScanning || isCleaning}
              onClick={() => void handleScan()}
              className="sa-btn-primary inline-flex items-center gap-2 min-h-[38px] px-4 py-2 text-[12.5px] font-bold disabled:opacity-45 cursor-pointer whitespace-nowrap"
            >
              <MagnifyingGlass className={`w-4 h-4 ${isScanning ? 'motion-safe:animate-pulse' : ''}`} />
              <span>{isScanning ? t.cleanerScanningBtn : t.cleanerScanBtn}</span>
            </button>

            {scanResult && (
              <button
                type="button"
                disabled={selectedCategories.length === 0 || isScanning || isCleaning}
                onClick={() => setIsConfirmingClean(true)}
                className="inline-flex items-center gap-2 min-h-[38px] px-4 py-2 rounded-[var(--sa-btn-radius)] bg-emerald-600 hover:bg-emerald-500 text-white text-[12.5px] font-bold transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                <Trash className="w-4 h-4" />
                <span>{isCleaning ? t.cleanerCleaningBtn : t.cleanerCleanBtn}</span>
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200 dark:border-emerald-400/25 px-3.5 py-2.5 flex items-start gap-2.5 text-[12px]">
          <ShieldCheck weight="fill" className="w-4.5 h-4.5 text-emerald-600 dark:text-[#34d399] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-emerald-900 dark:text-[#34d399]">
              {t.cleanerSafetyBannerTitle}
            </div>
            <p className="text-emerald-800/90 dark:text-emerald-200/80 leading-relaxed">
              {t.cleanerSafetyBannerDesc}
            </p>
          </div>
        </div>

        {/* Live Scan/Clean Progress */}
        {(isScanning || isCleaning) && progressEvent && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11.5px] text-slate-600 dark:text-[#9cb0c9]">
              <span>
                {isCleaning ? t.cleanerProgressCleaning : t.cleanerScanningBtn}{' '}
                {progressEvent.currentPath ? `— ${progressEvent.currentPath}` : ''}
              </span>
              <span dir="ltr" className="font-mono-tabular font-semibold">
                {progressEvent.percent}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
              <div
                className="h-full bg-[var(--sa-accent)] transition-[width] duration-200"
                style={{ width: `${Math.min(100, Math.max(0, progressEvent.percent))}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Post-Clean Summary Report */}
      {cleanResult && (
        <section className="rounded-xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200 dark:border-emerald-400/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-[#34d399] font-bold text-[14.5px]">
            <CheckCircle weight="fill" className="w-5 h-5 shrink-0" />
            <span>{t.cleanerReportTitle}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12.5px]">
            <div className="rounded-lg bg-white/80 dark:bg-[#11161d] border border-emerald-200/70 dark:border-white/[0.08] p-3">
              <div className="text-slate-500 dark:text-[#8b9bb4] text-[11px]">{t.cleanerReportFreed}</div>
              <div dir="ltr" className="text-[16px] font-bold font-mono-tabular text-emerald-700 dark:text-[#34d399]">
                {formatStorageBytes(cleanResult.cleanedBytes, '0 B')}
              </div>
            </div>
            <div className="rounded-lg bg-white/80 dark:bg-[#11161d] border border-emerald-200/70 dark:border-white/[0.08] p-3">
              <div className="text-slate-500 dark:text-[#8b9bb4] text-[11px]">{t.cleanerReportRemoved}</div>
              <div dir="ltr" className="text-[16px] font-bold font-mono-tabular text-slate-900 dark:text-white">
                {cleanResult.cleanedFiles.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg bg-white/80 dark:bg-[#11161d] border border-emerald-200/70 dark:border-white/[0.08] p-3">
              <div className="text-slate-500 dark:text-[#8b9bb4] text-[11px]">{t.cleanerReportSkipped}</div>
              <div dir="ltr" className="text-[16px] font-bold font-mono-tabular text-slate-900 dark:text-white">
                {cleanResult.skippedLockedCount.toLocaleString()}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Inline Explicit Confirmation Dialog */}
      {isConfirmingClean && scanResult && (
        <section className="rounded-xl bg-amber-50 dark:bg-amber-500/[0.09] border border-amber-300 dark:border-amber-400/35 p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <WarningCircle weight="fill" className="w-5 h-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-[14.5px] font-bold text-amber-950 dark:text-amber-200">
                {t.cleanerConfirmTitle}
              </h3>
              <p className="text-[12.5px] text-amber-900/90 dark:text-amber-200/85">
                {t.cleanerConfirmDesc}
              </p>
              <div dir="ltr" className="text-[12.5px] font-mono-tabular font-bold text-amber-950 dark:text-white pt-1">
                {selectedCategories.length} categories · {selectedFilesCount.toLocaleString()} files ·{' '}
                {formatStorageBytes(selectedBytes, '0 B')}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handleConfirmClean()}
              className="px-4 py-2 rounded-[var(--sa-btn-radius)] bg-rose-600 hover:bg-rose-500 text-white text-[12.5px] font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              {t.cleanerConfirmAction}
            </button>
            <button
              type="button"
              onClick={() => void handleCancelClean()}
              className="sa-btn-secondary px-4 py-2 text-[12.5px] font-semibold cursor-pointer whitespace-nowrap"
            >
              {t.cleanerCancelAction}
            </button>
          </div>
        </section>
      )}

      {/* Scan Categories List */}
      {scanResult && (
        <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs dark:shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="text-[13px] font-semibold text-slate-700 dark:text-[#d5e0ee]">
              {t.cleanerEstimatedTotal}:{' '}
              <strong dir="ltr" className="font-mono-tabular text-[var(--sa-accent)]">
                {formatStorageBytes(selectedBytes, '0 B')}
              </strong>
            </div>
            <button
              type="button"
              onClick={selectSafeDefaults}
              className="sa-btn-secondary px-3 py-1.5 text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
            >
              {t.cleanerSelectSafeDefaults}
            </button>
          </div>

          <div className="space-y-2.5">
            {scanResult.categories.map((cat) => {
              const copy = getCategoryCopy(cat.id, t);
              const checked = selectedIds.has(cat.id);

              return (
                <label
                  key={cat.id}
                  className={`sa-ps5-subpanel block rounded-lg border p-3.5 transition-colors ${
                    cat.supported
                      ? 'cursor-pointer bg-slate-50/90 dark:bg-[#11161d] border-slate-200/80 dark:border-white/[0.08] hover:border-[var(--sa-accent-ring)]'
                      : 'opacity-55 cursor-not-allowed bg-slate-50/50 dark:bg-[#11161d]/60 border-slate-200/50 dark:border-white/[0.05]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!cat.supported || isCleaning}
                        onChange={() => toggleCategory(cat.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 accent-[var(--sa-accent)]"
                      />
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-bold text-slate-900 dark:text-white">
                            {copy.title}
                          </span>
                          {cat.optInWarning && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                              {t.cleanerOptInBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-slate-600 dark:text-[#9cb0c9] leading-relaxed">
                          {copy.desc}
                        </p>
                        {cat.optInWarning && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300/85">
                            {t.cleanerOptInWarningDesc}
                          </p>
                        )}
                        {cat.paths.length > 0 && (
                          <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-[#7c8da6] break-all pt-0.5">
                            {t.cleanerPathsLabel}: {cat.paths.join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div dir="ltr" className="text-end shrink-0 font-mono-tabular">
                      <div className="text-[14px] font-bold text-slate-900 dark:text-white">
                        {cat.supported ? formatStorageBytes(cat.estimatedBytes, '0 B') : naLabel}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">
                        {cat.supported ? `${cat.fileCount.toLocaleString()} files` : ''}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
