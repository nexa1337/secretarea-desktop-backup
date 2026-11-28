import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppWindow,
  ArrowCounterClockwise,
  ArrowsClockwise,
  ArrowSquareOut,
  Bell,
  Broom,
  CaretDown,
  CaretUp,
  ChartLineUp,
  Check,
  ClockCounterClockwise,
  CursorClick,
  Database,
  DownloadSimple,
  FloppyDisk,
  FolderOpen,
  Gauge,
  Globe,
  HardDrive,
  Laptop,
  Leaf,
  Lightning,
  MagnifyingGlass,
  Moon,
  MusicNotes,
  Power,
  Scales,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  SpeakerLow,
  SpeakerSlash,
  Sun,
  Swatches,
  Wrench,
  X,
} from '@phosphor-icons/react';
import {
  getAppVersionString,
  getEffectivePerformanceConfig,
  resolveEffectiveLightMode,
  type AnimationMode,
  type AppearanceMode,
  type AppLanguage,
  type CustomThemeConfig,
  type LauncherSettings,
  type OsThemePreference,
  type ResolvedOsTheme,
} from '../services/launcherSettings';
import type {
  CloseBehaviorMode,
  EffectivePerformanceConfig,
  InternalPerfMetricsSnapshot,
  PerformanceAdvancedSettings,
  PerformanceMode,
  PresentMonSetupState,
  PrimarySection,
  QbitConnectionDetail,
  QbitConnectionState,
  QbitLifecyclePreferences,
  QbitSetupState,
  TorrentConnectionTestResult,
  TorrentDetectionResult,
  TorrentIntegrationConfig,
} from '../types';
import type { SystemHardwareSpecs } from '../services/systemSpecs';
import {
  getDesktopSettingsBridge,
  type DesktopUpdateState,
} from '../services/desktopUpdater';
import { getDesktopOpenSourceToolsBridge } from '../services/hardwareMonitor';
import { DEFAULT_TORRENT_CONFIG } from '../services/downloadManager';
import { IMAGE_CACHE_NAME } from '../services/imageCache';
import { clearDealsMemoryCache } from '../deals/httpClient';
import { getTranslations, LANGUAGE_OPTIONS } from '../i18n/translations';
import { CustomThemeBuilder } from './CustomThemeBuilder';
import { Ps5Icon } from './SectionBadge';
import { SettingsRow, ToggleSwitch } from './settings/SettingsUiPrimitives';
import { ToolsHubSection } from './settings/ToolsHubSection';

export type SettingsCategoryId =
  | 'all'
  | 'tools'
  | 'language'
  | 'startup'
  | 'appearance'
  | 'audio'
  | 'performance'
  | 'storage'
  | 'updates';

interface SettingsViewProps {
  settings: LauncherSettings;
  isDesktopApp: boolean;
  desktopVersion?: string | null;
  isUpdatingAutoLaunch?: boolean;
  downloadFolder?: string;
  torrentConfig?: TorrentIntegrationConfig;
  torrentConnected?: boolean;
  torrentVersion?: string | null;
  torrentWebApiVersion?: string | null;
  torrentError?: string | null;
  torrentConnectionState?: QbitConnectionState;
  torrentConnectionDetail?: QbitConnectionDetail;
  qbitLifecyclePrefs?: QbitLifecyclePreferences;
  onChangeLanguage: (language: AppLanguage) => void;
  onToggleStartWithComputer: (enabled: boolean) => void;
  onChangeCloseBehavior?: (behavior: CloseBehaviorMode) => void;
  onExitApplication?: () => void;
  onToggleEnableCanRunIt: (enabled: boolean) => void;
  onToggleCompactNavbar: (enabled: boolean) => void;
  onToggleCustomCursor: (enabled: boolean) => void;
  onToggleLightMode: (enabled: boolean) => void;
  onToggleAlwaysPs5Theme: (enabled: boolean) => void;
  onToggleAlwaysXboxTheme: (enabled: boolean) => void;
  activeOsTheme?: ResolvedOsTheme;
  runtimePlatform?: 'win32' | 'linux' | 'darwin';
  systemPrefersDark?: boolean;
  onChangeOsThemePreference?: (preference: OsThemePreference) => void;
  onChangeAppearanceMode?: (mode: AppearanceMode) => void;
  onChangeAnimationMode?: (mode: AnimationMode) => void;
  onRestoreDefaultThemes?: () => void;
  onUpdateCustomTheme: (patch: Partial<CustomThemeConfig>) => void;
  onResetCustomTheme: () => void;
  onToggleAmbientMusic: (enabled: boolean) => void;
  onToggleUiClickSounds: (enabled: boolean) => void;
  onChangeSoundVolume: (volume: number) => void;
  onPreviewSoundVolume?: () => void;
  onResetDefaults: () => void;
  onChooseDownloadFolder?: () => void;
  onOpenDownloadFolder?: () => void;
  onOpenExternal?: (url: string) => void;
  onDetectTorrentClient?: () => Promise<TorrentDetectionResult | null>;
  onSaveTorrentConfig?: (cfg: Partial<TorrentIntegrationConfig>) => Promise<void>;
  onTestTorrentConnection?: (
    cfg?: Partial<TorrentIntegrationConfig>
  ) => Promise<TorrentConnectionTestResult | null>;
  onReconnectTorrent?: () => Promise<void>;
  onStartQbitBackground?: () => Promise<void>;
  onQuitQbit?: () => Promise<void>;
  onApplyDetectedPort?: (port: number) => Promise<void>;
  onSaveQbitLifecyclePrefs?: (prefs: Partial<QbitLifecyclePreferences>) => Promise<void>;
  qbitSetupState?: QbitSetupState;
  onOpenQbitSetupWizard?: () => void;
  presentMonSetupState?: PresentMonSetupState;
  onOpenPresentMonManager?: () => void;
  onCheckPresentMonUpdates?: () => Promise<void> | void;
  onStartPresentMonInstallOrUpdate?: (
    userConfirmed: boolean,
    mode?: 'auto' | 'install' | 'update' | 'repair' | 'reinstall'
  ) => Promise<void> | void;
  onOpenUpdateHistory?: () => void;
  onOpenNotifications?: () => void;
  onReplayOnboarding?: () => void;
  effectivePerformance?: EffectivePerformanceConfig;
  onChangePerformanceMode?: (mode: PerformanceMode) => void;
  onUpdatePerformanceAdvanced?: (patch: Partial<PerformanceAdvancedSettings>) => void;
  // Smart Hub & Inspector additions
  systemSpecs?: SystemHardwareSpecs;
  isRefreshingSpecs?: boolean;
  onRefreshSpecs?: () => Promise<void> | void;
  onSaveCustomSpecs?: (next: SystemHardwareSpecs) => void;
  onResetCustomSpecs?: () => Promise<void> | void;
  desktopUpdateState?: DesktopUpdateState | null;
  onOpenUpdater?: () => void;
  onCheckForUpdates?: () => void;
  onOpenSpinWheel?: () => void;
  onOpenHypervisorGuide?: () => void;
  onNavigateSection?: (section: PrimarySection) => void;
  onNotify?: (message: string, type?: 'success' | 'info' | 'error') => void;
  focusToolRequest?: { toolId: string; nonce: number } | null;
}

function XboxGlyph({ className = 'w-4.5 h-4.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9.2" />
      <path d="M7.2 6.8c2.2 1.2 4.8 3.6 7.5 7.4 1 1.4 1.7 2.8 2 4" />
      <path d="M16.8 6.8c-2.2 1.2-4.8 3.6-7.5 7.4-1 1.4-1.7 2.8-2 4" />
    </svg>
  );
}

function ExitAppInlineConfirmButton({
  label,
  confirmLabel,
  cancelLabel,
  onConfirmExit,
}: {
  label: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirmExit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-700 dark:text-rose-300 text-[12px] font-semibold transition-colors shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
      >
        <Power className="w-3.5 h-3.5" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          onConfirmExit();
        }}
        className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[12px] font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
      >
        <Power className="w-3.5 h-3.5" />
        <span>{confirmLabel}</span>
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-[#1e2633] hover:bg-slate-300 dark:hover:bg-[#273142] text-slate-700 dark:text-[#cbd5e1] text-[12px] font-semibold transition-colors cursor-pointer"
      >
        {cancelLabel}
      </button>
    </div>
  );
}

