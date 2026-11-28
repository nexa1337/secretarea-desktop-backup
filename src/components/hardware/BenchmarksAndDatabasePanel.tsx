import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowClockwise,
  Database,
  Gauge,
  Play,
  ShieldWarning,
  Stop,
  UploadSimple,
} from '@phosphor-icons/react';
import type {
  BenchmarkMetricResult,
  BenchmarkRunProgress,
  HardwareDbCategory,
  HardwareDbEntry,
  HardwareDbState,
} from '../../types';
import { getDesktopHardwareIntelligenceBridge } from '../../services/hardwareMonitor';
import { runSafeBrowserMicroBenchmark } from '../../services/hardwareIntelligence';
import { ExpandablePanel } from './SharedIntelligenceUi';

interface BenchmarksAndDatabasePanelProps {
  isDesktopApp: boolean;
  dbState: HardwareDbState;
  dbEntries: HardwareDbEntry[];
  onDbUpdated: (state: HardwareDbState, customEntries: HardwareDbEntry[]) => void;
  t: Record<string, string>;
}

const DESKTOP_BENCH_TESTS = [
  { id: 'cpu_single', labelKey: 'benchCpuSingle' },
  { id: 'cpu_multi', labelKey: 'benchCpuMulti' },
  { id: 'ram_throughput', labelKey: 'benchRamThroughput' },
  { id: 'storage_seq', labelKey: 'benchStorageSeq' },
  { id: 'storage_4k', labelKey: 'benchStorage4k' },
  { id: 'network_latency', labelKey: 'benchNetLatency' },
] as const;

