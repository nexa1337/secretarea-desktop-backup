import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowClockwise,
  CheckCircle,
  GameController,
  Info,
  Pause,
  Play,
  Pulse,
  Thermometer,
  Trash,
  WarningCircle,
  WifiHigh,
} from '@phosphor-icons/react';
import type {
  GamingProcessCandidate,
  GamingSessionHistoryItem,
  GamingSessionState,
  HardwareMonitorSnapshot,
  PresentMonSetupState,
} from '../../types';
import type { AppLanguage } from '../../services/launcherSettings';
import { getTranslations } from '../../i18n/translations';
import {
  EMPTY_GAMING_SESSION_STATE,
  formatFps,
  formatFrameTimeMs,
  formatPercent,
  formatPingMs,
  formatTemperatureC,
  formatVramMB,
  getDesktopGamingMonitorBridge,
  isValidMetric,
  selectPrimaryGpu,
} from '../../services/hardwareMonitor';

interface GamingPerformancePanelProps {
  isDesktopApp: boolean;
  language: AppLanguage;
  snapshot: HardwareMonitorSnapshot;
  presentMonSetupState?: PresentMonSetupState;
  onOpenPresentMonManager?: () => void;
}

function formatSessionDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
}

function FrameTimeSparkline({
  values,
  naLabel,
  title,
}: {
  values: number[];
  naLabel: string;
  title: string;
}) {
  const svgWidth = 640;
  const svgHeight = 132;
  const pad = 10;
  const plotH = svgHeight - pad * 2;

  const { points, maxVal, avgVal } = useMemo(() => {
    if (!values.length) {
      return { points: '', maxVal: 50, avgVal: null };
    }
    const maxObserved = Math.max(...values, 16.7);
    const yMax = Math.ceil(maxObserved / 10) * 10 || 40;
    const stepX = values.length > 1 ? svgWidth / (values.length - 1) : svgWidth;
    const pts = values.map((v, idx) => {
      const x = (idx * stepX).toFixed(1);
      const ratio = Math.min(1, Math.max(0, v / yMax));
      const y = (pad + plotH * (1 - ratio)).toFixed(1);
      return `${x},${y}`;
    });
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { points: pts.join(' '), maxVal: yMax, avgVal: avg };
  }, [values, plotH]);

  return (
    <div className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs dark:shadow-md space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-slate-900 dark:text-white">{title}</span>
        <span
          dir="ltr"
          className="text-[11.5px] font-mono-tabular text-slate-500 dark:text-[#8b9bb4]"
        >
          {avgVal !== null ? `${formatFrameTimeMs(avgVal, naLabel)} · max ${maxVal} ms` : naLabel}
        </span>
      </div>
      <div dir="ltr" className="relative h-[132px] w-full rounded-lg bg-slate-50 dark:bg-[#10151c] border border-slate-200/80 dark:border-white/[0.06] overflow-hidden p-2">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" className="w-full h-full">
          {[0.25, 0.5, 0.75].map((frac) => {
            const y = pad + plotH * frac;
            return (
              <line
                key={frac}
                x1={0}
                y1={y}
                x2={svgWidth}
                y2={y}
                stroke="currentColor"
                strokeDasharray="3 4"
                className="text-slate-200 dark:text-white/[0.08]"
              />
            );
          })}
          {points && (
            <polyline
              fill="none"
              stroke="var(--sa-accent, #38bdf8)"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export function GamingPerformancePanel({
  isDesktopApp,
  language,
  snapshot,
  presentMonSetupState,
  onOpenPresentMonManager,
}: GamingPerformancePanelProps) {
  const tr = getTranslations(language);
  const t = tr.hardware;
  const tp = tr.presentMonSetup;
  const naLabel = t.naValue;
  const gamingBridge = useMemo(() => getDesktopGamingMonitorBridge(), []);

  const [sessionState, setSessionState] = useState<GamingSessionState>(EMPTY_GAMING_SESSION_STATE);
  const [processes, setProcesses] = useState<GamingProcessCandidate[]>([]);
  const [selectedProcessKey, setSelectedProcessKey] = useState<string>('foreground');
  const [pingHostInput, setPingHostInput] = useState<string>('1.1.1.1');
  const [historyList, setHistoryList] = useState<GamingSessionHistoryItem[]>([]);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(false);
  const [isTogglingSession, setIsTogglingSession] = useState(false);
  const [compareIdA, setCompareIdA] = useState<string>('');
  const [compareIdB, setCompareIdB] = useState<string>('');

  const loadProcesses = useCallback(async () => {
    if (!gamingBridge) return;
    setIsLoadingProcesses(true);
    try {
      const list = await gamingBridge.listProcesses();
      setProcesses(Array.isArray(list) ? list : []);
    } catch {
      setProcesses([]);
    } finally {
      setIsLoadingProcesses(false);
    }
  }, [gamingBridge]);

  const loadHistory = useCallback(async () => {
    if (!gamingBridge) return;
    try {
      const items = await gamingBridge.getHistory();
      const safe = Array.isArray(items) ? items : [];
      setHistoryList(safe);
      if (safe.length > 0) {
        setCompareIdA((prev) => prev || safe[0].sessionId);
      }
      if (safe.length > 1) {
        setCompareIdB((prev) => prev || safe[1].sessionId);
      }
    } catch {
      setHistoryList([]);
    }
  }, [gamingBridge]);

  useEffect(() => {
    if (!gamingBridge || !isDesktopApp) return;
    let active = true;

    void gamingBridge.getState().then((st) => {
      if (active && st) {
        setSessionState(st);
        if (st.pingHost) setPingHostInput(st.pingHost);
      }
    });
    void loadProcesses();
    void loadHistory();

    const unsubscribe = gamingBridge.onUpdate((nextState) => {
      if (active && nextState) {
        setSessionState(nextState);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gamingBridge, isDesktopApp, loadProcesses, loadHistory]);

  const handleToggleSession = useCallback(async () => {
    if (!gamingBridge || isTogglingSession) return;
    setIsTogglingSession(true);
    try {
      if (sessionState.isActive) {
        const res = await gamingBridge.stopSession();
        if (res?.state) setSessionState(res.state);
        await loadHistory();
      } else {
        const chosen =
          selectedProcessKey === 'foreground'
            ? null
            : processes.find((p) => String(p.pid) === selectedProcessKey) || null;
        const started = await gamingBridge.startSession({
          pid: chosen?.pid ?? null,
          processName: chosen?.name ?? 'Foreground Active Window',
          pingHost: pingHostInput.trim() || '1.1.1.1',
        });
        if (started) setSessionState(started);
      }
    } finally {
      setIsTogglingSession(false);
    }
  }, [
    gamingBridge,
    isTogglingSession,
    sessionState.isActive,
    selectedProcessKey,
    processes,
    pingHostInput,
    loadHistory,
  ]);

  const handleClearHistory = useCallback(async () => {
    if (!gamingBridge) return;
    const cleared = await gamingBridge.clearHistory();
    setHistoryList(Array.isArray(cleared) ? cleared : []);
    setCompareIdA('');
    setCompareIdB('');
  }, [gamingBridge]);

  const primaryGpu = selectPrimaryGpu(snapshot.gpus);
  const sessionA = historyList.find((s) => s.sessionId === compareIdA) || null;
  const sessionB = historyList.find((s) => s.sessionId === compareIdB) || null;

  const fpsCards = [
    { label: t.gamingFpsCurrent, value: formatFps(sessionState.fps.currentFps, naLabel), accent: 'text-[var(--sa-accent)]' },
    { label: t.gamingFpsAvg, value: formatFps(sessionState.fps.averageFps, naLabel), accent: 'text-emerald-600 dark:text-[#34d399]' },
    { label: t.gamingFps1Low, value: formatFps(sessionState.fps.low1PercentFps, naLabel), accent: 'text-amber-600 dark:text-[#fbbf24]' },
    { label: t.gamingFps01Low, value: formatFps(sessionState.fps.low01PercentFps, naLabel), accent: 'text-rose-600 dark:text-[#fb7185]' },
    { label: t.gamingFpsMax, value: formatFps(sessionState.fps.maxFps, naLabel), accent: 'text-slate-900 dark:text-white' },
    { label: t.gamingFrameTimeAvg, value: formatFrameTimeMs(sessionState.fps.avgFrameTimeMs, naLabel), accent: 'text-slate-900 dark:text-white' },
    { label: t.gamingFrameTimeP95, value: formatFrameTimeMs(sessionState.fps.p95FrameTimeMs, naLabel), accent: 'text-slate-900 dark:text-white' },
    { label: t.gamingFramePacing, value: formatPercent(sessionState.fps.framePacingStabilityPercent, naLabel), accent: 'text-emerald-600 dark:text-[#34d399]' },
    { label: t.gamingSpikes, value: sessionState.presentMonAvailable ? String(sessionState.fps.spikeCount) : naLabel, accent: 'text-amber-600 dark:text-[#fbbf24]' },
    { label: t.gamingStutters, value: sessionState.presentMonAvailable ? String(sessionState.fps.stutterCount) : naLabel, accent: 'text-rose-600 dark:text-[#fb7185]' },
    { label: t.gamingDroppedFrames, value: sessionState.presentMonAvailable ? String(sessionState.fps.droppedFrames) : naLabel, accent: 'text-slate-900 dark:text-white' },
  ];

  return (
    <div className="space-y-5">
      {/* Session Control Card */}
      <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs dark:shadow-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="sa-icon-badge w-9 h-9 flex items-center justify-center shrink-0">
              <GameController className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-[16px] font-bold text-slate-900 dark:text-white">{t.gamingTitle}</h2>
              <p className="text-[12.5px] text-slate-600 dark:text-[#9cb0c9]">{t.gamingSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {sessionState.isActive && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--sa-btn-radius)] bg-emerald-500/12 border border-emerald-500/30 text-emerald-700 dark:text-[#34d399] text-[12px] font-mono-tabular font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                <span>{t.gamingSessionActive}</span>
                <span>·</span>
                <span dir="ltr">{formatSessionDuration(sessionState.durationSeconds)}</span>
              </div>
            )}

            <button
              type="button"
              disabled={!isDesktopApp || isTogglingSession}
              onClick={() => void handleToggleSession()}
              className={`inline-flex items-center gap-2 min-h-[38px] px-4 py-2 text-[12.5px] font-bold transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap ${
                sessionState.isActive
                  ? 'rounded-[var(--sa-btn-radius)] bg-rose-600 hover:bg-rose-700 text-white'
                  : 'sa-btn-primary'
              }`}
            >
              {sessionState.isActive ? (
                <>
                  <Pause weight="fill" className="w-3.5 h-3.5" />
                  <span>{t.gamingStopSession}</span>
                </>
              ) : (
                <>
                  <Play weight="fill" className="w-3.5 h-3.5" />
                  <span>{t.gamingStartSession}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Process Selector & Ping Host Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-end gap-2">
            <label className="flex-1 space-y-1 min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8b9bb4]">
                {t.gamingSelectProcess}
              </span>
              <select
                value={selectedProcessKey}
                disabled={!isDesktopApp || sessionState.isActive}
                onChange={(e) => setSelectedProcessKey(e.target.value)}
                className="sa-search-input w-full min-h-[38px] px-3 py-1.5 text-[12.5px] disabled:opacity-55"
              >
                <option value="foreground">{t.gamingAllProcesses}</option>
                {processes.map((proc) => (
                  <option key={`${proc.pid}-${proc.name}`} value={String(proc.pid)}>
                    {proc.name} {proc.windowTitle ? `— ${proc.windowTitle}` : ''} ({proc.pid})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!isDesktopApp || isLoadingProcesses || sessionState.isActive}
              onClick={() => void loadProcesses()}
              className="sa-btn-secondary inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 text-[12px] font-semibold disabled:opacity-45 shrink-0 whitespace-nowrap"
            >
              <ArrowClockwise className={`w-4 h-4 ${isLoadingProcesses ? 'motion-safe:animate-spin' : ''}`} />
              <span>{t.gamingRefreshProcesses}</span>
            </button>
          </div>

          <label className="space-y-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8b9bb4]">
              {t.gamingPingHost}
            </span>
            <input
              type="text"
              dir="ltr"
              value={pingHostInput}
              disabled={!isDesktopApp}
              onChange={(e) => setPingHostInput(e.target.value)}
              onBlur={() => {
                if (gamingBridge && pingHostInput.trim()) {
                  void gamingBridge.setPingHost(pingHostInput.trim());
                }
              }}
              placeholder="1.1.1.1"
              className="sa-search-input w-full min-h-[38px] px-3 py-1.5 text-[12.5px] font-mono-tabular disabled:opacity-55"
            />
          </label>
        </div>

        {/* PresentMon Status Notice */}
        {snapshot.platform !== 'win32' && snapshot.platform !== 'web' ? (
          <div className="rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] px-3.5 py-2.5 flex items-start gap-2.5 text-[12px]">
            <Info className="w-4.5 h-4.5 text-[var(--sa-accent)] shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <div className="font-semibold text-slate-900 dark:text-white">
                {t.gamingPresentMonUnsupportedTitle}
              </div>
              <p className="text-slate-600 dark:text-[#9cb0c9] leading-relaxed">
                {t.gamingPresentMonUnsupportedDesc}
              </p>
            </div>
          </div>
        ) : !sessionState.presentMonAvailable ? (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-200 dark:border-amber-400/25 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px]">
            <div className="flex items-start gap-2.5 min-w-0">
              <Info className="w-4.5 h-4.5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-amber-900 dark:text-amber-200">
                  {presentMonSetupState?.declinedForVersion
                    ? tp.declinedBannerTitle
                    : presentMonSetupState?.actionNeeded === 'repair_required'
                    ? tp.statusRepairRequired
                    : t.gamingPresentMonMissingTitle}
                </div>
                <p className="text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
                  {presentMonSetupState?.declinedForVersion
                    ? tp.declinedBannerDesc
                    : presentMonSetupState?.healthIssue || t.gamingPresentMonMissingDesc}
                </p>
              </div>
            </div>
            {onOpenPresentMonManager && (
              <button
                type="button"
                onClick={onOpenPresentMonManager}
                className="sa-btn-primary inline-flex items-center justify-center gap-1.5 min-h-[34px] px-3.5 py-1.5 text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>
                  {presentMonSetupState?.actionNeeded === 'repair_required'
                    ? tp.repairBtn
                    : tp.enablePresentMonBtn}
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200 dark:border-emerald-400/25 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <div className="inline-flex items-center gap-2 font-semibold text-emerald-800 dark:text-[#34d399]">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{t.gamingPresentMonReady}</span>
              {presentMonSetupState?.installedVersion && (
                <span dir="ltr" className="font-mono-tabular text-[11px] opacity-90">
                  (v{presentMonSetupState.installedVersion})
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {sessionState.presentMonPath && (
                <span dir="ltr" className="text-[11px] font-mono-tabular text-emerald-700/80 dark:text-[#34d399]/80 truncate max-w-[320px]">
                  {sessionState.presentMonPath}
                </span>
              )}
              {onOpenPresentMonManager && (
                <button
                  type="button"
                  onClick={onOpenPresentMonManager}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    presentMonSetupState?.actionNeeded === 'update_available'
                      ? 'sa-btn-primary'
                      : 'rounded-[var(--sa-btn-radius)] bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-800 dark:text-[#34d399]'
                  }`}
                >
                  <span>
                    {presentMonSetupState?.actionNeeded === 'update_available' &&
                    presentMonSetupState?.latestRelease?.version
                      ? `${tp.updateNowBtn} (v${presentMonSetupState.latestRelease.version})`
                      : tp.managePresentMonBtn}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* FPS & Frame Telemetry Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {fpsCards.map((item) => (
          <div
            key={item.label}
            className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-3.5 shadow-xs dark:shadow-md space-y-1"
          >
            <div className="text-[11px] font-semibold text-slate-500 dark:text-[#8b9bb4] truncate">
              {item.label}
            </div>
            <div dir="ltr" className={`text-[16px] font-bold font-mono-tabular ${item.accent}`}>
              {item.value}
            </div>
          </div>
        ))}
      </section>

      {/* Frame Time History + Network/Thermal Telemetry */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <FrameTimeSparkline
            values={sessionState.frameTimeHistory}
            naLabel={naLabel}
            title={t.gamingFrameTimeChartTitle}
          />
        </div>

        <article className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs dark:shadow-md space-y-3">
          <div className="flex items-center gap-2">
            <WifiHigh className="w-4.5 h-4.5 text-[var(--sa-accent)]" />
            <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">
              {t.gamingNetworkLatencyTitle}
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-[12.5px]">
            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.gamingPingLabel}</span>
              <span dir="ltr" className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {formatPingMs(sessionState.pingMs, naLabel)}
              </span>
            </div>
            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.gamingPacketLossLabel}</span>
              <span dir="ltr" className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {isValidMetric(sessionState.packetLossPercent)
                  ? `${sessionState.packetLossPercent.toFixed(1)}%`
                  : naLabel}
              </span>
            </div>
            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.gamingInputLatencyLabel}</span>
              <span
                className="text-[11.5px] font-medium text-slate-500 dark:text-[#8b9bb4] text-end"
                title={sessionState.inputLatencyNote}
              >
                {isValidMetric(sessionState.inputLatencyMs)
                  ? `${sessionState.inputLatencyMs.toFixed(1)} ms`
                  : sessionState.inputLatencyNote}
              </span>
            </div>
            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.gamingThrottlingLabel}</span>
              <span
                className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
                  sessionState.thermalThrottlingDetected
                    ? 'text-rose-600 dark:text-[#fb7185]'
                    : 'text-emerald-600 dark:text-[#34d399]'
                }`}
              >
                <Thermometer className="w-3.5 h-3.5" />
                {sessionState.thermalThrottlingDetected
                  ? t.gamingThrottlingDetected
                  : t.gamingThrottlingNormal}
              </span>
            </div>
            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-slate-600 dark:text-[#9cb0c9]">CPU / GPU / VRAM</span>
              <span dir="ltr" className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {formatPercent(snapshot.cpu.usagePercent, naLabel)} ·{' '}
                {formatPercent(primaryGpu?.utilizationPercent ?? null, naLabel)} ·{' '}
                {formatVramMB(primaryGpu?.vramUsedMB ?? null, naLabel)}
              </span>
            </div>
          </div>
        </article>
      </div>

      {/* Multi-Sample Bottleneck Analysis */}
      <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs dark:shadow-md space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Pulse className="w-4.5 h-4.5 text-[var(--sa-accent)]" />
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
              {t.gamingBottleneckTitle}
            </h3>
          </div>
          <span dir="ltr" className="text-[11.5px] font-mono-tabular text-slate-500 dark:text-[#8b9bb4]">
            {sessionState.bottleneckAnalysis.sampleCount} / {sessionState.bottleneckAnalysis.requiredSamples}
          </span>
        </div>

        {!sessionState.bottleneckAnalysis.ready ? (
          <div className="rounded-lg bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.07] p-3.5 text-[12.5px] text-slate-600 dark:text-[#9cb0c9]">
            {t.gamingBottleneckWarming}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {sessionState.bottleneckAnalysis.findings.map((finding) => {
              const toneClass =
                finding.severity === 'critical'
                  ? 'border-rose-500/35 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300'
                  : finding.severity === 'warning'
                  ? 'border-amber-500/35 bg-amber-500/[0.06] text-amber-800 dark:text-amber-300'
                  : 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-800 dark:text-[#34d399]';

              return (
                <div key={finding.id} className={`rounded-lg border p-3.5 space-y-2 ${toneClass}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 font-bold text-[13.5px]">
                      {finding.severity === 'info' ? (
                        <CheckCircle className="w-4 h-4 shrink-0" />
                      ) : (
                        <WarningCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{finding.title}</span>
                    </div>
                    <span className="text-[10.5px] uppercase font-mono-tabular font-bold opacity-80">
                      {finding.confidence}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-700 dark:text-[#cbd5e1] leading-relaxed">
                    {finding.cause}
                  </p>
                  {finding.recommendations.length > 0 && (
                    <ul className="space-y-1 text-[11.5px] text-slate-600 dark:text-[#9cb0c9] list-disc ps-4">
                      {finding.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Session History & Comparison */}
      <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs dark:shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
            {t.gamingHistoryTitle}
          </h3>
          {historyList.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClearHistory()}
              className="sa-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer whitespace-nowrap"
            >
              <Trash className="w-3.5 h-3.5" />
              <span>{t.gamingClearHistory}</span>
            </button>
          )}
        </div>

        {historyList.length === 0 ? (
          <p className="text-[12.5px] text-slate-500 dark:text-[#8b9bb4]">{t.gamingHistoryEmpty}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-[#8b9bb4]">
                    <th className="py-2 pe-3 font-semibold text-start">{t.gamingSelectProcess}</th>
                    <th className="py-2 px-2 font-semibold text-start">{t.gamingSessionDuration}</th>
                    <th className="py-2 px-2 font-semibold text-start">{t.gamingFpsAvg}</th>
                    <th className="py-2 px-2 font-semibold text-start">{t.gamingFps1Low}</th>
                    <th className="py-2 px-2 font-semibold text-start">CPU / GPU</th>
                    <th className="py-2 px-2 font-semibold text-start">{t.gamingPingLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {historyList.map((item) => (
                    <tr key={item.sessionId} className="text-slate-800 dark:text-[#d5e0ee]">
                      <td className="py-2.5 pe-3 font-semibold truncate max-w-[200px]">
                        {item.processName || naLabel}
                      </td>
                      <td dir="ltr" className="py-2.5 px-2 font-mono-tabular">
                        {formatSessionDuration(item.durationSeconds)}
                      </td>
                      <td dir="ltr" className="py-2.5 px-2 font-mono-tabular font-semibold text-[var(--sa-accent)]">
                        {formatFps(item.averageFps, naLabel)}
                      </td>
                      <td dir="ltr" className="py-2.5 px-2 font-mono-tabular">
                        {formatFps(item.low1PercentFps, naLabel)}
                      </td>
                      <td dir="ltr" className="py-2.5 px-2 font-mono-tabular">
                        {formatPercent(item.avgCpuPercent, naLabel)} / {formatPercent(item.avgGpuPercent, naLabel)}
                        {' · '}
                        {formatTemperatureC(item.peakGpuTempC, naLabel)}
                      </td>
                      <td dir="ltr" className="py-2.5 px-2 font-mono-tabular">
                        {formatPingMs(item.pingMs, naLabel)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {historyList.length >= 2 && (
              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-3">
                <div className="text-[13px] font-bold text-slate-900 dark:text-white">
                  {t.gamingCompareTitle}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">{t.gamingCompareSelectA}</span>
                    <select
                      value={compareIdA}
                      onChange={(e) => setCompareIdA(e.target.value)}
                      className="sa-search-input w-full min-h-[34px] px-2.5 py-1 text-[12px]"
                    >
                      {historyList.map((s) => (
                        <option key={s.sessionId} value={s.sessionId}>
                          {s.processName || s.sessionId} ({new Date(s.endedAt).toLocaleTimeString()})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">{t.gamingCompareSelectB}</span>
                    <select
                      value={compareIdB}
                      onChange={(e) => setCompareIdB(e.target.value)}
                      className="sa-search-input w-full min-h-[34px] px-2.5 py-1 text-[12px]"
                    >
                      {historyList.map((s) => (
                        <option key={s.sessionId} value={s.sessionId}>
                          {s.processName || s.sessionId} ({new Date(s.endedAt).toLocaleTimeString()})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {sessionA && sessionB && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[12px]">
                    <div className="rounded-lg bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.06] p-2.5">
                      <div className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">{t.gamingFpsAvg}</div>
                      <div dir="ltr" className="font-mono-tabular font-bold text-slate-900 dark:text-white">
                        {formatFps(sessionA.averageFps, naLabel)} vs {formatFps(sessionB.averageFps, naLabel)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.06] p-2.5">
                      <div className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">{t.gamingFps1Low}</div>
                      <div dir="ltr" className="font-mono-tabular font-bold text-slate-900 dark:text-white">
                        {formatFps(sessionA.low1PercentFps, naLabel)} vs {formatFps(sessionB.low1PercentFps, naLabel)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.06] p-2.5">
                      <div className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">{t.gamingStutters}</div>
                      <div dir="ltr" className="font-mono-tabular font-bold text-slate-900 dark:text-white">
                        {sessionA.stutterCount} vs {sessionB.stutterCount}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.06] p-2.5">
                      <div className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">{t.gamingPingLabel}</div>
                      <div dir="ltr" className="font-mono-tabular font-bold text-slate-900 dark:text-white">
                        {formatPingMs(sessionA.pingMs, naLabel)} vs {formatPingMs(sessionB.pingMs, naLabel)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