export function SettingsView({
  settings,
  isDesktopApp,
  desktopVersion = null,
  isUpdatingAutoLaunch = false,
  downloadFolder = '',
  torrentConfig = DEFAULT_TORRENT_CONFIG,
  torrentConnected = false,
  torrentVersion = null,
  torrentWebApiVersion = null,
  torrentError = null,
  torrentConnectionState,
  torrentConnectionDetail,
  qbitLifecyclePrefs,
  onChangeLanguage,
  onToggleStartWithComputer,
  onChangeCloseBehavior,
  onExitApplication,
  onToggleEnableCanRunIt,
  onToggleCompactNavbar,
  onToggleCustomCursor,
  onToggleLightMode,
  onToggleAlwaysPs5Theme,
  onToggleAlwaysXboxTheme,
  activeOsTheme = 'windows',
  runtimePlatform = 'win32',
  systemPrefersDark = true,
  onChangeOsThemePreference,
  onChangeAppearanceMode,
  onChangeAnimationMode,
  onRestoreDefaultThemes,
  onUpdateCustomTheme,
  onResetCustomTheme,
  onToggleAmbientMusic,
  onToggleUiClickSounds,
  onChangeSoundVolume,
  onPreviewSoundVolume,
  onResetDefaults,
  onChooseDownloadFolder,
  onOpenDownloadFolder,
  onOpenExternal,
  onDetectTorrentClient,
  onSaveTorrentConfig,
  onTestTorrentConnection,
  onReconnectTorrent,
  onStartQbitBackground,
  onQuitQbit,
  onApplyDetectedPort,
  onSaveQbitLifecyclePrefs,
  qbitSetupState,
  onOpenQbitSetupWizard,
  presentMonSetupState,
  onOpenPresentMonManager,
  onCheckPresentMonUpdates,
  onStartPresentMonInstallOrUpdate,
  onOpenUpdateHistory,
  onOpenNotifications,
  onReplayOnboarding,
  effectivePerformance: effectivePerformanceProp,
  onChangePerformanceMode,
  onUpdatePerformanceAdvanced,
  systemSpecs,
  isRefreshingSpecs = false,
  onRefreshSpecs,
  onSaveCustomSpecs,
  onResetCustomSpecs,
  desktopUpdateState = null,
  onOpenUpdater,
  onCheckForUpdates,
  onOpenSpinWheel,
  onOpenHypervisorGuide,
  onNavigateSection,
  onNotify,
  focusToolRequest = null,
}: SettingsViewProps) {
  const tr = getTranslations(settings.language);
  const t = tr.settings;
  const th = tr.settingsHub;
  const tPerf = tr.performance;
  const hasConsoleTheme = settings.alwaysPs5Theme || settings.alwaysXboxTheme;
  const currentVersion = desktopVersion || getAppVersionString();
  const effectivePerf =
    effectivePerformanceProp || getEffectivePerformanceConfig(settings);

  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [showAdvancedPerf, setShowAdvancedPerf] = useState(false);
  const [desktopPerfMetrics, setDesktopPerfMetrics] =
    useState<InternalPerfMetricsSnapshot | null>(null);
  const [webPerfSample, setWebPerfSample] = useState<{
    jsHeapUsedMB: number | null;
    domNodes: number;
    sampledAt: number;
  } | null>(null);
  const [isSamplingPerf, setIsSamplingPerf] = useState(false);
  const [lhmInstalledReady, setLhmInstalledReady] = useState(false);
  const [clearingImageCache, setClearingImageCache] = useState(false);

  useEffect(() => {
    if (!focusToolRequest?.toolId) return;
    setActiveCategory((prev) => (prev === 'all' ? 'all' : 'tools'));
    setSearchQuery('');
    setExpandedToolId(focusToolRequest.toolId);
    const timer = window.setTimeout(() => {
      document.getElementById(`tool-card-${focusToolRequest.toolId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 90);
    return () => window.clearTimeout(timer);
  }, [focusToolRequest]);

  useEffect(() => {
    if (!isDesktopApp) return;
    const bridge = getDesktopOpenSourceToolsBridge();
    if (!bridge?.getState) return;
    let active = true;
    void bridge
      .getState()
      .then((state) => {
        if (!active || !state?.tools) return;
        const lhm = state.tools.find(
          (item) =>
            item.id === 'librehardwaremonitor' ||
            item.name.toLowerCase().includes('libre')
        );
        setLhmInstalledReady(Boolean(lhm?.installed && lhm?.healthy));
      })
      .catch(() => {
        // Ignore non-fatal open-source tool probe error
      });
    return () => {
      active = false;
    };
  }, [isDesktopApp]);

  const sampleRuntimeFootprint = useCallback(async () => {
    setIsSamplingPerf(true);
    try {
      const bridge = getDesktopSettingsBridge();
      if (isDesktopApp && bridge?.getPerformanceMetrics) {
        const snapshot = await bridge.getPerformanceMetrics();
        if (snapshot) {
          setDesktopPerfMetrics(snapshot);
          return;
        }
      }
      const perfMem = (
        performance as unknown as { memory?: { usedJSHeapSize?: number } }
      )?.memory;
      const heapMB =
        typeof perfMem?.usedJSHeapSize === 'number'
          ? Number((perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(1))
          : null;
      const domNodes =
        typeof document !== 'undefined' ? document.querySelectorAll('*').length : 0;
      setWebPerfSample({
        jsHeapUsedMB: heapMB,
        domNodes,
        sampledAt: Date.now(),
      });
    } finally {
      setIsSamplingPerf(false);
    }
  }, [isDesktopApp]);

  useEffect(() => {
    void sampleRuntimeFootprint();
  }, [sampleRuntimeFootprint]);

  const handleClearDealsCache = () => {
    clearDealsMemoryCache();
    onNotify?.(th.dealsCacheCleared, 'success');
  };

  const handleClearArtworkCache = async () => {
    setClearingImageCache(true);
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        await window.caches.delete(IMAGE_CACHE_NAME);
      }
      onNotify?.(th.imageCacheCleared, 'success');
    } finally {
      setClearingImageCache(false);
    }
  };

  const activeThemeModeKey: 'dark' | 'light' | 'ps5' | 'xbox' | 'custom' = settings.alwaysXboxTheme
    ? 'xbox'
    : settings.alwaysPs5Theme
    ? 'ps5'
    : settings.customTheme.enabled
    ? 'custom'
    : settings.lightMode
    ? 'light'
    : 'dark';

  const activeThemeDisplayLabel =
    activeThemeModeKey === 'xbox'
      ? th.themeXbox
      : activeThemeModeKey === 'ps5'
      ? th.themePs5
      : activeThemeModeKey === 'custom'
      ? th.themeCustom
      : activeThemeModeKey === 'light'
      ? th.themeCrispLight
      : th.themeDefaultDark;

  const selectQuickTheme = (mode: 'dark' | 'light' | 'ps5' | 'xbox' | 'custom') => {
    if (mode === 'light') {
      onToggleLightMode(true);
    } else if (mode === 'ps5') {
      onToggleAlwaysPs5Theme(true);
    } else if (mode === 'xbox') {
      onToggleAlwaysXboxTheme(true);
    } else if (mode === 'custom') {
      onUpdateCustomTheme({ enabled: !settings.customTheme.enabled });
    } else {
      onToggleAlwaysPs5Theme(false);
      onToggleAlwaysXboxTheme(false);
      onUpdateCustomTheme({ enabled: false });
      onToggleLightMode(false);
    }
  };

  const readyToolsCount = useMemo(() => {
    let count = 5; // deals_api, bench_db, hypervisor, spinwheel, updater are always built-in
    if (torrentConnected) count += 1;
    if (presentMonSetupState?.installed && presentMonSetupState.healthy) count += 1;
    if (settings.enableCanRunIt) count += 1;
    if (isDesktopApp) count += 1; // PC Cleaner native utility ready on desktop
    if (lhmInstalledReady) count += 1;
    return count;
  }, [
    torrentConnected,
    presentMonSetupState?.installed,
    presentMonSetupState?.healthy,
    settings.enableCanRunIt,
    isDesktopApp,
    lhmInstalledReady,
  ]);

  const VolumeIcon =
    settings.soundVolume <= 0
      ? SpeakerSlash
      : settings.soundVolume < 50
      ? SpeakerLow
      : SpeakerHigh;

  const activeLanguageOption = useMemo(
    () => LANGUAGE_OPTIONS.find((opt) => opt.code === settings.language) || LANGUAGE_OPTIONS[0],
    [settings.language]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const sectionKeywords = useMemo<Record<Exclude<SettingsCategoryId, 'all'>, string>>(
    () => ({
      tools: [
        th.hubTitle,
        th.hubSubtitle,
        th.toolQbitName,
        th.toolQbitPurpose,
        th.toolPresentMonName,
        th.toolPresentMonPurpose,
        th.toolLhmName,
        th.toolLhmPurpose,
        th.toolCleanerName,
        th.toolCleanerPurpose,
        th.toolDealsApiName,
        th.toolDealsApiPurpose,
        th.toolCanRunItName,
        th.toolCanRunItPurpose,
        th.toolBenchDbName,
        th.toolBenchDbPurpose,
        th.toolHypervisorName,
        th.toolHypervisorPurpose,
        th.toolSpinWheelName,
        th.toolSpinWheelPurpose,
        th.toolUpdaterName,
        th.toolUpdaterPurpose,
        'qbittorrent torrent webui presentmon fps librehardwaremonitor sensors cleaner junk deals api credentials key steam opencritic metacritic can run it specs vram gpu ram benchmark hardware database hypervisor spin wheel updater',
      ]
        .join(' ')
        .toLowerCase(),
      language: [
        t.languageSectionTitle,
        t.languageSectionDesc,
        'language english french spanish arabic rtl ltr cairo locale region',
      ]
        .join(' ')
        .toLowerCase(),
      startup: [
        t.startingSectionTitle,
        t.startWithComputerTitle,
        t.startWithComputerDesc,
        t.closeBehaviorTitle,
        t.closeBehaviorDesc,
        t.exitAppTitle,
        t.canRunItTitle,
        th.traySmartTip,
        'startup boot autolaunch tray minimize close exit shutdown windows desktop can run it',
      ]
        .join(' ')
        .toLowerCase(),
      appearance: [
        t.windowSectionTitle,
        th.themeStudioTitle,
        th.themeDefaultDark,
        th.themeCrispLight,
        th.themePs5,
        th.themeXbox,
        th.themeCustom,
        t.compactNavbarTitle,
        t.customCursorTitle,
        t.lightModeTitle,
        t.alwaysPs5Title,
        t.alwaysXboxTitle,
        t.osThemeProfileTitle,
        t.appearanceModeTitle,
        t.animationModeTitle,
        t.restoreThemeDefaultsBtn,
        tr.customTheme.sectionTitle,
        'theme dark light ps5 playstation xbox custom color accent glass blur navbar cursor windows linux macos system animation motion reduced',
      ]
        .join(' ')
        .toLowerCase(),
      audio: [
        t.audioSectionTitle,
        t.audioSectionDesc,
        t.ambientMusicTitle,
        t.uiSoundsTitle,
        t.volumeTitle,
        th.audioPreviewBtn,
        'audio sound music ambient click hover volume mute balanced test',
      ]
        .join(' ')
        .toLowerCase(),
      performance: [
        tPerf.sectionTitle,
        tPerf.sectionSubtitle,
        tPerf.modeEcoTitle,
        tPerf.modeBalancedTitle,
        tPerf.modePerformanceTitle,
        tPerf.advancedTitle,
        tPerf.auditTitle,
        th.effectiveParamsTitle,
        'performance eco balanced power poll throttle cpu ram heap runtime footprint visual effects minimize',
      ]
        .join(' ')
        .toLowerCase(),
      storage: [
        t.downloadSectionTitle,
        t.downloadFolderTitle,
        th.cacheSectionTitle,
        th.cacheSectionDesc,
        th.clearDealsCacheBtn,
        th.clearImageCacheBtn,
        'download folder path disk space free storage cache artwork images deals',
      ]
        .join(' ')
        .toLowerCase(),
      updates: [
        tr.updateHistory.settingsCardTitle,
        tr.updateHistory.settingsCardDesc,
        tr.notificationCenter.title,
        'updates changelog version history notifications release desktop updater',
      ]
        .join(' ')
        .toLowerCase(),
    }),
    [t, th, tPerf, tr.customTheme.sectionTitle, tr.updateHistory, tr.notificationCenter.title]
  );

  const shouldRenderSection = (cat: Exclude<SettingsCategoryId, 'all'>): boolean => {
    if (normalizedSearch) {
      return sectionKeywords[cat].includes(normalizedSearch);
    }
    return activeCategory === 'all' || activeCategory === cat;
  };

  const visibleSectionsCount = (
    [
      'tools',
      'language',
      'startup',
      'appearance',
      'audio',
      'performance',
      'storage',
      'updates',
    ] as Exclude<SettingsCategoryId, 'all'>[]
  ).filter(shouldRenderSection).length;

  const categoryItems: {
    id: SettingsCategoryId;
    label: string;
    icon: typeof Wrench;
    badge?: string;
  }[] = [
    { id: 'all', label: th.catAll, icon: SlidersHorizontal },
    { id: 'tools', label: th.catTools, icon: Wrench, badge: `${readyToolsCount}/10` },
    { id: 'language', label: th.catLanguage, icon: Globe, badge: activeLanguageOption.shortLabel },
    { id: 'startup', label: th.catStartup, icon: Power },
    { id: 'appearance', label: th.catAppearance, icon: Swatches },
    {
      id: 'audio',
      label: th.catAudio,
      icon: VolumeIcon,
      badge: `${settings.soundVolume}%`,
    },
    { id: 'performance', label: th.catPerformance, icon: Gauge },
    { id: 'storage', label: th.catStorage, icon: HardDrive },
    { id: 'updates', label: th.catUpdates, icon: ClockCounterClockwise },
  ];

  const perfModeDisplay =
    settings.performanceMode === 'eco'
      ? tPerf.modeEcoTitle
      : settings.performanceMode === 'performance'
      ? tPerf.modePerformanceTitle
      : tPerf.modeBalancedTitle;

  const diskPct =
    systemSpecs?.freeSpaceGB && systemSpecs?.totalSpaceGB && systemSpecs.totalSpaceGB > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(((systemSpecs.totalSpaceGB - systemSpecs.freeSpaceGB) / systemSpecs.totalSpaceGB) * 100)
          )
        )
      : null;

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-gradient-to-b from-slate-50 via-[#f4f6f9] to-slate-100 dark:from-[#1d2633] dark:via-[#171d26] dark:to-[#12161d]">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-5">
        {/* Top Command Header */}
        <header className="space-y-4 pb-4 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-lg sm:text-xl font-semibold tracking-normal text-slate-900 dark:text-white">
                  {t.pageTitle}
                </h1>
                <span
                  dir="ltr"
                  className="text-[12px] font-mono-tabular font-semibold text-slate-500 dark:text-[#8b9bb4]"
                >
                  · v{currentVersion} · {isDesktopApp ? 'Desktop' : 'Web Preview'}
                </span>
              </div>
              <p className="text-[12.5px] text-slate-600 dark:text-[#8b9bb4]">
                {t.pageSubtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isDesktopApp && onReplayOnboarding && (
                <button
                  type="button"
                  onClick={onReplayOnboarding}
                  className="sa-btn-secondary min-h-[36px] px-3 py-1.5 text-[12px] !border-[var(--sa-accent-ring)] !text-[var(--sa-accent)]"
                >
                  <Sparkle className="w-3.5 h-3.5" />
                  <span>{t.replaySetupBtn}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onResetDefaults}
                className="sa-btn-secondary min-h-[36px] px-3 py-1.5 text-[12px]"
              >
                <ArrowCounterClockwise className="w-3.5 h-3.5" />
                <span>{t.resetDefaults}</span>
              </button>
            </div>
          </div>

          {/* Instant Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="sa-search-bar relative flex-1">
              <MagnifyingGlass className="w-4 h-4 text-slate-400 dark:text-[#7f91ab] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={th.searchPlaceholder}
                aria-label={th.searchPlaceholder}
                className="sa-search-input w-full min-h-[42px] ps-10 pe-10 py-2 text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#6d7f99]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={th.clearSearchBtn}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {normalizedSearch && (
              <div className="text-[12px] font-medium text-slate-600 dark:text-[#8b9bb4] shrink-0 px-1">
                <span className="font-mono-tabular font-bold text-slate-900 dark:text-white">
                  {visibleSectionsCount}
                </span>{' '}
                {th.searchResultsCount}
              </div>
            )}
          </div>
        </header>

        {/* 4-Card Live Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('appearance');
            }}
            className="sa-ps5-panel p-3.5 rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] hover:border-[#0284c7]/50 dark:hover:border-[#38bdf8]/45 text-start transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-[#8b9bb4]">
              <span>{th.summaryThemeLabel}</span>
              <Swatches className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#66c0f4]" />
            </div>
            <div className="text-[14px] font-bold text-slate-900 dark:text-white truncate">
              {activeThemeDisplayLabel}
            </div>
            <div className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4] truncate">
              {activeLanguageOption.nativeName} ·{' '}
              <span dir="ltr" className="font-mono-tabular">
                {settings.soundVolume}%
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('performance');
            }}
            className="sa-ps5-panel p-3.5 rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] hover:border-[#0284c7]/50 dark:hover:border-[#38bdf8]/45 text-start transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-[#8b9bb4]">
              <span>{th.summaryPerfLabel}</span>
              <Gauge className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#66c0f4]" />
            </div>
            <div className="text-[14px] font-bold text-slate-900 dark:text-white truncate">
              {perfModeDisplay}
            </div>
            <div dir="ltr" className="text-[11.5px] font-mono-tabular text-slate-500 dark:text-[#8b9bb4] truncate">
              HW {effectivePerf.hardwarePollIntervalMs}ms · UI {effectivePerf.downloadUiThrottleMs}ms
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('tools');
            }}
            className="sa-ps5-panel p-3.5 rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] hover:border-[#0284c7]/50 dark:hover:border-[#38bdf8]/45 text-start transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-[#8b9bb4]">
              <span>{th.summaryToolsLabel}</span>
              <Wrench className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#66c0f4]" />
            </div>
            <div className="text-[14px] font-bold text-slate-900 dark:text-white truncate">
              <span dir="ltr" className="font-mono-tabular text-[#0284c7] dark:text-[#38bdf8]">
                {readyToolsCount}/10
              </span>{' '}
              {th.toolsReadySuffix}
            </div>
            <div className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4] truncate">
              qBittorrent · PresentMon · LHM · Cleaner
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('storage');
            }}
            className="sa-ps5-panel p-3.5 rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] hover:border-[#0284c7]/50 dark:hover:border-[#38bdf8]/45 text-start transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-[#8b9bb4]">
              <span>{th.summarySystemLabel}</span>
              <HardDrive className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#66c0f4]" />
            </div>
            <div className="text-[14px] font-bold text-slate-900 dark:text-white truncate">
              {systemSpecs?.freeSpaceGB != null ? (
                <span dir="ltr" className="font-mono-tabular">
                  {systemSpecs.freeSpaceGB} GB {th.diskFreeLabel}
                </span>
              ) : systemSpecs?.ramGB ? (
                <span dir="ltr" className="font-mono-tabular">
                  {systemSpecs.ramGB} GB RAM
                </span>
              ) : (
                isDesktopApp ? 'Desktop Runtime' : 'Web Preview'
              )}
            </div>
            <div className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4] truncate">
              {systemSpecs?.gpuName ||
                downloadFolder ||
                (isDesktopApp
                  ? ((window as unknown as { secretAreaDesktop?: { platform?: string } })
                      .secretAreaDesktop?.platform === 'darwin'
                      ? 'macOS'
                      : (window as unknown as { secretAreaDesktop?: { platform?: string } })
                          .secretAreaDesktop?.platform === 'linux'
                      ? 'Linux'
                      : 'Windows')
                  : 'Browser')}
            </div>
          </button>
        </div>

        {/* Mobile Category Bar */}
        {!normalizedSearch && (
          <nav
            aria-label="Settings Categories"
            className="lg:hidden flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
          >
            {categoryItems.map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap shrink-0 ${
                    active ? 'sa-btn-primary' : 'sa-btn-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{cat.label}</span>
                  {cat.badge && (
                    <span
                      dir="ltr"
                      className={`font-mono-tabular text-[11px] shrink-0 ${
                        active ? 'opacity-90' : 'text-slate-400 dark:text-[#7f91ab]'
                      }`}
                    >
                      {cat.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Main Two-Column Smart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[232px_1fr] gap-5 items-start">
          {/* Desktop Sticky Left Category Rail */}
          <aside className="hidden lg:block sticky top-5">
            <nav
              aria-label="Settings Categories"
              className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-2 space-y-1 shadow-sm"
            >
              {categoryItems.map((cat) => {
                const Icon = cat.icon;
                const active = !normalizedSearch && activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategory(cat.id);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[var(--sa-btn-radius)] text-[12.5px] font-semibold transition-colors cursor-pointer text-start ${
                      active
                        ? 'bg-[var(--sa-accent-soft)] text-[var(--sa-accent)] border border-[var(--sa-accent-ring)]'
                        : 'text-slate-700 dark:text-[#b4c2d4] hover:bg-slate-100 dark:hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                    </span>
                    {cat.badge && (
                      <span
                        dir="ltr"
                        className="text-[11px] font-mono-tabular text-slate-500 dark:text-[#7f91ab] shrink-0"
                      >
                        {cat.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right Content Stack */}
          <div className="min-w-0 space-y-5">
            {normalizedSearch && visibleSectionsCount === 0 && (
              <div className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-8 text-center space-y-3">
                <MagnifyingGlass className="w-8 h-8 text-slate-400 dark:text-[#7f91ab] mx-auto" />
                <div className="space-y-1">
                  <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                    {th.searchEmptyTitle}
                  </h2>
                  <p className="text-[12.5px] text-slate-600 dark:text-[#8b9bb4]">
                    {th.searchEmptyDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="sa-btn-primary px-4 py-2 text-[12.5px]"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{th.clearSearchBtn}</span>
                </button>
              </div>
            )}

            {/* 1. Unified Extra Tools & Integrations Hub */}
            {shouldRenderSection('tools') && (
              <ToolsHubSection
                language={settings.language}
                isDesktopApp={isDesktopApp}
                searchQuery={searchQuery}
                currentVersion={currentVersion}
                enableCanRunIt={settings.enableCanRunIt}
                onToggleEnableCanRunIt={onToggleEnableCanRunIt}
                systemSpecs={systemSpecs}
                isRefreshingSpecs={isRefreshingSpecs}
                onRefreshSpecs={onRefreshSpecs}
                onSaveCustomSpecs={onSaveCustomSpecs}
                onResetCustomSpecs={onResetCustomSpecs}
                torrentConfig={torrentConfig}
                torrentConnected={torrentConnected}
                torrentVersion={torrentVersion}
                torrentWebApiVersion={torrentWebApiVersion}
                torrentError={torrentError}
                torrentConnectionState={torrentConnectionState}
                torrentConnectionDetail={torrentConnectionDetail}
                qbitLifecyclePrefs={qbitLifecyclePrefs}
                onDetectTorrentClient={onDetectTorrentClient}
                onSaveTorrentConfig={onSaveTorrentConfig}
                onTestTorrentConnection={onTestTorrentConnection}
                onReconnectTorrent={onReconnectTorrent}
                onStartQbitBackground={onStartQbitBackground}
                onQuitQbit={onQuitQbit}
                onApplyDetectedPort={onApplyDetectedPort}
                onSaveQbitLifecyclePrefs={onSaveQbitLifecyclePrefs}
                qbitSetupState={qbitSetupState}
                onOpenQbitSetupWizard={onOpenQbitSetupWizard}
                presentMonSetupState={presentMonSetupState}
                onOpenPresentMonManager={onOpenPresentMonManager}
                onCheckPresentMonUpdates={onCheckPresentMonUpdates}
                onStartPresentMonInstallOrUpdate={onStartPresentMonInstallOrUpdate}
                desktopUpdateState={desktopUpdateState}
                onOpenUpdater={onOpenUpdater}
                onCheckForUpdates={onCheckForUpdates}
                onOpenUpdateHistory={onOpenUpdateHistory}
                onOpenNotifications={onOpenNotifications}
                onReplayOnboarding={onReplayOnboarding}
                onOpenSpinWheel={onOpenSpinWheel}
                onOpenHypervisorGuide={onOpenHypervisorGuide}
                onNavigateSection={onNavigateSection}
                onOpenExternal={onOpenExternal}
                onNotify={onNotify}
                expandedToolId={expandedToolId}
                onChangeExpandedTool={setExpandedToolId}
              />
            )}

            {/* 2. Language & Region */}
            {shouldRenderSection('language') && (
              <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-4 shadow-sm dark:shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-2.5 border-b border-slate-200 dark:border-white/[0.06]">
                  <div className="flex items-start gap-3">
                    <span className="sa-icon-badge w-9 h-9 flex items-center justify-center shrink-0">
                      <Globe className="w-4.5 h-4.5" />
                    </span>
                    <div className="space-y-0.5">
                      <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-white tracking-normal">
                        {t.languageSectionTitle}
                      </h2>
                      <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4]">
                        {t.languageSectionDesc}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11.5px] font-mono-tabular text-slate-500 dark:text-[#8b9bb4]">
                    {activeLanguageOption.direction === 'rtl'
                      ? 'Cairo · RTL'
                      : 'Outfit / Plus Jakarta Sans · LTR'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const selected = settings.language === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChangeLanguage(opt.code)}
                        className={`sa-ps5-subpanel relative p-3.5 rounded-lg border text-start transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                          selected
                            ? 'bg-sky-50 dark:bg-[#162538] border-[#1a9fff] ring-1 ring-[#1a9fff]/45'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 dark:bg-[#12171f] dark:border-white/[0.07] dark:hover:border-white/[0.2] dark:hover:bg-[#171e29]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono-tabular tracking-wider ${
                              selected
                                ? 'bg-[#1a9fff] text-white'
                                : 'bg-slate-200 text-slate-700 dark:bg-white/[0.08] dark:text-[#9fb0c7]'
                            }`}
                          >
                            {opt.shortLabel}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8b9bb4]">
                              {opt.direction === 'rtl' ? t.rtlBadge : t.ltrBadge}
                            </span>
                            {selected && (
                              <Check
                                weight="bold"
                                className="w-4 h-4 text-[#0284c7] dark:text-[#66c0f4]"
                              />
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[14px] font-bold text-slate-900 dark:text-white">
                            {opt.nativeName}
                          </div>
                          <div className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4]">
                            {opt.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 3. Startup & System Behavior */}
            {shouldRenderSection('startup') && (
              <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-3.5 shadow-sm dark:shadow-lg">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200 dark:border-white/[0.06]">
                  <Power className="w-4 h-4 text-[#0284c7] dark:text-[#66c0f4] shrink-0" />
                  <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-white tracking-normal">
                    {t.startingSectionTitle}
                  </h2>
                </div>

                {/* Smart Tray Tip when Autostart is ON but Close Behavior exits */}
                {isDesktopApp &&
                  settings.startWithComputer &&
                  settings.closeBehavior === 'exit' && (
                    <div className="p-3 rounded-lg bg-sky-50 dark:bg-[#102033] border border-sky-200 dark:border-[#38bdf8]/35 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[12px] text-sky-900 dark:text-[#bae6fd] leading-relaxed flex-1 min-w-0">
                        {th.traySmartTip}
                      </p>
                      <button
                        type="button"
                        onClick={() => onChangeCloseBehavior?.('minimize-to-tray')}
                        className="px-3 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] dark:bg-[#1a9fff] dark:hover:bg-[#38adff] text-white text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {th.traySmartBtn}
                      </button>
                    </div>
                  )}

                <SettingsRow
                  icon={<DownloadSimple className="w-4 h-4" />}
                  title={t.startWithComputerTitle}
                  titleId="setting-start-with-computer"
                  description={t.startWithComputerDesc}
                  meta={
                    isDesktopApp ? (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-[#4ade80]">
                        · {t.desktopSupportedBadge}
                      </span>
                    ) : undefined
                  }
                  control={
                    <ToggleSwitch
                      checked={settings.startWithComputer}
                      disabled={isUpdatingAutoLaunch}
                      labelId="setting-start-with-computer"
                      onLabel={t.activeLabel}
                      offLabel={t.inactiveLabel}
                      onChange={onToggleStartWithComputer}
                    />
                  }
                >
                  {!isDesktopApp ? (
                    <p className="text-[11px] text-[#0284c7] dark:text-[#66c0f4]/85">
                      {t.webNotice}
                    </p>
                  ) : (
                    settings.startWithComputer && (
                      <p className="text-[11px] text-emerald-700 dark:text-[#4ade80]/90">
                        {t.trayActiveHint}
                      </p>
                    )
                  )}
                </SettingsRow>

                {/* Application Closing Behavior */}
                <div className="sa-ps5-subpanel p-3.5 sm:p-4 rounded-lg bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-slate-200/80 dark:bg-[#1a2433] border border-slate-300/70 dark:border-white/[0.08] text-[#0284c7] dark:text-[#66c0f4] flex items-center justify-center shrink-0 mt-0.5">
                      <AppWindow className="w-4 h-4" />
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <span className="block text-[13.5px] font-semibold text-slate-900 dark:text-white">
                        {t.closeBehaviorTitle}
                      </span>
                      <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                        {t.closeBehaviorDesc}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onChangeCloseBehavior?.('minimize-to-tray')}
                      className={`px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors text-start flex items-center gap-2 cursor-pointer ${
                        settings.closeBehavior === 'minimize-to-tray'
                          ? 'bg-[#0284c7]/15 dark:bg-[#66c0f4]/15 border-[#0284c7] dark:border-[#66c0f4] text-[#0369a1] dark:text-white'
                          : 'bg-white dark:bg-[#161c26] border-slate-200 dark:border-white/[0.09] text-slate-700 dark:text-[#b8c4d4] hover:bg-slate-100 dark:hover:bg-[#1d2532]'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          settings.closeBehavior === 'minimize-to-tray'
                            ? 'bg-[#0284c7] dark:bg-[#66c0f4]'
                            : 'bg-slate-400 dark:bg-[#5c6b7f]'
                        }`}
                      />
                      <span>{t.closeBehaviorMinimizeTray}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeCloseBehavior?.('exit')}
                      className={`px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors text-start flex items-center gap-2 cursor-pointer ${
                        settings.closeBehavior === 'exit'
                          ? 'bg-[#0284c7]/15 dark:bg-[#66c0f4]/15 border-[#0284c7] dark:border-[#66c0f4] text-[#0369a1] dark:text-white'
                          : 'bg-white dark:bg-[#161c26] border-slate-200 dark:border-white/[0.09] text-slate-700 dark:text-[#b8c4d4] hover:bg-slate-100 dark:hover:bg-[#1d2532]'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          settings.closeBehavior === 'exit'
                            ? 'bg-[#0284c7] dark:bg-[#66c0f4]'
                            : 'bg-slate-400 dark:bg-[#5c6b7f]'
                        }`}
                      />
                      <span>{t.closeBehaviorExit}</span>
                    </button>
                  </div>
                </div>

                {/* Full Application Shutdown */}
                <div className="sa-ps5-subpanel p-3.5 sm:p-4 rounded-lg bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Power className="w-4 h-4" />
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <span className="block text-[13.5px] font-semibold text-slate-900 dark:text-white">
                        {t.exitAppTitle}
                      </span>
                      <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                        {t.exitAppDesc}
                      </p>
                      {!isDesktopApp && (
                        <p className="text-[11px] text-[#0284c7] dark:text-[#66c0f4]/85">
                          {t.exitAppWebHint}
                        </p>
                      )}
                    </div>
                  </div>

                  {isDesktopApp && onExitApplication ? (
                    <ExitAppInlineConfirmButton
                      label={t.exitAppBtn}
                      confirmLabel={t.exitAppConfirmBtn}
                      cancelLabel={t.exitAppCancelBtn}
                      onConfirmExit={onExitApplication}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="px-3.5 py-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-500/60 text-[12px] font-semibold cursor-not-allowed shrink-0"
                    >
                      {t.exitAppBtn}
                    </button>
                  )}
                </div>

                <SettingsRow
                  icon={<Laptop className="w-4 h-4" />}
                  title={t.canRunItTitle}
                  titleId="setting-enable-can-run-it"
                  description={t.canRunItDesc}
                  control={
                    <ToggleSwitch
                      checked={settings.enableCanRunIt}
                      labelId="setting-enable-can-run-it"
                      onLabel={t.activeLabel}
                      offLabel={t.inactiveLabel}
                      onChange={onToggleEnableCanRunIt}
                    />
                  }
                />
              </section>
            )}

            {/* 4. Appearance & Theme Studio */}
            {shouldRenderSection('appearance') && (
              <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-4 shadow-sm dark:shadow-lg">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200 dark:border-white/[0.06]">
                  <span className="sa-icon-badge w-8 h-8 flex items-center justify-center shrink-0">
                    <Swatches className="w-4 h-4" />
                  </span>
                  <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-white tracking-normal">
                    {t.windowSectionTitle}
                  </h2>
                </div>

                {/* Smart 5-Card Theme Studio Switcher */}
                <div className="space-y-2.5">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                      {th.themeStudioTitle}
                    </div>
                    <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                      {th.themeStudioDesc}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(
                      [
                        {
                          id: 'dark' as const,
                          label: th.themeDefaultDark,
                          icon: <Moon className="w-4 h-4" />,
                          activeStyle:
                            'bg-sky-50 dark:bg-[#162538] border-[#0284c7] dark:border-[#38bdf8]',
                        },
                        {
                          id: 'light' as const,
                          label: th.themeCrispLight,
                          icon: <Sun className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
                          activeStyle: 'bg-amber-50 dark:bg-amber-950/35 border-amber-500',
                        },
                        {
                          id: 'ps5' as const,
                          label: th.themePs5,
                          icon: <Ps5Icon className="w-4 h-4 text-[#0284c7] dark:text-[#7cc4ff]" />,
                          activeStyle: 'bg-[#0f2342] border-[#38bdf8] text-white',
                        },
                        {
                          id: 'xbox' as const,
                          label: th.themeXbox,
                          icon: <XboxGlyph className="w-4 h-4 text-emerald-500" />,
                          activeStyle: 'bg-[#0c2611] border-[#52e042] text-white',
                        },
                        {
                          id: 'custom' as const,
                          label: th.themeCustom,
                          icon: <Sparkle className="w-4 h-4 text-violet-500 dark:text-violet-400" />,
                          activeStyle:
                            'bg-violet-50 dark:bg-violet-950/30 border-violet-500 dark:border-violet-400',
                        },
                      ]
                    ).map((item) => {
                      const active =
                        item.id === 'custom'
                          ? settings.customTheme.enabled
                          : activeThemeModeKey === item.id;
                      const isConsoleCard = item.id === 'ps5' || item.id === 'xbox';
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => selectQuickTheme(item.id)}
                          className={`sa-game-card sa-ps5-subpanel p-3 border text-start cursor-pointer flex flex-col justify-between gap-2 ${
                            active
                              ? item.activeStyle
                              : 'bg-slate-50 dark:bg-[#12171f] border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.18]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            {item.icon}
                            {active && (
                              <Check
                                weight="bold"
                                className={`w-3.5 h-3.5 ${
                                  active && isConsoleCard
                                    ? 'text-white'
                                    : 'text-[var(--sa-accent)]'
                                }`}
                              />
                            )}
                          </div>
                          <span
                            className={`text-[12px] font-semibold leading-tight ${
                              active && isConsoleCard
                                ? 'text-white'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Operating System Design Profile */}
                <div className="sa-ps5-subpanel p-4 rounded-xl bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5">
                    <div className="space-y-0.5">
                      <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                        {t.osThemeProfileTitle}
                      </div>
                      <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4] leading-snug">
                        {t.osThemeProfileDesc}
                      </p>
                    </div>
                    <span className="text-[11.5px] font-medium text-[#0284c7] dark:text-[#7cc4ff] shrink-0">
                      {activeOsTheme === 'linux'
                        ? t.osThemeLinuxLabel
                        : activeOsTheme === 'macos'
                        ? t.osThemeMacosLabel
                        : t.osThemeWindowsLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {(
                      [
                        {
                          id: 'auto' as const,
                          label: t.osThemeAutoLabel,
                          subtitle:
                            runtimePlatform === 'darwin'
                              ? 'macOS'
                              : runtimePlatform === 'linux'
                              ? 'Linux'
                              : 'Windows',
                          swatches: ['#0e141b', '#2e3440', '#2563eb'],
                        },
                        {
                          id: 'windows' as const,
                          label: t.osThemeWindowsLabel,
                          subtitle: 'Fluent Slate',
                          swatches: ['#0e141b', '#171d25', '#1a9fff'],
                        },
                        {
                          id: 'linux' as const,
                          label: t.osThemeLinuxLabel,
                          subtitle: 'Nordic Darker',
                          swatches: ['#242933', '#2e3440', '#88c0d0'],
                        },
                        {
                          id: 'macos' as const,
                          label: t.osThemeMacosLabel,
                          subtitle: 'Cobalt Glass',
                          swatches: ['#11132e', '#2563eb', '#38bdf8'],
                        },
                      ]
                    ).map((opt) => {
                      const selected = settings.osThemePreference === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onChangeOsThemePreference?.(opt.id)}
                          className={`group min-h-[56px] px-3.5 py-2.5 rounded-xl border text-start transition-all duration-150 cursor-pointer flex items-center justify-between gap-2.5 active:scale-[0.99] ${
                            selected
                              ? 'bg-[#0284c7]/12 dark:bg-[#38bdf8]/16 border-[#0284c7] dark:border-[#38bdf8] text-[#0369a1] dark:text-white shadow-xs'
                              : 'bg-white dark:bg-[#161c26] border-slate-200 dark:border-white/[0.09] text-slate-800 dark:text-[#d5dfed] hover:border-slate-300 dark:hover:border-white/[0.22] hover:bg-slate-50 dark:hover:bg-[#1b2230]'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center -space-x-1 shrink-0" aria-hidden="true">
                                {opt.swatches.map((hex, i) => (
                                  <span
                                    key={i}
                                    className="w-3 h-3 rounded-full border border-white/70 dark:border-white/30"
                                    style={{ backgroundColor: hex }}
                                  />
                                ))}
                              </span>
                              <span className="text-[12.5px] font-semibold leading-snug whitespace-normal">
                                {opt.label}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-[#8b9bb4] leading-tight">
                              {opt.subtitle}
                            </div>
                          </div>

                          {selected && (
                            <Check
                              weight="bold"
                              className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8] shrink-0"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* System Appearance Mode & Motion Intensity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* System / Dark / Light Appearance */}
                  <div className="sa-ps5-subpanel p-4 rounded-xl bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] flex flex-col justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                        {t.appearanceModeTitle}
                      </div>
                      <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4] leading-snug">
                        {th.themeStudioDesc}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(
                        [
                          {
                            id: 'system' as const,
                            label: t.appearanceSystemLabel,
                            icon: <Laptop className="w-3.5 h-3.5 shrink-0" />,
                          },
                          {
                            id: 'dark' as const,
                            label: t.appearanceDarkLabel,
                            icon: <Moon className="w-3.5 h-3.5 shrink-0" />,
                          },
                          {
                            id: 'light' as const,
                            label: t.appearanceLightLabel,
                            icon: <Sun className="w-3.5 h-3.5 shrink-0" />,
                          },
                        ]
                      ).map((opt) => {
                        const selected =
                          !hasConsoleTheme &&
                          settings.appearanceMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChangeAppearanceMode?.(opt.id)}
                            className={`min-h-[38px] px-3 py-2 rounded-lg border text-[12px] font-semibold transition-all duration-150 inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-[0.98] ${
                              selected
                                ? 'bg-[#0284c7]/14 dark:bg-[#38bdf8]/16 border-[#0284c7] dark:border-[#38bdf8] text-[#0369a1] dark:text-white shadow-xs'
                                : 'bg-white dark:bg-[#161c26] border-slate-200 dark:border-white/[0.09] text-slate-700 dark:text-[#b8c4d4] hover:border-slate-300 dark:hover:border-white/[0.22]'
                            }`}
                          >
                            {opt.icon}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Motion & Animations */}
                  <div className="sa-ps5-subpanel p-4 rounded-xl bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] flex flex-col justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                        {t.animationModeTitle}
                      </div>
                      <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4] leading-snug">
                        {t.animationModeDesc}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(
                        [
                          {
                            id: 'full' as const,
                            label: t.animationFullLabel,
                            icon: <Lightning className="w-3.5 h-3.5 shrink-0" />,
                          },
                          {
                            id: 'subtle' as const,
                            label: t.animationSubtleLabel,
                            icon: <Sparkle className="w-3.5 h-3.5 shrink-0" />,
                          },
                          {
                            id: 'reduced' as const,
                            label: t.animationReducedLabel,
                            icon: <Leaf className="w-3.5 h-3.5 shrink-0" />,
                          },
                        ]
                      ).map((opt) => {
                        const selected = settings.animationMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChangeAnimationMode?.(opt.id)}
                            className={`min-h-[38px] px-3 py-2 rounded-lg border text-[12px] font-semibold transition-all duration-150 inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-[0.98] ${
                              selected
                                ? 'bg-[#0284c7]/14 dark:bg-[#38bdf8]/16 border-[#0284c7] dark:border-[#38bdf8] text-[#0369a1] dark:text-white shadow-xs'
                                : 'bg-white dark:bg-[#161c26] border-slate-200 dark:border-white/[0.09] text-slate-700 dark:text-[#b8c4d4] hover:border-slate-300 dark:hover:border-white/[0.22]'
                            }`}
                          >
                            {opt.icon}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {onRestoreDefaultThemes && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={onRestoreDefaultThemes}
                      className="sa-btn-secondary w-full sm:w-auto justify-center min-h-[38px] px-4 py-2 text-[12.5px]"
                    >
                      <ArrowCounterClockwise className="w-4 h-4 shrink-0" />
                      <span>{t.restoreThemeDefaultsBtn}</span>
                    </button>
                  </div>
                )}

                {/* Custom Theme Builder (layers on Windows, Linux, macOS, PS5, or Xbox) */}
                <CustomThemeBuilder
                  language={settings.language}
                  customTheme={settings.customTheme}
                  hasConsoleThemeActive={hasConsoleTheme}
                  activeBaseTheme={
                    settings.alwaysXboxTheme ? 'xbox' : settings.alwaysPs5Theme ? 'ps5' : 'default'
                  }
                  activeOsTheme={activeOsTheme}
                  isDarkMode={!resolveEffectiveLightMode(settings, systemPrefersDark)}
                  onUpdateCustomTheme={onUpdateCustomTheme}
                  onResetCustomTheme={onResetCustomTheme}
                />

                <SettingsRow
                  icon={<AppWindow className="w-4 h-4" />}
                  title={t.compactNavbarTitle}
                  titleId="setting-compact-navbar"
                  description={t.compactNavbarDesc}
                  control={
                    <ToggleSwitch
                      checked={settings.compactNavbar}
                      labelId="setting-compact-navbar"
                      onLabel={t.activeLabel}
                      offLabel={t.inactiveLabel}
                      onChange={onToggleCompactNavbar}
                    />
                  }
                />

                <SettingsRow
                  icon={<CursorClick className="w-4 h-4" />}
                  title={t.customCursorTitle}
                  titleId="setting-custom-cursor"
                  description={t.customCursorDesc}
                  control={
                    <ToggleSwitch
                      checked={settings.customCursorEnabled}
                      labelId="setting-custom-cursor"
                      onLabel={t.activeLabel}
                      offLabel={t.inactiveLabel}
                      onChange={onToggleCustomCursor}
                    />
                  }
                />
              </section>
            )}

            {/* 5. Audio & Soundscape */}
            {shouldRenderSection('audio') && (
              <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-3.5 shadow-sm dark:shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200 dark:border-white/[0.06]">
                  <div className="flex items-start gap-2.5">
                    <SpeakerHigh className="w-4 h-4 text-[#0284c7] dark:text-[#66c0f4] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-white tracking-normal">
                        {t.audioSectionTitle}
                      </h2>
                      <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4]">
                        {t.audioSectionDesc}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11.5px] font-medium text-slate-500 dark:text-[#8b9bb4]">
                    {hasConsoleTheme && settings.ambientMusicEnabled && settings.soundVolume > 0
                      ? th.audioStatusConsoleActive
                      : th.audioStatusStandby}
                  </div>
                </div>

                {!hasConsoleTheme && (
                  <div className="px-3 py-2 rounded-lg bg-sky-50 dark:bg-[#121a26] border border-sky-200 dark:border-[#1a9fff]/25 text-[11.5px] text-sky-800 dark:text-[#9fb0c7]">
                    {t.consoleThemeAudioHint}
                  </div>
                )}

                <SettingsRow
                  icon={<MusicNotes className="w-4 h-4" />}
                  title={t.ambientMusicTitle}
                  titleId="setting-ambient-music"
                  description={t.ambientMusicDesc}
                  control={
                    <ToggleSwitch
                      checked={settings.ambientMusicEnabled}
                      labelId="setting-ambient-music"
                      onLabel={t.activeLabel}
                      offLabel={t.inactiveLabel}
                      onChange={onToggleAmbientMusic}
                    />
                  }
                />

                <SettingsRow
                  icon={<CursorClick className="w-4 h-4" />}
                  title={t.uiSoundsTitle}
                  titleId="setting-ui-sounds"
                  description={t.uiSoundsDesc}
                  control={
                    <ToggleSwitch
                      checked={settings.uiClickSoundsEnabled}
                      labelId="setting-ui-sounds"
                      onLabel={t.activeLabel}
                      offLabel={t.inactiveLabel}
                      onChange={onToggleUiClickSounds}
                    />
                  }
                />

                {/* Master Sound Volume + Quick Presets + Test Sound */}
                <div className="sa-ps5-subpanel p-3.5 sm:p-4 rounded-lg bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-slate-200/80 dark:bg-[#1a2433] border border-slate-300/70 dark:border-white/[0.08] text-[#0284c7] dark:text-[#66c0f4] flex items-center justify-center shrink-0 mt-0.5">
                        <VolumeIcon className="w-4 h-4" />
                      </span>
                      <div className="space-y-0.5 min-w-0">
                        <label
                          htmlFor="setting-sound-volume"
                          className="block text-[13.5px] font-semibold text-slate-900 dark:text-white"
                        >
                          {t.volumeTitle}
                        </label>
                        <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                          {t.volumeDesc}
                        </p>
                      </div>
                    </div>

                    <div dir="ltr" className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                      <input
                        id="setting-sound-volume"
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.soundVolume}
                        onChange={(e) => onChangeSoundVolume(Number(e.target.value))}
                        onPointerUp={() => onPreviewSoundVolume?.()}
                        onKeyUp={(e) => {
                          if (
                            e.key === 'ArrowLeft' ||
                            e.key === 'ArrowRight' ||
                            e.key === 'ArrowUp' ||
                            e.key === 'ArrowDown' ||
                            e.key === 'Home' ||
                            e.key === 'End' ||
                            e.key === 'PageUp' ||
                            e.key === 'PageDown'
                          ) {
                            onPreviewSoundVolume?.();
                          }
                        }}
                        aria-label={t.volumeTitle}
                        className="flex-1 sm:w-48 h-2 rounded-full cursor-pointer bg-slate-200 dark:bg-[#0e131b] accent-[#1a9fff]"
                      />
                      <span className="w-12 text-end text-[12.5px] font-bold font-mono-tabular text-slate-800 dark:text-[#66c0f4] shrink-0">
                        {settings.soundVolume}%
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { value: 0, label: th.volumeMute },
                          { value: 30, label: th.volumeLow },
                          { value: 70, label: th.volumeBalanced },
                          { value: 100, label: th.volumeMax },
                        ] as const
                      ).map((preset) => {
                        const active = settings.soundVolume === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => {
                              onChangeSoundVolume(preset.value);
                              if (preset.value > 0) {
                                window.setTimeout(() => onPreviewSoundVolume?.(), 30);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#0284c7] dark:bg-[#1a9fff] border-[#0284c7] dark:border-[#38bdf8] text-white'
                                : 'bg-white dark:bg-[#171e28] border-slate-200 dark:border-white/[0.09] text-slate-700 dark:text-[#cbd5e1] hover:border-slate-300 dark:hover:border-white/[0.2]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {onPreviewSoundVolume && (
                      <button
                        type="button"
                        disabled={settings.soundVolume <= 0}
                        onClick={onPreviewSoundVolume}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 dark:bg-[#1e2633] dark:hover:bg-[#273142] border border-slate-200 dark:border-white/[0.1] text-[11.5px] font-semibold text-slate-800 dark:text-white disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <SpeakerHigh className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#66c0f4]" />
                        <span>{th.audioPreviewBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* 6. Performance & Resource Mode */}
            {shouldRenderSection('performance') && (
              <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-4 shadow-sm dark:shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-2.5 border-b border-slate-200 dark:border-white/[0.06]">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="w-9 h-9 rounded-lg bg-sky-500/10 dark:bg-[#1a9fff]/15 border border-sky-500/25 dark:border-[#1a9fff]/35 text-[#0284c7] dark:text-[#66c0f4] flex items-center justify-center shrink-0">
                      <Gauge className="w-4.5 h-4.5" />
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-white tracking-normal">
                          {tPerf.sectionTitle}
                        </h2>
                        <span className="text-[11.5px] font-semibold text-emerald-700 dark:text-[#4ade80]">
                          · {tPerf.liveApplyBadge}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                        {tPerf.sectionSubtitle}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3 Performance Preset Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(
                    [
                      {
                        id: 'eco' as const,
                        title: tPerf.modeEcoTitle,
                        desc: tPerf.modeEcoDesc,
                        Icon: Leaf,
                        recommended: false,
                      },
                      {
                        id: 'balanced' as const,
                        title: tPerf.modeBalancedTitle,
                        desc: tPerf.modeBalancedDesc,
                        Icon: Scales,
                        recommended: true,
                      },
                      {
                        id: 'performance' as const,
                        title: tPerf.modePerformanceTitle,
                        desc: tPerf.modePerformanceDesc,
                        Icon: Lightning,
                        recommended: false,
                      },
                    ]
                  ).map(({ id, title, desc, Icon, recommended }) => {
                    const isSelected = settings.performanceMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onChangePerformanceMode?.(id)}
                        aria-pressed={isSelected}
                        className={`p-3.5 rounded-lg border text-start transition-colors flex flex-col gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#0284c7]/12 dark:bg-[#1a9fff]/15 border-[#0284c7] dark:border-[#38bdf8]'
                            : 'bg-slate-50 dark:bg-[#12171f] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.18]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 font-semibold text-[13.5px] text-slate-900 dark:text-white">
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                isSelected
                                  ? 'text-[#0284c7] dark:text-[#38bdf8]'
                                  : 'text-slate-500 dark:text-[#8b9bb4]'
                              }`}
                            />
                            <span>{title}</span>
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {recommended && !isSelected && (
                              <span className="text-[10.5px] font-semibold text-slate-500 dark:text-[#9fb0c7]">
                                {tPerf.recommendedBadge}
                              </span>
                            )}
                            {isSelected && (
                              <Check
                                weight="bold"
                                className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]"
                              />
                            )}
                          </div>
                        </div>
                        <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                          {desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Live Effective Parameters Readout */}
                <div className="sa-ps5-subpanel p-3.5 rounded-lg bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] space-y-2.5">
                  <div className="text-[12px] font-semibold text-slate-700 dark:text-[#cbd5e1]">
                    {th.effectiveParamsTitle}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-md bg-white dark:bg-[#0e131b] border border-slate-200 dark:border-white/[0.06]">
                      <div className="text-[10.5px] text-slate-500 dark:text-[#8b9bb4]">
                        {th.effectiveHwPoll}
                      </div>
                      <div dir="ltr" className="text-[13px] font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {effectivePerf.hardwarePollIntervalMs} ms
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md bg-white dark:bg-[#0e131b] border border-slate-200 dark:border-white/[0.06]">
                      <div className="text-[10.5px] text-slate-500 dark:text-[#8b9bb4]">
                        {th.effectiveUiCoalesce}
                      </div>
                      <div dir="ltr" className="text-[13px] font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {effectivePerf.downloadUiThrottleMs} ms
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md bg-white dark:bg-[#0e131b] border border-slate-200 dark:border-white/[0.06]">
                      <div className="text-[10.5px] text-slate-500 dark:text-[#8b9bb4]">
                        {th.effectiveTorrentPoll}
                      </div>
                      <div dir="ltr" className="text-[13px] font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {Math.round(effectivePerf.torrentActivePollMs / 1000)}s / {Math.round(effectivePerf.torrentIdlePollMs / 1000)}s
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md bg-white dark:bg-[#0e131b] border border-slate-200 dark:border-white/[0.06]">
                      <div className="text-[10.5px] text-slate-500 dark:text-[#8b9bb4]">
                        {th.effectiveCacheCap}
                      </div>
                      <div dir="ltr" className="text-[13px] font-bold font-mono-tabular text-[#0284c7] dark:text-[#38bdf8]">
                        {effectivePerf.maxImageCacheEntries}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Advanced Resource Controls */}
                <div className="rounded-lg border border-slate-200 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#12171f]/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedPerf((prev) => !prev)}
                    aria-expanded={showAdvancedPerf}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-start hover:bg-slate-100/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <SlidersHorizontal className="w-4 h-4 text-[#0284c7] dark:text-[#66c0f4] shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-slate-900 dark:text-white">
                          {tPerf.advancedTitle}
                        </span>
                        <span className="block text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                          {tPerf.advancedDesc}
                        </span>
                      </span>
                    </span>
                    {showAdvancedPerf ? (
                      <CaretUp className="w-4 h-4 text-slate-500 dark:text-[#8b9bb4] shrink-0" />
                    ) : (
                      <CaretDown className="w-4 h-4 text-slate-500 dark:text-[#8b9bb4] shrink-0" />
                    )}
                  </button>

                  {showAdvancedPerf && (
                    <div className="p-3.5 sm:p-4 pt-2 border-t border-slate-200 dark:border-white/[0.06] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1.5">
                        <div className="space-y-0.5 min-w-0">
                          <span
                            id="perf-pause-minimize"
                            className="block text-[12.5px] font-semibold text-slate-900 dark:text-white"
                          >
                            {tPerf.pauseOnMinimizeTitle}
                          </span>
                          <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                            {tPerf.pauseOnMinimizeDesc}
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={settings.performanceAdvanced.pauseBackgroundWhenMinimized}
                          labelId="perf-pause-minimize"
                          onLabel={t.activeLabel}
                          offLabel={t.inactiveLabel}
                          onChange={(next) =>
                            onUpdatePerformanceAdvanced?.({ pauseBackgroundWhenMinimized: next })
                          }
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1.5 border-t border-slate-200/70 dark:border-white/[0.05]">
                        <div className="space-y-0.5 min-w-0">
                          <span
                            id="perf-reduce-effects"
                            className="block text-[12.5px] font-semibold text-slate-900 dark:text-white"
                          >
                            {tPerf.reduceEffectsTitle}
                          </span>
                          <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                            {tPerf.reduceEffectsDesc}
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={effectivePerf.reduceVisualEffects}
                          disabled={settings.performanceMode === 'eco'}
                          labelId="perf-reduce-effects"
                          onLabel={t.activeLabel}
                          offLabel={t.inactiveLabel}
                          onChange={(next) =>
                            onUpdatePerformanceAdvanced?.({ reduceVisualEffects: next })
                          }
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1.5 border-t border-slate-200/70 dark:border-white/[0.05]">
                        <div className="space-y-0.5 min-w-0">
                          <span
                            id="perf-adaptive-torrent"
                            className="block text-[12.5px] font-semibold text-slate-900 dark:text-white"
                          >
                            {tPerf.adaptiveTorrentTitle}
                          </span>
                          <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                            {tPerf.adaptiveTorrentDesc}
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={settings.performanceAdvanced.adaptiveTorrentPolling}
                          labelId="perf-adaptive-torrent"
                          onLabel={t.activeLabel}
                          offLabel={t.inactiveLabel}
                          onChange={(next) =>
                            onUpdatePerformanceAdvanced?.({ adaptiveTorrentPolling: next })
                          }
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1.5 border-t border-slate-200/70 dark:border-white/[0.05]">
                        <div className="space-y-0.5 min-w-0">
                          <span
                            id="perf-defer-sync"
                            className="block text-[12.5px] font-semibold text-slate-900 dark:text-white"
                          >
                            {tPerf.deferSyncTitle}
                          </span>
                          <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                            {tPerf.deferSyncDesc}
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={effectivePerf.deferBackgroundChecks}
                          disabled={settings.performanceMode === 'eco'}
                          labelId="perf-defer-sync"
                          onLabel={t.activeLabel}
                          offLabel={t.inactiveLabel}
                          onChange={(next) =>
                            onUpdatePerformanceAdvanced?.({ deferBackgroundChecks: next })
                          }
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1.5 border-t border-slate-200/70 dark:border-white/[0.05]">
                        <div className="space-y-0.5 min-w-0">
                          <span className="block text-[12.5px] font-semibold text-slate-900 dark:text-white">
                            {tPerf.hwIntervalTitle}
                          </span>
                          <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                            {tPerf.hwIntervalDesc}
                          </p>
                        </div>
                        <div dir="ltr" className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {(['auto', 1000, 1500, 2000, 3000, 5000] as const).map((val) => {
                            const active =
                              settings.performanceAdvanced.hardwareMonitorIntervalMs === val;
                            return (
                              <button
                                key={String(val)}
                                type="button"
                                onClick={() =>
                                  onUpdatePerformanceAdvanced?.({
                                    hardwareMonitorIntervalMs: val,
                                  })
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-mono-tabular font-semibold border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#0284c7] dark:bg-[#1a9fff] border-[#0284c7] dark:border-[#38bdf8] text-white'
                                    : 'bg-white dark:bg-[#0e131b] border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-[#cbd5e1] hover:border-slate-300 dark:hover:border-white/[0.22]'
                                }`}
                              >
                                {val === 'auto' ? tPerf.hwIntervalAuto : `${val / 1000}s`}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1.5 border-t border-slate-200/70 dark:border-white/[0.05]">
                        <div className="space-y-0.5 min-w-0">
                          <span className="block text-[12.5px] font-semibold text-slate-900 dark:text-white">
                            {tPerf.dlThrottleTitle}
                          </span>
                          <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                            {tPerf.dlThrottleDesc}
                          </p>
                        </div>
                        <div dir="ltr" className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {(['auto', 200, 350, 750] as const).map((val) => {
                            const active =
                              settings.performanceAdvanced.downloadUiThrottleMs === val;
                            return (
                              <button
                                key={String(val)}
                                type="button"
                                onClick={() =>
                                  onUpdatePerformanceAdvanced?.({ downloadUiThrottleMs: val })
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-mono-tabular font-semibold border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#0284c7] dark:bg-[#1a9fff] border-[#0284c7] dark:border-[#38bdf8] text-white'
                                    : 'bg-white dark:bg-[#0e131b] border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-[#cbd5e1] hover:border-slate-300 dark:hover:border-white/[0.22]'
                                }`}
                              >
                                {val === 'auto' ? tPerf.dlThrottleAuto : `${val} ms`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* On-Demand Runtime Footprint Panel */}
                <div className="sa-ps5-subpanel p-3.5 sm:p-4 rounded-lg bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <ChartLineUp className="w-4 h-4 text-[#0284c7] dark:text-[#66c0f4] shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                          {tPerf.auditTitle}
                        </div>
                        <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                          {tPerf.auditDesc}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isSamplingPerf}
                      onClick={() => void sampleRuntimeFootprint()}
                      className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg bg-white hover:bg-slate-100 dark:bg-[#1e2633] dark:hover:bg-[#273142] border border-slate-200 dark:border-white/[0.1] text-[11.5px] font-semibold text-slate-800 dark:text-white disabled:opacity-55 transition-colors cursor-pointer shrink-0"
                    >
                      <ArrowsClockwise
                        className={`w-3.5 h-3.5 ${
                          isSamplingPerf ? 'motion-safe:animate-spin' : ''
                        }`}
                      />
                      <span>{tPerf.auditRefreshBtn}</span>
                    </button>
                  </div>

                  {desktopPerfMetrics ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 rounded-md bg-white dark:bg-[#0e131b] border border-slate-200 dark:border-white/[0.06]">
                          <div className="text-[10.5px] text-slate-500 dark:text-[#8b9bb4]">
                            {tPerf.auditMainCpuLabel}
                          </div>
                          <div dir="ltr" className="text-[13px] font-bold font-mono-tabular text-slate-900 dark:text-white">
                            {desktopPerfMetrics.mainCpuPercent.toFixed(1)}%
                          </div>
                        </div>
                        <div className="p-2.5 rounded-md bg-white dark:bg-[#0e131b] border border-slate-200 dark:border-white/[0.06]">
                          <div className="text-[10.5px] text-slate-500 dark:text-[#8b9bb4]">
                            {tPerf.auditMainHeapLabel}
                          </div>
                          <div dir="ltr" className="text-[13px] font-bold font-mono-tabular text-slate-900 dark:text-white">
                            {desktopPerfMetrics.mainHeapUsedMB.toFixed(1)} MB
                          </div>
                        </div>
                        <div className="p-2.5 rounded-md bg-white dark:bg-[#0e131b] border border-slate-200 dark:border-white/[0.06]">
                          <div className="text-[10.5px] text-slate-500 dark:text-[#8b9bb4]">
                            {tPerf.auditMainRssLabel}
                          </div>
                          <div dir="ltr" className="text-[13px] font-bold font-mono-tabular text-slate-900 dark:text-white">
                            {desktopPerfMetrics.mainProcessRssMB.toFixed(1)} MB
                          </div>
                        </div>
                        <div className="p-2.5 rounded-md bg-white dark:bg-[#0e131b] border border-slate-200 dark:border-white/[0.06]">
                          <div className="text-[10.5px] text-slate-500 dark:text-[#8b9bb4]">
                            {tPerf.auditTotalProcessesLabel}
                          </div>
                          <div dir="ltr" className="text-[13px] font-bold font-mono-tabular text-[#0284c7] dark:text-[#38bdf8]">
                            {desktopPerfMetrics.totalAppRssMB.toFixed(1)} MB ({desktopPerfMetrics.processCount})
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600 dark:text-[#9cb0c9]">
                        <span>
                          {tPerf.auditHwMonitorLabel}:{' '}
                          <strong className="text-slate-900 dark:text-white">
                            {desktopPerfMetrics.pollers.hardwareMonitorActive
                              ? `${tPerf.auditStateActive} (${desktopPerfMetrics.pollers.hardwareIntervalMs ?? effectivePerf.hardwarePollIntervalMs}ms)`
                              : desktopPerfMetrics.pollers.hardwarePausedByHide
                              ? tPerf.auditStatePausedHidden
                              : tPerf.auditStateOff}
                          </strong>
                        </span>
                        <span>
                          {tPerf.auditDownloadsLabel}:{' '}
                          <strong dir="ltr" className="font-mono-tabular text-slate-900 dark:text-white">
                            {desktopPerfMetrics.pollers.activeDownloadsCount}
                          </strong>
                        </span>
                        <span>
                          {tPerf.auditTorrentPollerLabel}:{' '}
                          <strong className="text-slate-900 dark:text-white">
                            {desktopPerfMetrics.pollers.torrentPollerActive
                              ? `${tPerf.auditStateActive} (${desktopPerfMetrics.pollers.torrentPollIntervalMs ?? effectivePerf.torrentActivePollMs}ms)`
                              : tPerf.auditStateIdle}
                          </strong>
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">
                        {tPerf.auditGpuProcessNote}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[11.5px] text-slate-600 dark:text-[#8b9bb4]">
                      {webPerfSample && (
                        <div className="flex flex-wrap items-center gap-4">
                          <span>
                            JS Heap:{' '}
                            <strong dir="ltr" className="font-mono-tabular text-slate-900 dark:text-white">
                              {webPerfSample.jsHeapUsedMB !== null
                                ? `${webPerfSample.jsHeapUsedMB} MB`
                                : 'N/A'}
                            </strong>
                          </span>
                          <span>
                            DOM Nodes:{' '}
                            <strong dir="ltr" className="font-mono-tabular text-slate-900 dark:text-white">
                              {webPerfSample.domNodes}
                            </strong>
                          </span>
                          <span>
                            Poll Interval:{' '}
                            <strong dir="ltr" className="font-mono-tabular text-slate-900 dark:text-white">
                              {effectivePerf.hardwarePollIntervalMs} ms
                            </strong>
                          </span>
                        </div>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">
                        {tPerf.auditWebNote}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 7. Storage, Cache & Portable Backup */}
            {shouldRenderSection('storage') && (
              <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-3.5 shadow-sm dark:shadow-lg">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200 dark:border-white/[0.06]">
                  <FolderOpen className="w-4 h-4 text-[#0284c7] dark:text-[#66c0f4] shrink-0" />
                  <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-white tracking-normal">
                    {t.downloadSectionTitle}
                  </h2>
                </div>

                {/* Download Directory + Disk Meter */}
                <div className="sa-ps5-subpanel p-3.5 sm:p-4 rounded-lg bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white">
                        {t.downloadFolderTitle}
                      </div>
                      <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                        {t.downloadFolderDesc}
                      </p>
                      {downloadFolder && (
                        <p
                          dir="ltr"
                          className="pt-1 text-[12px] font-mono-tabular text-[#0284c7] dark:text-[#66c0f4] break-all"
                        >
                          {downloadFolder}
                        </p>
                      )}
                    </div>

                    {isDesktopApp && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onChooseDownloadFolder?.()}
                          className="sa-btn-primary min-h-[40px] px-3.5 py-2 text-[12.5px]"
                        >
                          <FolderOpen className="w-4 h-4" />
                          <span>{t.chooseFolderBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDownloadFolder?.()}
                          className="sa-btn-secondary min-h-[40px] px-3.5 py-2 text-[12.5px]"
                        >
                          <ArrowSquareOut className="w-4 h-4" />
                          <span>{t.openFolderBtn}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {systemSpecs?.freeSpaceGB != null && (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.05] space-y-1.5">
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="font-medium text-slate-600 dark:text-[#8b9bb4]">
                          {th.specsDiskFreeLabel}
                        </span>
                        <span dir="ltr" className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                          {systemSpecs.freeSpaceGB} GB {th.diskFreeLabel}
                          {systemSpecs.totalSpaceGB ? ` / ${systemSpecs.totalSpaceGB} GB` : ''}
                        </span>
                      </div>
                      {diskPct !== null && (
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#0e131b] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              diskPct > 88
                                ? 'bg-rose-500'
                                : diskPct > 72
                                ? 'bg-amber-500'
                                : 'bg-[var(--sa-accent)]'
                            }`}
                            style={{ width: `${diskPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cache Maintenance */}
                <div className="sa-ps5-subpanel p-3.5 sm:p-4 rounded-lg bg-slate-50 dark:bg-[#12171f] border border-slate-200 dark:border-white/[0.07] space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="sa-icon-badge w-8 h-8 flex items-center justify-center shrink-0 mt-0.5">
                      <Database className="w-4 h-4" />
                    </span>
                    <div className="space-y-0.5">
                      <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white">
                        {th.cacheSectionTitle}
                      </div>
                      <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                        {th.cacheSectionDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleClearDealsCache}
                      className="sa-btn-secondary min-h-[36px] px-3 py-1.5 text-[12px]"
                    >
                      <Broom className="w-3.5 h-3.5 text-[var(--sa-accent)]" />
                      <span>{th.clearDealsCacheBtn}</span>
                    </button>

                    <button
                      type="button"
                      disabled={clearingImageCache}
                      onClick={() => void handleClearArtworkCache()}
                      className="sa-btn-secondary min-h-[36px] px-3 py-1.5 text-[12px] disabled:opacity-55"
                    >
                      <FloppyDisk className="w-3.5 h-3.5 text-[var(--sa-accent)]" />
                      <span>{th.clearImageCacheBtn}</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* 8. App Version, Updates, History & Notifications */}
            {shouldRenderSection('updates') && (
              <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-3.5 shadow-sm dark:shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="sa-icon-badge w-9 h-9 flex items-center justify-center shrink-0">
                      <ClockCounterClockwise className="w-4.5 h-4.5" />
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-white tracking-normal">
                          {tr.updateHistory.settingsCardTitle}
                        </h2>
                        <span
                          dir="ltr"
                          className="text-[12px] font-mono-tabular font-semibold text-[var(--sa-accent)]"
                        >
                          · v{currentVersion}
                        </span>
                        {desktopUpdateState?.availableVersion && (
                          <span
                            dir="ltr"
                            className="text-[11.5px] font-mono-tabular font-semibold text-emerald-700 dark:text-[#4ade80]"
                          >
                            · {desktopUpdateState.status} (v{desktopUpdateState.availableVersion})
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                        {tr.updateHistory.settingsCardDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {onOpenUpdater && (
                      <button
                        type="button"
                        onClick={() => {
                          onCheckForUpdates?.();
                          onOpenUpdater();
                        }}
                        className="sa-btn-secondary min-h-[38px] px-3.5 py-1.5 text-[12px]"
                      >
                        <DownloadSimple className="w-4 h-4 text-[var(--sa-accent)]" />
                        <span>{th.openUpdaterBtn}</span>
                      </button>
                    )}

                    {onOpenNotifications && (
                      <button
                        type="button"
                        onClick={onOpenNotifications}
                        className="sa-btn-secondary min-h-[38px] px-3.5 py-1.5 text-[12px]"
                      >
                        <Bell className="w-4 h-4 text-[var(--sa-accent)]" />
                        <span>{tr.notificationCenter.title}</span>
                      </button>
                    )}

                    {onOpenUpdateHistory && (
                      <button
                        type="button"
                        onClick={onOpenUpdateHistory}
                        className="sa-btn-primary min-h-[38px] px-3.5 py-1.5 text-[12px]"
                      >
                        <ClockCounterClockwise className="w-4 h-4" />
                        <span>{tr.updateHistory.openHistoryBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