export function BenchmarksAndDatabasePanel({
  isDesktopApp,
  dbState,
  dbEntries,
  onDbUpdated,
  t,
}: BenchmarksAndDatabasePanelProps) {
  const [selectedTests, setSelectedTests] = useState<string[]>([
    'cpu_single',
    'cpu_multi',
    'ram_throughput',
    'network_latency',
  ]);
  const [benchProgress, setBenchProgress] = useState<BenchmarkRunProgress>({
    running: false,
    activeTestId: null,
    progressPercent: 0,
    statusMessage: '',
    currentTempC: null,
    abortedReason: null,
  });
  const [benchResults, setBenchResults] = useState<BenchmarkMetricResult[]>([]);

  const [dbCategory, setDbCategory] = useState<HardwareDbCategory | 'all'>('all');
  const [dbSearch, setDbSearch] = useState('');
  const [feedUrl, setFeedUrl] = useState(dbState.updateFeedUrl);
  const [customFeedConsented, setCustomFeedConsented] = useState(false);
  const [dbStatusMsg, setDbStatusMsg] = useState<string | null>(null);
  const [isUpdatingDb, setIsUpdatingDb] = useState(false);
  const webAbortRef = useRef<AbortController | null>(null);

  const OFFICIAL_FEED_URL = 'https://raw.githubusercontent.com/secretarea1337/secretarea-desktop/main/hardware-db.json';
  const isCustomFeedUrl =
    feedUrl.trim().length > 0 &&
    feedUrl.trim() !== OFFICIAL_FEED_URL &&
    feedUrl.trim() !== dbState.updateFeedUrl;

  useEffect(() => {
    setFeedUrl(dbState.updateFeedUrl);
    setCustomFeedConsented(false);
  }, [dbState.updateFeedUrl]);

  useEffect(() => {
    const bridge = getDesktopHardwareIntelligenceBridge();
    if (!isDesktopApp || !bridge) return;
    const unsub = bridge.onBenchmarkProgress((prog) => {
      setBenchProgress(prog);
    });
    return unsub;
  }, [isDesktopApp]);

  useEffect(() => {
    return () => {
      webAbortRef.current?.abort();
    };
  }, []);

  const toggleTestSelection = (id: string) => {
    setSelectedTests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRunBenchmarks = async () => {
    if (selectedTests.length === 0) return;
    const bridge = getDesktopHardwareIntelligenceBridge();

    if (isDesktopApp && bridge) {
      setBenchProgress({
        running: true,
        activeTestId: selectedTests[0],
        progressPercent: 5,
        statusMessage: t.benchStarting,
        currentTempC: null,
        abortedReason: null,
      });
      const res = await bridge.runBenchmark(selectedTests);
      if (res?.results) {
        setBenchResults(res.results);
      }
      setBenchProgress((prev) => ({
        ...prev,
        running: false,
        progressPercent: 100,
        abortedReason: res?.abortedForSafety ? t.benchAbortedThermal : null,
      }));
      return;
    }

    // Web Preview safe micro-benchmarks (cancellable non-blocking async / Web Worker)
    webAbortRef.current?.abort();
    const controller = new AbortController();
    webAbortRef.current = controller;

    setBenchProgress({
      running: true,
      activeTestId: 'cpu_single',
      progressPercent: 10,
      statusMessage: t.benchRunningWeb,
      currentTempC: null,
      abortedReason: null,
    });
    const out: BenchmarkMetricResult[] = [];
    const webTests: Array<'cpu_single' | 'webgl_frame' | 'network_latency'> = [
      'cpu_single',
      'webgl_frame',
      'network_latency',
    ];
    for (let i = 0; i < webTests.length; i++) {
      if (controller.signal.aborted) break;
      setBenchProgress({
        running: true,
        activeTestId: webTests[i],
        progressPercent: Math.round(((i + 0.5) / webTests.length) * 100),
        statusMessage: `Running ${webTests[i]}...`,
        currentTempC: null,
        abortedReason: null,
      });
      const metric = await runSafeBrowserMicroBenchmark(webTests[i], { signal: controller.signal });
      if (metric.cancelled || controller.signal.aborted) {
        setBenchProgress({
          running: false,
          activeTestId: null,
          progressPercent: 100,
          statusMessage: t.benchCancelled,
          currentTempC: null,
          abortedReason: null,
        });
        return;
      }
      out.push(metric);
    }
    setBenchResults(out);
    setBenchProgress({
      running: false,
      activeTestId: null,
      progressPercent: 100,
      statusMessage: controller.signal.aborted ? t.benchCancelled : t.benchCompleted,
      currentTempC: null,
      abortedReason: null,
    });
  };

  const handleCancelBenchmark = async () => {
    const bridge = getDesktopHardwareIntelligenceBridge();
    if (isDesktopApp && bridge) {
      await bridge.cancelBenchmark();
      return;
    }
    webAbortRef.current?.abort();
    setBenchProgress((prev) => ({
      ...prev,
      running: false,
      activeTestId: null,
      statusMessage: t.benchCancelled,
    }));
  };

  const handleCheckDbUpdate = async () => {
    const bridge = getDesktopHardwareIntelligenceBridge();
    if (!isDesktopApp || !bridge) {
      setDbStatusMsg(t.dbWebOfflineNote);
      return;
    }
    if (isCustomFeedUrl && !customFeedConsented) {
      setDbStatusMsg(t.dbCustomFeedConsentLabel);
      return;
    }
    setIsUpdatingDb(true);
    setDbStatusMsg(null);
    try {
      const res = await bridge.checkDbUpdate(
        feedUrl,
        isCustomFeedUrl ? { allowCustomFeed: customFeedConsented } : undefined
      );
      if (res) {
        const entries = await bridge.getDbEntries();
        onDbUpdated(res.state, entries || []);
        setDbStatusMsg(res.updated ? t.dbUpdateApplied : res.error || t.dbUpToDate);
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleImportDbFile = async () => {
    const bridge = getDesktopHardwareIntelligenceBridge();
    if (!isDesktopApp || !bridge) return;
    setIsUpdatingDb(true);
    setDbStatusMsg(null);
    try {
      const res = await bridge.importDbFile();
      if (res && !res.canceled) {
        const entries = await bridge.getDbEntries();
        onDbUpdated(res.state, entries || []);
        setDbStatusMsg(res.imported ? t.dbImportSuccess : res.error || 'Import failed.');
      }
    } finally {
      setIsUpdatingDb(false);
    }
  };

  const handleRollbackDb = async () => {
    const bridge = getDesktopHardwareIntelligenceBridge();
    if (!isDesktopApp || !bridge) return;
    const res = await bridge.rollbackDb();
    if (res) {
      const entries = await bridge.getDbEntries();
      onDbUpdated(res.state, entries || []);
      setDbStatusMsg(res.ok ? t.dbRollbackSuccess : res.error || 'Rollback unavailable.');
    }
  };

  const filteredDbEntries = useMemo(() => {
    const q = dbSearch.trim().toLowerCase();
    return dbEntries.filter((e) => {
      if (dbCategory !== 'all' && e.category !== dbCategory) return false;
      if (!q) return true;
      return (
        e.family.toLowerCase().includes(q) ||
        e.vendor.toLowerCase().includes(q) ||
        e.generation.toLowerCase().includes(q) ||
        e.architecture.toLowerCase().includes(q)
      );
    });
  }, [dbEntries, dbCategory, dbSearch]);

  return (
    <div className="space-y-4">
      {/* 1. Safe Optional Micro-Benchmarks */}
      <ExpandablePanel
        title={t.benchTitle}
        subtitle={t.benchSubtitle}
        icon={<Gauge className="w-4.5 h-4.5" />}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50/80 dark:bg-amber-500/[0.08] border border-amber-200 dark:border-amber-400/25 px-3.5 py-2.5 flex items-start gap-2.5 text-[12px] text-amber-900 dark:text-amber-200">
            <ShieldWarning className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{t.benchSafetyNotice}</p>
          </div>

          {isDesktopApp && (
            <div className="flex flex-wrap gap-2">
              {DESKTOP_BENCH_TESTS.map((item) => {
                const checked = selectedTests.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={checked}
                    disabled={benchProgress.running}
                    onClick={() => toggleTestSelection(item.id)}
                    className={`px-3 py-1.5 rounded-[var(--sa-btn-radius)] text-[12px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
                      checked
                        ? 'bg-[var(--sa-accent)] border-[var(--sa-secondary)] text-[var(--sa-accent-fg)] shadow-xs'
                        : 'bg-slate-50 dark:bg-[#10151c] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#cbd5e1] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {t[item.labelKey] || item.id}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={benchProgress.running || (isDesktopApp && selectedTests.length === 0)}
              onClick={() => void handleRunBenchmarks()}
              className="sa-btn-primary inline-flex items-center gap-1.5 min-h-[36px] px-4 py-1.5 text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Play weight="fill" className="w-3.5 h-3.5" />
              <span>{isDesktopApp ? t.benchStartBtn : t.benchStartWebBtn}</span>
            </button>

            {benchProgress.running && (
              <button
                type="button"
                onClick={() => void handleCancelBenchmark()}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
              >
                <Stop weight="fill" className="w-3.5 h-3.5" />
                <span>{t.benchCancelBtn}</span>
              </button>
            )}

            {benchProgress.statusMessage && (
              <span className="text-[12px] text-slate-600 dark:text-[#9cb0c9]">
                {benchProgress.statusMessage}
                {benchProgress.currentTempC !== null ? ` (${benchProgress.currentTempC} °C)` : ''}
              </span>
            )}
          </div>

          {benchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {benchResults.map((r) => (
                <div
                  key={r.id}
                  className="sa-ps5-subpanel rounded-lg bg-slate-50 dark:bg-[#10151c] border border-slate-200/80 dark:border-white/[0.06] p-3.5 space-y-1"
                >
                  <div className="text-[12px] font-bold text-slate-500 dark:text-[#8b9bb4]">{r.label}</div>
                  <div dir="ltr" className="text-[20px] font-display font-bold font-mono-tabular text-[var(--sa-accent)]">
                    {r.value !== null ? `${r.value} ${r.unit}` : t.naValue}
                  </div>
                  <p className="text-[11.5px] text-slate-600 dark:text-[#9cb0c9] leading-snug">{r.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </ExpandablePanel>

      {/* 2. Hardware Generation Database & Independent Auto-Updater */}
      <ExpandablePanel
        title={t.dbTitle}
        subtitle={`${t.dbVersionLabel}: ${dbState.dbVersion} · ${dbEntries.length} ${t.dbEntriesLabel}`}
        icon={<Database className="w-4.5 h-4.5" />}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 dark:bg-[#10151c] border border-slate-200/80 dark:border-white/[0.06] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="text-slate-600 dark:text-[#9cb0c9]">
                {t.dbSourceLabel}: <strong className="text-slate-900 dark:text-white">{dbState.sourceLabel}</strong>
              </span>
              <span dir="ltr" className="font-mono-tabular text-slate-500 dark:text-[#8b9bb4]">
                {t.lastUpdatedLabel}: {dbState.lastUpdatedAt.slice(0, 10)}
              </span>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
              <input
                type="url"
                value={feedUrl}
                onChange={(e) => {
                  setFeedUrl(e.target.value);
                  setCustomFeedConsented(false);
                }}
                disabled={!isDesktopApp}
                dir="ltr"
                placeholder="https://.../hardware-db.json"
                className="sa-search-input flex-1 min-h-[36px] px-3 py-1.5 text-[12px] font-mono-tabular disabled:opacity-60"
              />
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isUpdatingDb || (isDesktopApp && isCustomFeedUrl && !customFeedConsented)}
                  onClick={() => void handleCheckDbUpdate()}
                  className="sa-btn-primary inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <ArrowClockwise className={`w-4 h-4 ${isUpdatingDb ? 'motion-safe:animate-spin' : ''}`} />
                  <span>{t.dbCheckUpdateBtn}</span>
                </button>
                {isDesktopApp && (
                  <button
                    type="button"
                    disabled={isUpdatingDb}
                    onClick={() => void handleImportDbFile()}
                    className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    <UploadSimple className="w-4 h-4" />
                    <span>{t.dbImportJsonBtn}</span>
                  </button>
                )}
                {isDesktopApp && dbState.hasBackup && (
                  <button
                    type="button"
                    onClick={() => void handleRollbackDb()}
                    className="sa-btn-secondary min-h-[36px] px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap cursor-pointer"
                  >
                    {t.dbRollbackBtn}
                  </button>
                )}
              </div>
            </div>

            {isDesktopApp && isCustomFeedUrl && (
              <label className="flex items-start gap-2 text-[11.5px] text-amber-800 dark:text-amber-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customFeedConsented}
                  onChange={(e) => setCustomFeedConsented(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-white/20 accent-[var(--sa-accent)]"
                />
                <span>{t.dbCustomFeedConsentLabel}</span>
              </label>
            )}

            {dbStatusMsg && (
              <div className="text-[12px] font-medium text-[var(--sa-accent)]">{dbStatusMsg}</div>
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'cpu', 'gpu', 'ram', 'storage', 'chipset_platform', 'network'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={dbCategory === cat}
                  onClick={() => setDbCategory(cat)}
                  className={`px-2.5 py-1 rounded-[var(--sa-btn-radius)] text-[11.5px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    dbCategory === cat
                      ? 'bg-[var(--sa-accent)] border-[var(--sa-secondary)] text-[var(--sa-accent-fg)] shadow-xs'
                      : 'bg-slate-50 dark:bg-[#10151c] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#cbd5e1] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {cat.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={dbSearch}
              onChange={(e) => setDbSearch(e.target.value)}
              placeholder={t.dbSearchPlaceholder}
              className="sa-search-input min-h-[34px] px-3 py-1 text-[12px] w-full sm:w-64"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredDbEntries.map((entry) => (
              <div
                key={entry.id}
                className="sa-ps5-subpanel rounded-lg bg-slate-50 dark:bg-[#10151c] border border-slate-200/80 dark:border-white/[0.06] p-3.5 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--sa-accent)]">
                      {entry.vendor} · {entry.category.replace('_', ' ')} · {entry.releaseYear}
                    </span>
                    <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-white truncate">{entry.family}</h4>
                  </div>
                  <span dir="ltr" className="text-[11px] font-mono-tabular font-bold text-slate-600 dark:text-[#cbd5e1] shrink-0">
                    2030: {entry.suitability2030Score}%
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-[#9cb0c9] leading-snug">{entry.specsSummary}</p>
                {entry.limitations.length > 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                    {entry.limitations[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </ExpandablePanel>
    </div>
  );
}
