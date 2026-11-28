import { useEffect, useRef, useState } from 'react';
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  CaretRight,
  Check,
  CheckCircle,
  Desktop,
  DownloadSimple,
  Eye,
  EyeSlash,
  Gauge,
  Gear,
  Globe,
  House,
  Key,
  Magnet,
  Moon,
  Palette,
  Play,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  SpinnerGap,
  Sun,
  WarningCircle,
} from '@phosphor-icons/react';
import type {
  QbitSetupStage,
  QbitSetupState,
  TorrentConnectionTestResult,
  TorrentIntegrationConfig,
} from '../types';
import {
  getAppVersionString,
  type AppLanguage,
  type AppThemeMode,
  type CustomThemeConfig,
  type LauncherSettings,
  type ResolvedOsTheme,
} from '../services/launcherSettings';
import { getTranslations, LANGUAGE_OPTIONS } from '../i18n/translations';
import { formatBytes, formatDownloadSpeed, formatEta } from '../services/downloadManager';
import { QBIT_OFFICIAL_LOGO_URL } from '../services/qbitSetup';
import { CustomThemeBuilder } from './CustomThemeBuilder';
import { Ps5Icon } from './SectionBadge';

export type OnboardingThemeChoice = 'dark' | 'light' | 'ps5' | 'xbox';
type OnboardingStepId =
  | 'welcome'
  | 'preferences'
  | 'qbit_check'
  | 'qbit_integration'
  | 'complete';

interface FirstLaunchOnboardingProps {
  isDesktopApp: boolean;
  desktopVersion?: string | null;
  settings: LauncherSettings;
  activeTheme: AppThemeMode;
  activeOsTheme?: ResolvedOsTheme;
  setupState: QbitSetupState;
  torrentConfig: TorrentIntegrationConfig;
  torrentConnected: boolean;
  onSelectTheme: (choice: OnboardingThemeChoice) => void;
  onUpdateCustomTheme: (patch: Partial<CustomThemeConfig>) => void;
  onResetCustomTheme: () => void;
  onChangeLanguage: (language: AppLanguage) => void;
  onRecheckQbit: () => Promise<void> | void;
  onStartQbitInstall: (userConfirmed: boolean) => Promise<void> | void;
  onLaunchQbitClient: () => Promise<void> | void;
  onOpenOfficialQbitDownload: () => void;
  onGenerateQbitPassword: () => Promise<string>;
  onSaveAndVerifyWebUi: (
    cfg: Partial<TorrentIntegrationConfig>
  ) => Promise<TorrentConnectionTestResult | null>;
  onCompleteOnboarding: (destination: 'store' | 'settings') => void;
}

const ORDERED_INSTALL_STEPS: QbitSetupStage[] = [
  'checking_dependencies',
  'detecting_qbit',
  'downloading',
  'verifying',
  'installing',
  'configuring',
  'completed',
];

function getInstallRank(stage: QbitSetupStage): number {
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

export function FirstLaunchOnboarding({
  isDesktopApp,
  desktopVersion = null,
  settings,
  activeTheme,
  activeOsTheme = 'windows',
  setupState,
  torrentConfig,
  torrentConnected,
  onSelectTheme,
  onUpdateCustomTheme,
  onResetCustomTheme,
  onChangeLanguage,
  onRecheckQbit,
  onStartQbitInstall,
  onLaunchQbitClient,
  onOpenOfficialQbitDownload,
  onGenerateQbitPassword,
  onSaveAndVerifyWebUi,
  onCompleteOnboarding,
}: FirstLaunchOnboardingProps) {
  const tr = getTranslations(settings.language);
  const t = tr.onboarding;
  const tq = tr.qbitSetup;
  const ts = tr.settings;
  const isRtl = settings.language === 'ar';
  const currentVersion = desktopVersion || getAppVersionString();

  const [step, setStep] = useState<OnboardingStepId>('welcome');
  const [brandLogoFailed, setBrandLogoFailed] = useState(false);
  const [qbitLogoFailed, setQbitLogoFailed] = useState(false);
  const [torrentSkipped, setTorrentSkipped] = useState(false);

  const installStartedHereRef = useRef(false);
  const [justInstalledBanner, setJustInstalledBanner] = useState(false);

  const [port, setPort] = useState<number>(torrentConfig.port || 8080);
  const [username, setUsername] = useState<string>(torrentConfig.username || 'admin');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingWebUi, setIsVerifyingWebUi] = useState(false);
  const [webUiTestResult, setWebUiTestResult] = useState<TorrentConnectionTestResult | null>(null);

  const [congratsProgress, setCongratsProgress] = useState(0);
  const [launchTarget, setLaunchTarget] = useState<'store' | 'settings'>('store');
  const [isLaunchingOut, setIsLaunchingOut] = useState(false);

  const currentThemeChoice: OnboardingThemeChoice = settings.alwaysPs5Theme
    ? 'ps5'
    : settings.alwaysXboxTheme
    ? 'xbox'
    : settings.lightMode
    ? 'light'
    : 'dark';

  const isPs5Theme = activeTheme === 'ps5';
  const isXboxTheme = activeTheme === 'xbox';
  const isConsoleTheme = isPs5Theme || isXboxTheme;

  const DirectionalArrow = isRtl ? ArrowLeft : ArrowRight;
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const hasTriggeredStep3CheckRef = useRef(false);
  useEffect(() => {
    if (step !== 'qbit_check') {
      hasTriggeredStep3CheckRef.current = false;
      return;
    }
    if (hasTriggeredStep3CheckRef.current) return;
    hasTriggeredStep3CheckRef.current = true;
    setJustInstalledBanner(false);
    if (isDesktopApp) {
      void onRecheckQbit();
    }
  }, [step, isDesktopApp, onRecheckQbit]);

  useEffect(() => {
    if (
      step === 'qbit_check' &&
      installStartedHereRef.current &&
      setupState.installed &&
      setupState.stage === 'completed'
    ) {
      installStartedHereRef.current = false;
      setJustInstalledBanner(true);
      const timer = window.setTimeout(() => {
        setStep('qbit_integration');
      }, 1150);
      return () => window.clearTimeout(timer);
    }
  }, [step, setupState.installed, setupState.stage]);

  useEffect(() => {
    if (step !== 'qbit_integration') return;
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
    step,
    setupState.webUiConfig.configFound,
    setupState.webUiConfig.port,
    setupState.webUiConfig.username,
    torrentConfig.port,
    torrentConfig.username,
  ]);

  useEffect(() => {
    if (step !== 'complete') {
      setCongratsProgress(0);
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setCongratsProgress(100);
      return;
    }

    let rafId = 0;
    const durationMs = 1450;
    const startAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startAt;
      const ratio = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setCongratsProgress(Math.round(eased * 100));
      if (ratio < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [step]);

  const isBusyInstall =
    setupState.stage === 'checking_dependencies' ||
    setupState.stage === 'detecting_qbit' ||
    setupState.stage === 'fetching_release' ||
    setupState.stage === 'downloading' ||
    setupState.stage === 'verifying' ||
    setupState.stage === 'installing' ||
    setupState.stage === 'configuring';

  const isScanningOnly =
    setupState.stage === 'checking_dependencies' ||
    setupState.stage === 'detecting_qbit' ||
    setupState.stage === 'fetching_release';

  const currentRank = getInstallRank(setupState.stage);
  const isVerifiedConnected =
    torrentConnected || setupState.webUiVerifiedConnected || Boolean(webUiTestResult?.ok);

  const installStepLabels: Record<QbitSetupStage, string> = {
    idle: tq.stepChecking,
    checking_dependencies: tq.stepChecking,
    detecting_qbit: tq.stepDetecting,
    fetching_release: tq.stepDetecting,
    ready: tq.stepDetecting,
    downloading: tq.stepDownloading,
    verifying: tq.stepVerifying,
    installing: tq.stepInstalling,
    configuring: tq.stepConfiguring,
    waiting_for_close: tq.stepInstalling,
    completed: tq.stepCompleted,
    error: tq.stepChecking,
  };

  const wizardSteps: { id: OnboardingStepId; num: string; label: string }[] = [
    { id: 'welcome', num: '01', label: t.stepWelcome },
    { id: 'preferences', num: '02', label: t.stepAppearance },
    { id: 'qbit_check', num: '03', label: t.stepQbitCheck },
    { id: 'qbit_integration', num: '04', label: t.stepQbitIntegration },
    { id: 'complete', num: '05', label: t.stepReady },
  ];

  const activeStepIdx = wizardSteps.findIndex((s) => s.id === step);

  const handleInstallClick = () => {
    installStartedHereRef.current = true;
    setTorrentSkipped(false);
    void onStartQbitInstall(true);
  };

  const handleGeneratePwd = async () => {
    const generated = await onGenerateQbitPassword();
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

  const handleLaunchIntoDesktop = (destination: 'store' | 'settings') => {
    if (isLaunchingOut) return;
    setIsLaunchingOut(true);
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(
      () => {
        onCompleteOnboarding(destination);
      },
      prefersReduced ? 40 : 360
    );
  };

  const isCustomThemeActive =
    activeTheme === 'default' && Boolean(settings.customTheme?.enabled);

  const activeThemeLabel = isCustomThemeActive
    ? `${tr.customTheme.summaryCustomPrefix} (${settings.customTheme.accentColor.toUpperCase()})`
    : currentThemeChoice === 'ps5'
    ? t.themePs5Name
    : currentThemeChoice === 'xbox'
    ? t.themeXboxName
    : currentThemeChoice === 'light'
    ? t.themeLightName
    : t.themeDarkName;

  const activeLanguageLabel =
    LANGUAGE_OPTIONS.find((l) => l.code === settings.language)?.nativeName || 'English';

  const qbitSummaryStatus = isVerifiedConnected
    ? t.summaryTorrentConnected
    : setupState.installed && !torrentSkipped
    ? t.summaryTorrentInstalled
    : t.summaryTorrentSkipped;

  const finalizingMessage =
    congratsProgress < 42
      ? t.finalizingPhase1
      : congratsProgress < 96
      ? t.finalizingPhase2
      : t.finalizingPhase3;

  const ringRadius = 44;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - congratsProgress / 100);

  return (
    <div
      className={`sa-app-shell h-dvh w-full overflow-hidden flex flex-col bg-[var(--sa-bg-canvas)] text-[var(--sa-text-primary)] ${
        isLaunchingOut ? 'sa-onboard-launch-out' : ''
      }`}
    >
      {/* Top Minimal Brand + 5-Step Progress Header */}
      <header
        className={`relative z-20 shrink-0 border-b backdrop-blur-[var(--sa-panel-blur)] transition-colors ${
          isPs5Theme
            ? 'bg-[#021233]/85 border-white/[0.12] text-white'
            : isXboxTheme
            ? 'bg-[#081a0b]/88 border-[#52e042]/20 text-[#ecfdf0]'
            : 'bg-[var(--sa-bg-surface-glass)] border-[var(--sa-border-subtle)]'
        }`}
      >
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Brand Mark */}
          <div className="flex items-center gap-2.5 shrink-0">
            {!brandLogoFailed ? (
              <img
                src="./img/logo01.png"
                alt="SecretArea"
                onError={() => setBrandLogoFailed(true)}
                className="h-7 w-auto max-w-[110px] object-contain shrink-0"
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isXboxTheme
                    ? 'bg-gradient-to-br from-[#107C10] to-[#0a520a]'
                    : 'bg-gradient-to-br from-[#0284c7] to-[#1d4ed8]'
                }`}
              >
                <Shield className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="font-display text-[15.5px] font-bold tracking-tight whitespace-nowrap">
              SecretArea
            </span>
            {currentVersion && (
              <span
                dir="ltr"
                className="hidden sm:inline text-[11px] font-mono-tabular text-slate-500 dark:text-[#8b9bb4]"
              >
                · v{currentVersion}
              </span>
            )}
          </div>

          {/* 5-Step Progress Indicator (Desktop) */}
          <nav aria-label="Setup steps" className="hidden lg:flex items-center gap-3.5 min-w-0">
            {wizardSteps.map((ws, idx) => {
              const isDone = idx < activeStepIdx;
              const isCurrent = idx === activeStepIdx;
              return (
                <div key={ws.id} className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono-tabular text-[11px] font-bold w-5 h-5 rounded-full inline-flex items-center justify-center border transition-colors ${
                      isDone
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-[var(--sa-accent)] border-transparent text-[var(--sa-accent-fg)]'
                        : 'border-slate-300 dark:border-white/[0.16] text-slate-500 dark:text-[#7f91a8]'
                    }`}
                  >
                    {isDone ? <Check weight="bold" className="w-3 h-3" /> : ws.num}
                  </span>
                  <span
                    className={`text-[12px] whitespace-nowrap ${
                      isCurrent
                        ? 'font-bold text-slate-900 dark:text-white'
                        : isDone
                        ? 'font-semibold text-emerald-700 dark:text-[#4ade80]'
                        : 'font-medium text-slate-500 dark:text-[#7f91a8]'
                    }`}
                  >
                    {ws.label}
                  </span>
                  {idx < wizardSteps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="text-slate-300 dark:text-white/20 ms-0.5"
                    >
                      /
                    </span>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Compact Language Quick-Switch */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label={tr.nav.selectLanguage}
              className="sa-ps5-pill-group inline-flex items-center gap-0.5 p-0.5 rounded-[var(--sa-btn-radius)] bg-[var(--sa-bg-subsurface)] border border-[var(--sa-border-subtle)]"
            >
              {LANGUAGE_OPTIONS.map((opt) => {
                const selected = settings.language === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => onChangeLanguage(opt.code)}
                    className={`px-2 py-1 rounded-[calc(var(--sa-btn-radius)-2px)] text-[11px] font-bold font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selected
                        ? 'bg-[var(--sa-accent)] text-[var(--sa-accent-fg)] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 dark:text-[#9fb0c7] dark:hover:text-white'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Compact Step Bar */}
      <div className="lg:hidden relative z-10 shrink-0 px-4 pt-2.5 max-w-6xl w-full mx-auto">
        <div className="flex items-center justify-between text-[11.5px] font-semibold text-slate-600 dark:text-[#9cb0c9] mb-1">
          <span>
            {wizardSteps[activeStepIdx]?.num} · {wizardSteps[activeStepIdx]?.label}
          </span>
          <span dir="ltr" className="font-mono-tabular">
            {activeStepIdx + 1} / {wizardSteps.length}
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 bg-[var(--sa-accent)]"
            style={{ width: `${((activeStepIdx + 1) / wizardSteps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main 100% Full-Height Onboarding Canvas (No Page Scroll) */}
      <main className="relative z-10 flex-1 min-h-0 w-full max-w-6xl mx-auto px-3 sm:px-5 lg:px-8 py-3 sm:py-4 flex flex-col">
        {/* ======================== STEP 1: MODERN WELCOME ======================== */}
        {step === 'welcome' && (
          <section
            key="step-welcome"
            className="sa-onboard-step-in sa-ps5-panel relative flex-1 min-h-0 flex flex-col rounded-[var(--sa-card-radius)] bg-[var(--sa-bg-surface-solid)] border border-[var(--sa-border-subtle)] shadow-xl overflow-hidden"
          >
            {/* Subtle GPU-friendly radial aura */}
            <div
              aria-hidden="true"
              className="sa-welcome-aura pointer-events-none absolute -top-24 -end-20 w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl opacity-25"
              style={{
                background: 'radial-gradient(circle, var(--sa-accent) 0%, transparent 70%)',
              }}
            />

            {/* Full-Height Split Grid (scrolls internally only on ultra-short mobile viewports) */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[1.18fr_0.82fr] divide-y lg:divide-y-0 lg:divide-x divide-[var(--sa-border-subtle)]">
              {/* Left Hero & 3 Setup Pillars */}
              <div className="p-5 sm:p-6 lg:p-8 flex flex-col justify-between gap-4 sm:gap-5 min-w-0">
                <div className="space-y-4 sm:space-y-5">
                  <div className="sa-welcome-stagger-1 flex items-center gap-3.5">
                    <div className="sa-icon-badge w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center p-2 shrink-0">
                      {!brandLogoFailed ? (
                        <img
                          src="./img/logo01.png"
                          alt="SecretArea Emblem"
                          onError={() => setBrandLogoFailed(true)}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Shield
                          className="w-8 h-8 text-[var(--sa-accent)]"
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 text-[12.5px] font-semibold text-[var(--sa-accent)]">
                      <span>{t.welcomeEyebrow}</span>
                      <span aria-hidden="true">·</span>
                      <span dir="ltr" className="font-mono-tabular">
                        v{currentVersion}
                      </span>
                    </div>
                  </div>

                  <div className="sa-welcome-stagger-2 space-y-2.5">
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-[40px] font-bold tracking-tight text-slate-900 dark:text-white leading-[1.08] [text-wrap:balance]">
                      {t.welcomeTitle}
                    </h1>

                    <p className="text-[13.5px] sm:text-[15px] text-slate-600 dark:text-[#9cb0c9] leading-relaxed max-w-xl">
                      {t.welcomeSubtitle}
                    </p>
                  </div>

                  {/* Step 1 Visitor Guide */}
                  <div className="p-3 sm:p-3.5 rounded-[var(--sa-card-inner-radius)] bg-[var(--sa-accent-soft)] border border-[var(--sa-accent-ring)] text-[12px] sm:text-[12.5px] text-slate-800 dark:text-[#dce8f5] leading-relaxed">
                    <span className="font-bold text-[var(--sa-accent)] me-1.5">
                      {t.stepGuideLabel}:
                    </span>
                    <span>{t.step1Guide}</span>
                  </div>
                </div>

                {/* 3 Editorial Setup Pillars (Responsive Single-Line Headings) */}
                <div className="sa-welcome-stagger-3 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-3 lg:gap-3.5 xl:gap-4 pt-4 border-t border-[var(--sa-border-subtle)]">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 text-[13px] sm:text-[11.5px] md:text-[12px] lg:text-[11.5px] xl:text-[12.5px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <Palette className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-[var(--sa-accent)] shrink-0" />
                      <span className="truncate">{t.welcomeFeature1Title}</span>
                    </div>
                    <p className="text-[11.5px] sm:text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                      {t.welcomeFeature1Desc}
                    </p>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 text-[13px] sm:text-[11.5px] md:text-[12px] lg:text-[11.5px] xl:text-[12.5px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <DownloadSimple className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-[var(--sa-accent)] shrink-0" />
                      <span className="truncate">{t.welcomeFeature2Title}</span>
                    </div>
                    <p className="text-[11.5px] sm:text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                      {t.welcomeFeature2Desc}
                    </p>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 text-[13px] sm:text-[11.5px] md:text-[12px] lg:text-[11.5px] xl:text-[12.5px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <ShieldCheck className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-emerald-600 dark:text-[#4ade80] shrink-0" />
                      <span className="truncate">{t.welcomeFeature3Title}</span>
                    </div>
                    <p className="text-[11.5px] sm:text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                      {t.welcomeFeature3Desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: What is SecretArea? */}
              <div className="sa-welcome-stagger-2 sa-ps5-subpanel bg-[var(--sa-bg-subsurface)] p-5 sm:p-6 lg:p-7 flex flex-col justify-center gap-3.5 min-w-0">
                <div className="space-y-2 pb-3 border-b border-[var(--sa-border-subtle)]">
                  <div className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900 dark:text-white">
                    <Sparkle className="w-4.5 h-4.5 text-[var(--sa-accent)] shrink-0" />
                    <span>{t.whatIsSecretAreaTitle}</span>
                  </div>
                  <p className="text-[13px] sm:text-[13.5px] font-medium text-slate-700 dark:text-[#c7d5e8] leading-relaxed">
                    {t.whatIsSecretAreaBody}
                  </p>
                </div>

                <ul className="divide-y divide-[var(--sa-border-subtle)]">
                  <li className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                    <span className="sa-icon-badge w-7 h-7 flex items-center justify-center shrink-0 mt-0.5">
                      <Desktop className="w-4 h-4 text-[var(--sa-accent)]" />
                    </span>
                    <p className="text-[12px] sm:text-[12.5px] text-slate-600 dark:text-[#b5c3d6] leading-relaxed">
                      {t.whatIsSecretAreaPoint1}
                    </p>
                  </li>

                  <li className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                    <span className="w-7 h-7 rounded-[var(--sa-card-inner-radius)] bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-[#4ade80] flex items-center justify-center shrink-0 mt-0.5">
                      <DownloadSimple className="w-4 h-4" />
                    </span>
                    <p className="text-[12px] sm:text-[12.5px] text-slate-600 dark:text-[#b5c3d6] leading-relaxed">
                      {t.whatIsSecretAreaPoint2}
                    </p>
                  </li>

                  <li className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                    <span className="sa-icon-badge w-7 h-7 flex items-center justify-center shrink-0 mt-0.5">
                      <Palette className="w-4 h-4 text-[var(--sa-accent)]" />
                    </span>
                    <p className="text-[12px] sm:text-[12.5px] text-slate-600 dark:text-[#b5c3d6] leading-relaxed">
                      {t.whatIsSecretAreaPoint3}
                    </p>
                  </li>

                  <li className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                    <span className="w-7 h-7 rounded-[var(--sa-card-inner-radius)] bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Gauge className="w-4 h-4" />
                    </span>
                    <p className="text-[12px] sm:text-[12.5px] text-slate-600 dark:text-[#b5c3d6] leading-relaxed">
                      {t.whatIsSecretAreaPoint4}
                    </p>
                  </li>
                </ul>
              </div>
            </div>

            {/* Anchored Footer Action Row */}
            <div className="relative z-10 shrink-0 px-5 sm:px-7 lg:px-9 py-3 border-t border-[var(--sa-border-subtle)] bg-[var(--sa-bg-subsurface)] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleLaunchIntoDesktop('store')}
                className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.skipAllBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('preferences')}
                className="sa-btn-primary inline-flex items-center gap-2 min-h-[42px] px-6 py-2 text-[13.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.getStartedBtn}</span>
                <DirectionalArrow weight="bold" className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </section>
        )}

        {/* ================== STEP 2: THEME & LANGUAGE ================== */}
        {step === 'preferences' && (
          <section
            key="step-preferences"
            className="sa-onboard-step-in sa-ps5-panel flex-1 min-h-0 flex flex-col rounded-[var(--sa-card-radius)] bg-[var(--sa-bg-surface-solid)] border border-[var(--sa-border-subtle)] shadow-xl overflow-hidden"
          >
            {/* Step Header */}
            <div className="shrink-0 px-5 sm:px-7 py-4 border-b border-[var(--sa-border-subtle)] space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                  {t.appearanceTitle}
                </h2>
                <p className="text-[12.5px] text-slate-600 dark:text-[#9cb0c9]">
                  {t.appearanceSubtitle}
                </p>
              </div>
              <p className="text-[12px] text-slate-600 dark:text-[#b8c7dc] leading-relaxed">
                <span className="font-bold text-[var(--sa-accent)] me-1.5">
                  {t.stepGuideLabel}:
                </span>
                <span>{t.step2Guide}</span>
              </p>
            </div>

            {/* Scroll-Safe Inner Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-4 space-y-4">
              {/* Theme Picker */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-[13px] font-bold text-slate-900 dark:text-white">
                  <Palette className="w-4 h-4 text-[var(--sa-accent)]" />
                  <span>{t.themePickerLabel}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Dark Slate */}
                  <button
                    type="button"
                    aria-pressed={currentThemeChoice === 'dark'}
                    onClick={() => onSelectTheme('dark')}
                    className={`sa-ps5-subpanel p-3.5 rounded-[var(--sa-card-radius)] border text-start transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      currentThemeChoice === 'dark'
                        ? 'bg-[var(--sa-accent-soft)] border-[var(--sa-accent)] ring-1 ring-[var(--sa-accent-ring)]'
                        : 'bg-[var(--sa-bg-subsurface)] border-[var(--sa-border-subtle)] hover:border-[var(--sa-accent-ring)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-8 h-8 rounded-[var(--sa-card-inner-radius)] bg-[#0f172a] border border-white/[0.12] text-[var(--sa-accent)] flex items-center justify-center">
                        <Moon className="w-4 h-4" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500 dark:text-[#8b9bb4]">
                          {activeOsTheme === 'macos' ? 'macOS' : activeOsTheme === 'linux' ? 'Linux' : 'Windows'}
                        </span>
                        {currentThemeChoice === 'dark' && (
                          <Check weight="bold" className="w-4 h-4 text-[var(--sa-accent)]" />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[13.5px] font-bold text-slate-900 dark:text-white">
                        {t.themeDarkName}
                      </div>
                      <div className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4] leading-snug mt-0.5">
                        {t.themeDarkDesc}
                      </div>
                    </div>
                  </button>

                  {/* Light Mode */}
                  <button
                    type="button"
                    aria-pressed={currentThemeChoice === 'light'}
                    onClick={() => onSelectTheme('light')}
                    className={`sa-ps5-subpanel p-3.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      currentThemeChoice === 'light'
                        ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500/45'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-[#11161d] dark:border-white/[0.08] dark:hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center">
                        <Sun className="w-4 h-4" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500 dark:text-[#8b9bb4]">
                          {activeOsTheme === 'macos' ? 'macOS' : activeOsTheme === 'linux' ? 'Linux' : 'Windows'}
                        </span>
                        {currentThemeChoice === 'light' && (
                          <Check weight="bold" className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[13.5px] font-bold text-slate-900 dark:text-white">
                        {t.themeLightName}
                      </div>
                      <div className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4] leading-snug mt-0.5">
                        {t.themeLightDesc}
                      </div>
                    </div>
                  </button>

                  {/* PS5 Theme */}
                  <button
                    type="button"
                    aria-pressed={currentThemeChoice === 'ps5'}
                    onClick={() => onSelectTheme('ps5')}
                    className={`sa-ps5-subpanel p-3.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      currentThemeChoice === 'ps5'
                        ? 'bg-[#10203a] border-[#38bdf8] ring-1 ring-[#38bdf8]/55 text-white'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-[#11161d] dark:border-white/[0.08] dark:hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-lg bg-[#0d2752] border border-[#38bdf8]/40 text-[#7cc4ff] flex items-center justify-center">
                        <Ps5Icon className="w-4.5 h-4.5" />
                      </span>
                      {currentThemeChoice === 'ps5' && (
                        <Check weight="bold" className="w-4 h-4 text-[#7cc4ff]" />
                      )}
                    </div>
                    <div>
                      <div
                        className={`text-[13.5px] font-bold ${
                          currentThemeChoice === 'ps5' ? 'text-white' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {t.themePs5Name}
                      </div>
                      <div
                        className={`text-[11.5px] leading-snug mt-0.5 ${
                          currentThemeChoice === 'ps5'
                            ? 'text-[#b7d6f2]'
                            : 'text-slate-500 dark:text-[#8b9bb4]'
                        }`}
                      >
                        {t.themePs5Desc}
                      </div>
                    </div>
                  </button>

                  {/* Xbox Nexus Theme */}
                  <button
                    type="button"
                    aria-pressed={currentThemeChoice === 'xbox'}
                    onClick={() => onSelectTheme('xbox')}
                    className={`sa-ps5-subpanel p-3.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      currentThemeChoice === 'xbox'
                        ? 'bg-[#0c2611] border-[#52e042] ring-1 ring-[#52e042]/55 text-white'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-[#11161d] dark:border-white/[0.08] dark:hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-lg bg-[#0e2e13] border border-[#52e042]/45 text-[#6ee755] flex items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="w-4.5 h-4.5"
                        >
                          <circle cx="12" cy="12" r="9.2" />
                          <path d="M7.2 6.8c2.2 1.2 4.8 3.6 7.5 7.4 1 1.4 1.7 2.8 2 4" />
                          <path d="M16.8 6.8c-2.2 1.2-4.8 3.6-7.5 7.4-1 1.4-1.7 2.8-2 4" />
                        </svg>
                      </span>
                      {currentThemeChoice === 'xbox' && (
                        <Check weight="bold" className="w-4 h-4 text-[#6ee755]" />
                      )}
                    </div>
                    <div>
                      <div
                        className={`text-[13.5px] font-bold ${
                          currentThemeChoice === 'xbox' ? 'text-white' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {t.themeXboxName}
                      </div>
                      <div
                        className={`text-[11.5px] leading-snug mt-0.5 ${
                          currentThemeChoice === 'xbox'
                            ? 'text-[#b7dab9]'
                            : 'text-slate-500 dark:text-[#8b9bb4]'
                        }`}
                      >
                        {t.themeXboxDesc}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Custom Default Theme Builder */}
              <CustomThemeBuilder
                compact
                language={settings.language}
                customTheme={settings.customTheme}
                hasConsoleThemeActive={isConsoleTheme}
                activeBaseTheme={activeTheme}
                activeOsTheme={activeOsTheme}
                isDarkMode={!settings.lightMode}
                onUpdateCustomTheme={onUpdateCustomTheme}
                onResetCustomTheme={onResetCustomTheme}
              />

              {/* Language Picker */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--sa-border-subtle)]">
                <div className="flex items-center gap-2 text-[13px] font-bold text-slate-900 dark:text-white">
                  <Globe className="w-4 h-4 text-[var(--sa-accent)]" />
                  <span>{t.languagePickerLabel}</span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const selected = settings.language === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChangeLanguage(opt.code)}
                        className={`sa-ps5-subpanel p-3 rounded-[var(--sa-card-radius)] border text-start transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          selected
                            ? 'bg-[var(--sa-accent-soft)] border-[var(--sa-accent)] ring-1 ring-[var(--sa-accent-ring)]'
                            : 'bg-[var(--sa-bg-subsurface)] border-[var(--sa-border-subtle)] hover:border-[var(--sa-accent-ring)]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-bold text-slate-900 dark:text-white truncate">
                            {opt.nativeName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-[#8b9bb4] truncate">
                            {opt.name} · {opt.direction === 'rtl' ? ts.rtlBadge : ts.ltrBadge}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-[var(--sa-btn-radius)] text-[11px] font-bold font-mono-tabular shrink-0 ${
                            selected
                              ? 'bg-[var(--sa-accent)] text-[var(--sa-accent-fg)]'
                              : 'bg-slate-200 text-slate-700 dark:bg-white/[0.08] dark:text-[#9fb0c7]'
                          }`}
                        >
                          {opt.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Anchored Footer */}
            <div className="shrink-0 px-5 sm:px-7 py-3 border-t border-[var(--sa-border-subtle)] bg-[var(--sa-bg-subsurface)] flex flex-wrap items-center justify-between gap-3">
              <p className="hidden sm:block text-[12px] text-slate-500 dark:text-[#8b9bb4]">
                {t.settingsEditableNote}
              </p>

              <div className="flex items-center justify-end gap-2.5 ms-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setStep('welcome')}
                  className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BackArrow className="w-4 h-4 shrink-0" />
                  <span>{t.backBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('qbit_check')}
                  className="sa-btn-primary inline-flex items-center gap-2 min-h-[40px] px-5 py-2 text-[13.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{t.continueBtn}</span>
                  <DirectionalArrow weight="bold" className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================ STEP 3: QBITTORRENT CHECK / INSTALL ================ */}
        {step === 'qbit_check' && (
          <section
            key="step-qbit-check"
            className="sa-onboard-step-in sa-ps5-panel flex-1 min-h-0 flex flex-col rounded-[var(--sa-card-radius)] bg-[var(--sa-bg-surface-solid)] border border-[var(--sa-border-subtle)] shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 px-5 sm:px-7 py-4 border-b border-[var(--sa-border-subtle)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="sa-icon-badge w-10 h-10 flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
                  {!qbitLogoFailed ? (
                    <img
                      src={QBIT_OFFICIAL_LOGO_URL}
                      alt="qBittorrent logo"
                      referrerPolicy="no-referrer"
                      onError={() => setQbitLogoFailed(true)}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Magnet className="w-5 h-5 text-[var(--sa-accent)]" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white [text-wrap:balance]">
                    {t.qbitCheckTitle}
                  </h2>
                  <p className="text-[12.5px] text-slate-600 dark:text-[#9cb0c9] truncate">
                    {t.qbitCheckSubtitle}
                  </p>
                </div>
              </div>

              {isDesktopApp && (
                <button
                  type="button"
                  disabled={isBusyInstall}
                  onClick={() => void onRecheckQbit()}
                  className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 disabled:opacity-50 text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowClockwise className={`w-3.5 h-3.5 ${isScanningOnly ? 'animate-spin' : ''}`} />
                  <span>{tq.recheckBtn}</span>
                </button>
              )}
            </div>

            {/* Middle Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-4 sm:py-5 space-y-4">
              <div className="p-3 rounded-[var(--sa-card-inner-radius)] bg-[var(--sa-bg-subsurface)] border border-[var(--sa-border-subtle)] text-[12px] sm:text-[12.5px] text-slate-700 dark:text-[#b8c7dc] leading-relaxed">
                <span className="font-bold text-[var(--sa-accent)] me-1.5">
                  {t.stepGuideLabel}:
                </span>
                <span>{t.step3Guide}</span>
              </div>

              {!isDesktopApp && (
                <div className="p-3 rounded-[var(--sa-card-inner-radius)] bg-[var(--sa-accent-soft)] border border-[var(--sa-accent-ring)] text-[12px] text-slate-800 dark:text-[#dce8f5]">
                  {tq.webPreviewNotice}
                </div>
              )}

              {/* Environment Readout */}
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-[var(--sa-card-inner-radius)] bg-[var(--sa-bg-subsurface)] border border-[var(--sa-border-subtle)]">
                <div>
                  <dt className="text-[11px] font-medium text-slate-500 dark:text-[#7f91a8]">
                    {tq.installedLabel}
                  </dt>
                  <dd className="mt-1 text-[14px] font-bold font-mono-tabular text-slate-900 dark:text-white">
                    {setupState.installed
                      ? setupState.installedVersion
                        ? `v${setupState.installedVersion}`
                        : 'qBittorrent'
                      : tq.notInstalledValue}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-medium text-slate-500 dark:text-[#7f91a8]">
                    {tq.latestLabel}
                  </dt>
                  <dd className="mt-1 text-[14px] font-bold font-mono-tabular text-[var(--sa-accent)]">
                    {setupState.latestRelease?.version ? `v${setupState.latestRelease.version}` : '—'}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-medium text-slate-500 dark:text-[#7f91a8]">
                    {tq.processLabel}
                  </dt>
                  <dd
                    className={`mt-1 text-[14px] font-bold ${
                      setupState.isRunning
                        ? 'text-emerald-700 dark:text-[#4ade80]'
                        : 'text-slate-600 dark:text-[#9cb0c9]'
                    }`}
                  >
                    {setupState.isRunning ? tq.processRunning : tq.processStopped}
                  </dd>
                </div>
              </dl>

              {isScanningOnly && !setupState.installed && (
                <div className="p-4 rounded-[var(--sa-card-inner-radius)] bg-[var(--sa-accent-soft)] border border-[var(--sa-accent-ring)] flex items-center gap-3 text-[13px] font-medium text-slate-800 dark:text-[#cbe3fb]">
                  <SpinnerGap className="w-5 h-5 animate-spin text-[var(--sa-accent)] shrink-0" />
                  <span>{t.scanningText}</span>
                </div>
              )}

              {/* Branch A: qBittorrent ALREADY Installed */}
              {!isScanningOnly && setupState.installed && (
                <div className="space-y-4">
                  <div className="p-4 rounded-[var(--sa-card-inner-radius)] bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-300 dark:border-emerald-500/35 flex items-start gap-3 text-emerald-950 dark:text-emerald-100">
                    <CheckCircle weight="fill" className="w-5 h-5 text-emerald-600 dark:text-[#4ade80] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-[14px] font-bold">
                        {justInstalledBanner ? t.installCompleteAdvanceMsg : t.alreadyInstalledTitle}
                      </div>
                      <p className="text-[12.5px] opacity-90 leading-relaxed">
                        {t.alreadyInstalledDesc}
                      </p>
                      {setupState.executablePath && (
                        <p dir="ltr" className="text-[11px] font-mono-tabular opacity-75 pt-0.5 break-all">
                          {setupState.executablePath}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isBusyInstall}
                      onClick={() => {
                        setTorrentSkipped(false);
                        setStep('qbit_integration');
                      }}
                      className="sa-btn-primary inline-flex items-center gap-2 min-h-[42px] px-5 py-2 disabled:opacity-55 text-[13.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>{t.goIntegrationBtn}</span>
                      <DirectionalArrow weight="bold" className="w-4 h-4 shrink-0" />
                    </button>

                    {isDesktopApp && setupState.actionNeeded === 'update_available' && (
                      <button
                        type="button"
                        disabled={isBusyInstall}
                        onClick={handleInstallClick}
                        className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <DownloadSimple className="w-4 h-4" />
                        <span>{t.updateFirstBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Branch B: qBittorrent NOT Installed Yet */}
              {!isScanningOnly && !setupState.installed && (
                <div className="space-y-3.5">
                  <div
                    className={`p-4 rounded-[var(--sa-card-inner-radius)] border flex items-start gap-3 ${
                      setupState.stage === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200'
                        : 'bg-amber-50 dark:bg-amber-950/25 border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-100'
                    }`}
                  >
                    <WarningCircle weight="fill" className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="text-[14px] font-bold">
                        {setupState.stage === 'error' && setupState.error
                          ? setupState.error
                          : t.notInstalledTitle}
                      </div>
                      <p className="text-[12.5px] opacity-90 leading-relaxed">
                        {t.notInstalledDesc}
                      </p>
                      {setupState.latestRelease?.assetName && (
                        <p dir="ltr" className="text-[11px] font-mono-tabular opacity-80 pt-0.5 truncate">
                          {setupState.latestRelease.assetName}
                          {setupState.latestRelease.assetSizeBytes > 0
                            ? ` · ${formatBytes(setupState.latestRelease.assetSizeBytes)}`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {(isBusyInstall || setupState.verification || setupState.stage === 'error') && (
                    <div className="p-4 rounded-[var(--sa-card-inner-radius)] bg-[var(--sa-bg-subsurface)] border border-[var(--sa-border-subtle)] space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {ORDERED_INSTALL_STEPS.map((stepKey, idx) => {
                          const isDone =
                            setupState.stage === 'completed' ||
                            (currentRank > idx && setupState.stage !== 'error');
                          const isCurrent =
                            setupState.stage !== 'completed' &&
                            setupState.stage !== 'error' &&
                            currentRank === idx &&
                            isBusyInstall;
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
                              <span className="truncate">{installStepLabels[stepKey]}</span>
                            </div>
                          );
                        })}
                      </div>

                      {setupState.stage === 'downloading' && setupState.downloadProgress && (
                        <div className="pt-2 border-t border-[var(--sa-border-subtle)] space-y-1.5">
                          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-[#0b0f14] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[var(--sa-accent)] to-[var(--sa-secondary)] transition-all duration-200"
                              style={{
                                width: `${Math.min(100, Math.max(0, setupState.downloadProgress.percent))}%`,
                              }}
                            />
                          </div>
                          <div
                            dir="ltr"
                            className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-600 dark:text-[#9cb0c9]"
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

                      {setupState.verification && (
                        <div className="pt-2 border-t border-[var(--sa-border-subtle)] flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-emerald-700 dark:text-[#4ade80] font-semibold">
                          {setupState.verification.sha256Verified && (
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldCheck weight="fill" className="w-4 h-4 shrink-0" />
                              <span>{tq.shaVerifiedLabel}</span>
                            </span>
                          )}
                          {setupState.verification.signatureVerified ? (
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldCheck weight="fill" className="w-4 h-4 shrink-0" />
                              <span>
                                {tq.sigVerifiedLabel}
                                {setupState.verification.publisher
                                  ? ` (${setupState.verification.publisher})`
                                  : ''}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-[#9cb0c9] font-normal">
                              {tq.unsignedVerifiedNote}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {isDesktopApp && (
                    <p className="text-[11.5px] text-slate-500 dark:text-[#8b9bb4] leading-relaxed">
                      {tq.consentNote}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5">
                    {isDesktopApp ? (
                      <button
                        type="button"
                        disabled={isBusyInstall}
                        onClick={handleInstallClick}
                        className="sa-btn-primary inline-flex items-center gap-2 min-h-[42px] px-5 py-2 disabled:opacity-55 text-[13.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <DownloadSimple weight="bold" className="w-4 h-4 shrink-0" />
                        <span>
                          {setupState.stage === 'error' ? tq.retryBtn : t.installAndNextBtn}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setTorrentSkipped(false);
                          setStep('qbit_integration');
                        }}
                        className="sa-btn-primary inline-flex items-center gap-2 min-h-[42px] px-5 py-2 text-[13.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>{t.goIntegrationBtn}</span>
                        <DirectionalArrow weight="bold" className="w-4 h-4 shrink-0" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onOpenOfficialQbitDownload}
                      className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-[12.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ArrowSquareOut className="w-4 h-4" />
                      <span>{tq.officialDownloadBtn}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Anchored Footer */}
            <div className="shrink-0 px-5 sm:px-7 py-3 border-t border-[var(--sa-border-subtle)] bg-[var(--sa-bg-subsurface)] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={isBusyInstall}
                onClick={() => setStep('preferences')}
                className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 disabled:opacity-50 text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BackArrow className="w-4 h-4 shrink-0" />
                <span>{t.backBtn}</span>
              </button>

              <button
                type="button"
                disabled={isBusyInstall}
                onClick={() => {
                  setTorrentSkipped(true);
                  setStep('complete');
                }}
                className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 disabled:opacity-50 text-[12.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.skipTorrentBtn}</span>
              </button>
            </div>
          </section>
        )}

        {/* ============== STEP 4: QBITTORRENT INTEGRATION SETTINGS ============== */}
        {step === 'qbit_integration' && (
          <section
            key="step-qbit-integration"
            className="sa-onboard-step-in sa-ps5-panel flex-1 min-h-0 flex flex-col rounded-[var(--sa-card-radius)] bg-[var(--sa-bg-surface-solid)] border border-[var(--sa-border-subtle)] shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 px-5 sm:px-7 py-4 border-b border-[var(--sa-border-subtle)] flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white [text-wrap:balance]">
                  {t.integrationTitle}
                </h2>
                <p className="text-[12.5px] text-slate-600 dark:text-[#9cb0c9] truncate">
                  {t.integrationSubtitle}
                </p>
              </div>

              {isDesktopApp && setupState.installed && (
                <button
                  type="button"
                  onClick={() => void onLaunchQbitClient()}
                  className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play weight="fill" className="w-3.5 h-3.5 text-emerald-600 dark:text-[#4ade80]" />
                  <span>{tq.launchQbitBtn}</span>
                </button>
              )}
            </div>

            {/* Middle Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-4 space-y-4">
              <div className="p-3 rounded-[var(--sa-card-inner-radius)] bg-[var(--sa-bg-subsurface)] border border-[var(--sa-border-subtle)] text-[12px] text-slate-700 dark:text-[#b8c7dc] leading-relaxed">
                <span className="font-bold text-[var(--sa-accent)] me-1.5">
                  {t.stepGuideLabel}:
                </span>
                <span>{t.step4Guide}</span>
              </div>

              {isVerifiedConnected && (
                <div className="p-3 rounded-[var(--sa-card-inner-radius)] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/35 text-[12.5px] font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2.5">
                  <CheckCircle weight="fill" className="w-5 h-5 shrink-0" />
                  <span>{tq.webUiConnectedMsg}</span>
                </div>
              )}

              <div className="p-3.5 rounded-[var(--sa-card-inner-radius)] bg-[var(--sa-bg-subsurface)] border border-[var(--sa-border-subtle)] space-y-1.5">
                <div className="text-[12.5px] font-bold text-slate-900 dark:text-white">
                  {setupState.webUiConfig.webUiEnabled
                    ? tq.webUiDetectedEnabled
                    : tq.webUiNotEnabledHint}
                </div>
                <ol className="space-y-1 text-[11.5px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                  <li>{tq.webUiGuide1}</li>
                  <li>{tq.webUiGuide2}</li>
                  <li>{tq.webUiGuide3}</li>
                  <li>{tq.webUiGuide4}</li>
                  <li>{tq.webUiGuide5}</li>
                </ol>
              </div>

              {/* Credentials Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-[12px] font-semibold text-slate-700 dark:text-[#b8c6d8]">
                    {ts.torrentHostLabel}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    readOnly
                    value="127.0.0.1"
                    className="sa-search-input w-full min-h-[38px] px-3 py-1.5 text-[12.5px] font-mono-tabular opacity-80"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="onboard-qbit-port"
                    className="block text-[12px] font-semibold text-slate-700 dark:text-[#b8c6d8]"
                  >
                    {ts.torrentPortLabel}
                  </label>
                  <input
                    id="onboard-qbit-port"
                    type="number"
                    dir="ltr"
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value) || 8080)}
                    className="sa-search-input w-full min-h-[38px] px-3 py-1.5 text-[12.5px] font-mono-tabular"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="onboard-qbit-user"
                    className="block text-[12px] font-semibold text-slate-700 dark:text-[#b8c6d8]"
                  >
                    {ts.torrentUsernameLabel}
                  </label>
                  <input
                    id="onboard-qbit-user"
                    type="text"
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="sa-search-input w-full min-h-[38px] px-3 py-1.5 text-[12.5px]"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="onboard-qbit-pass"
                    className="block text-[12px] font-semibold text-slate-700 dark:text-[#b8c6d8]"
                  >
                    {ts.torrentPasswordLabel}
                  </label>
                  <div className="relative">
                    <input
                      id="onboard-qbit-pass"
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        torrentConfig.hasSavedPassword ? ts.torrentPasswordSavedPlaceholder : '••••••••'
                      }
                      className="sa-search-input w-full min-h-[38px] ps-3 pe-9 py-1.5 text-[12.5px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-[#8b9bb4]">
                {t.hostLoopbackHint}
              </p>

              {webUiTestResult && !webUiTestResult.ok && (
                <div className="p-3 rounded-[var(--sa-card-inner-radius)] bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/40 text-[12px] text-rose-800 dark:text-rose-200 space-y-0.5">
                  <p className="font-semibold">{webUiTestResult.message}</p>
                  {webUiTestResult.hint && <p className="opacity-90">{webUiTestResult.hint}</p>}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleGeneratePwd}
                  className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Key className="w-4 h-4 text-[var(--sa-accent)]" />
                  <span>{tq.generatePasswordBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={isVerifyingWebUi}
                  onClick={handleVerifyWebUi}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 rounded-[var(--sa-btn-radius)] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[12.5px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isVerifyingWebUi ? tq.verifyingBtn : tq.saveAndVerifyBtn}</span>
                </button>
              </div>
            </div>

            {/* Anchored Footer */}
            <div className="shrink-0 px-5 sm:px-7 py-3 border-t border-[var(--sa-border-subtle)] bg-[var(--sa-bg-subsurface)] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('qbit_check')}
                className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BackArrow className="w-4 h-4 shrink-0" />
                <span>{t.backBtn}</span>
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                {!isVerifiedConnected && (
                  <button
                    type="button"
                    onClick={() => {
                      setTorrentSkipped(true);
                      setStep('complete');
                    }}
                    className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-[12.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>{t.skipIntegrationBtn}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTorrentSkipped(false);
                    setStep('complete');
                  }}
                  className="sa-btn-primary inline-flex items-center gap-2 min-h-[40px] px-5 py-2 text-[13.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{t.finishSetupBtn}</span>
                  <DirectionalArrow weight="bold" className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ============= STEP 5: SMART LAUNCH READINESS CONSOLE ============= */}
        {step === 'complete' && (
          <section
            key="step-complete"
            className="sa-onboard-step-in sa-ps5-panel relative flex-1 min-h-0 flex flex-col rounded-[var(--sa-card-radius)] bg-[var(--sa-bg-surface-solid)] border border-[var(--sa-border-subtle)] shadow-xl overflow-hidden"
          >
            {/* Subtle theme-reactive radial aura */}
            <div
              aria-hidden="true"
              className="sa-welcome-aura pointer-events-none absolute -top-24 -end-20 w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl opacity-25"
              style={{
                background:
                  congratsProgress >= 100
                    ? isXboxTheme
                      ? 'radial-gradient(circle, rgba(82,224,66,0.45) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)'
                    : 'radial-gradient(circle, var(--sa-accent) 0%, transparent 70%)',
              }}
            />

            {/* Top Orbital Hero Header (Full-Width, Single-Line Typography) */}
            <div className="relative z-10 shrink-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-[var(--sa-border-subtle)] flex items-center justify-between gap-3.5 sm:gap-5">
              <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
                {/* Dual-Ring Animated Orbital Progress Dial */}
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 lg:w-[70px] lg:h-[70px] shrink-0 flex items-center justify-center">
                  {congratsProgress >= 100 && (
                    <span
                      aria-hidden="true"
                      className={`sa-ready-ripple absolute inset-1 rounded-full border ${
                        isXboxTheme
                          ? 'border-[#52e042]/60'
                          : 'border-emerald-500/55 dark:border-[#4ade80]/55'
                      }`}
                    />
                  )}
                  <svg
                    viewBox="0 0 112 112"
                    className="w-full h-full -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="56"
                      cy="56"
                      r={51}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeDasharray="4 6"
                      className="sa-ready-orbit text-slate-300 dark:text-white/[0.16]"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r={ringRadius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6.5"
                      className="text-slate-200 dark:text-white/[0.09]"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r={ringRadius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6.5"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringDashOffset}
                      className={
                        congratsProgress >= 100
                          ? isXboxTheme
                            ? 'text-[#6ee755]'
                            : 'text-emerald-500 dark:text-[#4ade80]'
                          : 'text-[var(--sa-accent)]'
                      }
                    />
                  </svg>

                  <div className="absolute inset-0 flex items-center justify-center">
                    {congratsProgress >= 100 ? (
                      <div
                        className={`sa-onboard-ring-pop flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full ${
                          isXboxTheme
                            ? 'bg-[#52e042]/20 text-[#6ee755]'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-[#4ade80]'
                        }`}
                      >
                        <CheckCircle weight="fill" className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                    ) : (
                      <span
                        dir="ltr"
                        className="font-mono-tabular text-[12px] sm:text-[13px] font-bold text-slate-900 dark:text-white"
                      >
                        {congratsProgress}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Single-Line Hero Copy */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 min-w-0 text-[11px] sm:text-[12px] font-semibold whitespace-nowrap">
                    <span
                      className={`truncate ${
                        congratsProgress >= 100
                          ? isXboxTheme
                            ? 'text-[#6ee755]'
                            : 'text-emerald-700 dark:text-[#4ade80]'
                          : 'text-[var(--sa-accent)]'
                      }`}
                    >
                      {congratsProgress >= 100 ? t.congratsEyebrow : finalizingMessage}
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-white/25 shrink-0">
                      ·
                    </span>
                    <span
                      dir="ltr"
                      className="font-mono-tabular text-slate-500 dark:text-[#8b9bb4] shrink-0"
                    >
                      v{currentVersion}
                    </span>
                  </div>

                  <h2 className="font-display text-[13.5px] min-[420px]:text-[15.5px] sm:text-[20px] lg:text-[23px] font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate">
                    {congratsProgress >= 100 ? t.congratsTitle : finalizingMessage}
                  </h2>

                  <p className="text-[11px] sm:text-[12.5px] text-slate-600 dark:text-[#9cb0c9] whitespace-nowrap truncate">
                    {t.congratsSubtitle}
                  </p>
                </div>
              </div>

              {/* Right Monospace Readiness Counter (Desktop & Tablet) */}
              <div className="hidden md:flex items-center gap-2 shrink-0 whitespace-nowrap font-mono-tabular text-[12px] font-bold">
                <span
                  dir="ltr"
                  className={
                    congratsProgress >= 100
                      ? isXboxTheme
                        ? 'text-[#6ee755]'
                        : 'text-emerald-600 dark:text-[#4ade80]'
                      : 'text-[var(--sa-accent)]'
                  }
                >
                  {congratsProgress}%
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-white/20">
                  ·
                </span>
                <span className="text-slate-600 dark:text-[#9cb0c9]">
                  {congratsProgress >= 100 ? t.readyStatusDone : t.readyStatusSyncing}
                </span>
              </div>
            </div>

            {/* Middle 2-Column Smart Workspace Grid */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--sa-border-subtle)]">
              {/* Left Column: Interactive Workspace Summary & Live Check Timeline */}
              <div className="sa-welcome-stagger-1 p-4 sm:p-6 lg:p-7 flex flex-col justify-between gap-4 min-w-0">
                <div className="space-y-2.5 min-w-0">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 text-[13px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <SlidersHorizontal className="w-4 h-4 text-[var(--sa-accent)] shrink-0" />
                      <span className="truncate">{t.readySummaryHeading}</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-[#7f91a8] whitespace-nowrap shrink-0">
                      {t.readyClickToEdit}
                    </span>
                  </div>

                  {/* Interactive Single-Line Configuration Rows (Click to Jump Back & Edit) */}
                  <div className="divide-y divide-[var(--sa-border-subtle)] border-y border-[var(--sa-border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setStep('preferences')}
                      className="w-full py-2.5 px-1.5 -mx-1.5 rounded-[var(--sa-card-inner-radius)] flex items-center justify-between gap-3 text-start hover:bg-[var(--sa-bg-subsurface)] transition-colors cursor-pointer group min-w-0"
                    >
                      <span className="flex items-center gap-2 min-w-0 text-[12px] font-medium text-slate-500 dark:text-[#8b9bb4] whitespace-nowrap">
                        <Palette className="w-4 h-4 text-[var(--sa-accent)] shrink-0" />
                        <span className="truncate">{t.summaryThemeLabel}</span>
                      </span>
                      <span className="flex items-center gap-1.5 min-w-0 shrink-0 max-w-[58%]">
                        <span className="text-[12.5px] font-bold text-slate-900 dark:text-white whitespace-nowrap truncate">
                          {activeThemeLabel}
                        </span>
                        <CaretRight
                          weight="bold"
                          className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--sa-accent)] shrink-0 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep('preferences')}
                      className="w-full py-2.5 px-1.5 -mx-1.5 rounded-[var(--sa-card-inner-radius)] flex items-center justify-between gap-3 text-start hover:bg-[var(--sa-bg-subsurface)] transition-colors cursor-pointer group min-w-0"
                    >
                      <span className="flex items-center gap-2 min-w-0 text-[12px] font-medium text-slate-500 dark:text-[#8b9bb4] whitespace-nowrap">
                        <Globe className="w-4 h-4 text-[var(--sa-accent)] shrink-0" />
                        <span className="truncate">{t.summaryLanguageLabel}</span>
                      </span>
                      <span className="flex items-center gap-1.5 min-w-0 shrink-0 max-w-[58%]">
                        <span className="text-[12.5px] font-bold text-slate-900 dark:text-white whitespace-nowrap truncate">
                          {activeLanguageLabel}
                        </span>
                        <CaretRight
                          weight="bold"
                          className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--sa-accent)] shrink-0 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setStep(setupState.installed ? 'qbit_integration' : 'qbit_check')
                      }
                      className="w-full py-2.5 px-1.5 -mx-1.5 rounded-[var(--sa-card-inner-radius)] flex items-center justify-between gap-3 text-start hover:bg-[var(--sa-bg-subsurface)] transition-colors cursor-pointer group min-w-0"
                    >
                      <span className="flex items-center gap-2 min-w-0 text-[12px] font-medium text-slate-500 dark:text-[#8b9bb4] whitespace-nowrap">
                        <Magnet className="w-4 h-4 text-[var(--sa-accent)] shrink-0" />
                        <span className="truncate">{t.summaryTorrentLabel}</span>
                      </span>
                      <span className="flex items-center gap-1.5 min-w-0 shrink-0 max-w-[58%]">
                        <span
                          className={`text-[12.5px] font-bold whitespace-nowrap truncate ${
                            isVerifiedConnected
                              ? 'text-emerald-700 dark:text-[#4ade80]'
                              : 'text-slate-800 dark:text-[#dce4ee]'
                          }`}
                        >
                          {qbitSummaryStatus}
                        </span>
                        <CaretRight
                          weight="bold"
                          className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--sa-accent)] shrink-0 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                        />
                      </span>
                    </button>
                  </div>
                </div>

                {/* Live Sequential 3-Phase Readiness Checks (All Single-Line) */}
                <ul className="space-y-2 pt-1">
                  {[
                    { label: t.finalizingPhase1, threshold: 40 },
                    { label: t.finalizingPhase2, threshold: 84 },
                    { label: t.finalizingPhase3, threshold: 100 },
                  ].map((phase, idx) => {
                    const done = congratsProgress >= phase.threshold;
                    const active =
                      !done &&
                      (idx === 0 ||
                        congratsProgress >= [0, 40, 84][idx]);
                    return (
                      <li
                        key={phase.label}
                        className="flex items-center justify-between gap-3 text-[12px] min-w-0"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {done ? (
                            <CheckCircle
                              weight="fill"
                              className="w-4 h-4 text-emerald-600 dark:text-[#4ade80] shrink-0"
                            />
                          ) : active ? (
                            <SpinnerGap className="w-4 h-4 animate-spin text-[var(--sa-accent)] shrink-0" />
                          ) : (
                            <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-white/20 shrink-0" />
                          )}
                          <span
                            className={`whitespace-nowrap truncate ${
                              done
                                ? 'font-semibold text-slate-800 dark:text-[#e5e9f0]'
                                : active
                                ? 'font-medium text-slate-700 dark:text-[#b8c7dc]'
                                : 'text-slate-400 dark:text-[#66778f]'
                            }`}
                          >
                            {phase.label}
                          </span>
                        </span>
                        <span
                          className={`font-mono-tabular text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                            done
                              ? 'text-emerald-700 dark:text-[#4ade80]'
                              : active
                              ? 'text-[var(--sa-accent)]'
                              : 'text-slate-400 dark:text-[#66778f]'
                          }`}
                        >
                          {done ? t.readyStatusDone : active ? t.readyStatusSyncing : '—'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Right Column: Smart Launchpad Selector & Single-Line Advisories */}
              <div className="sa-welcome-stagger-2 sa-ps5-subpanel bg-[var(--sa-bg-subsurface)] p-4 sm:p-6 lg:p-7 flex flex-col justify-between gap-4 min-w-0">
                <div className="space-y-2.5 min-w-0">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 text-[13px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <Sparkle
                        className="w-4 h-4 text-[var(--sa-accent)] shrink-0"
                      />
                      <span className="truncate">{t.readyLaunchHeading}</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-[#7f91a8] whitespace-nowrap shrink-0">
                      {t.readyDestinationHint}
                    </span>
                  </div>

                  {/* Interactive Destination Selector */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      aria-pressed={launchTarget === 'store'}
                      onClick={() => setLaunchTarget('store')}
                      className={`sa-ps5-subpanel w-full px-3.5 py-2.5 rounded-[var(--sa-card-radius)] border text-start transition-all cursor-pointer flex items-center justify-between gap-3 min-w-0 ${
                        launchTarget === 'store'
                          ? 'bg-[var(--sa-accent-soft)] border-[var(--sa-accent)] ring-1 ring-[var(--sa-accent-ring)]'
                          : 'bg-[var(--sa-bg-surface-solid)] border-[var(--sa-border-subtle)] hover:border-[var(--sa-accent-ring)]'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`w-8 h-8 rounded-[var(--sa-card-inner-radius)] flex items-center justify-center shrink-0 ${
                            launchTarget === 'store'
                              ? 'bg-[var(--sa-accent)] text-[var(--sa-accent-fg)]'
                              : 'bg-[var(--sa-bg-subsurface)] text-slate-600 dark:text-[#9cb0c9]'
                          }`}
                        >
                          <House className="w-4 h-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-bold text-slate-900 dark:text-white whitespace-nowrap truncate">
                            {t.readyStartStoreTitle}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-[#8b9bb4] whitespace-nowrap truncate">
                            {t.readyStartStoreDesc}
                          </span>
                        </span>
                      </span>
                      {launchTarget === 'store' && (
                        <Check
                          weight="bold"
                          className="w-4 h-4 shrink-0 text-[var(--sa-accent)]"
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      aria-pressed={launchTarget === 'settings'}
                      onClick={() => setLaunchTarget('settings')}
                      className={`sa-ps5-subpanel w-full px-3.5 py-2.5 rounded-[var(--sa-card-radius)] border text-start transition-all cursor-pointer flex items-center justify-between gap-3 min-w-0 ${
                        launchTarget === 'settings'
                          ? 'bg-[var(--sa-accent-soft)] border-[var(--sa-accent)] ring-1 ring-[var(--sa-accent-ring)]'
                          : 'bg-[var(--sa-bg-surface-solid)] border-[var(--sa-border-subtle)] hover:border-[var(--sa-accent-ring)]'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`w-8 h-8 rounded-[var(--sa-card-inner-radius)] flex items-center justify-center shrink-0 ${
                            launchTarget === 'settings'
                              ? 'bg-[var(--sa-accent)] text-[var(--sa-accent-fg)]'
                              : 'bg-[var(--sa-bg-subsurface)] text-slate-600 dark:text-[#9cb0c9]'
                          }`}
                        >
                          <Gear className="w-4 h-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-bold text-slate-900 dark:text-white whitespace-nowrap truncate">
                            {t.readyStartSettingsTitle}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-[#8b9bb4] whitespace-nowrap truncate">
                            {t.readyStartSettingsDesc}
                          </span>
                        </span>
                      </span>
                      {launchTarget === 'settings' && (
                        <Check
                          weight="bold"
                          className="w-4 h-4 shrink-0 text-[var(--sa-accent)]"
                        />
                      )}
                    </button>
                  </div>
                </div>

                {/* Single-Line Advisories (PresentMon & Editable Settings) */}
                <ul className="divide-y divide-[var(--sa-border-subtle)] border-t border-[var(--sa-border-subtle)] pt-1">
                  <li className="py-2.5 flex items-center justify-between gap-3 min-w-0">
                    <span className="flex items-center gap-2 min-w-0 text-[12px] font-semibold text-slate-800 dark:text-white whitespace-nowrap shrink-0">
                      <Gauge className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
                      <span>{t.presentMonShortLabel}</span>
                    </span>
                    <span className="text-[11.5px] text-slate-600 dark:text-[#9cb0c9] whitespace-nowrap truncate">
                      {t.presentMonShortDesc}
                    </span>
                  </li>

                  <li className="py-2.5 pb-0 flex items-center justify-between gap-3 min-w-0">
                    <span className="flex items-center gap-2 min-w-0 text-[12px] font-semibold text-slate-800 dark:text-white whitespace-nowrap shrink-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#4ade80] shrink-0" />
                      <span>{t.readyEditableShortLabel}</span>
                    </span>
                    <span className="text-[11.5px] text-slate-600 dark:text-[#9cb0c9] whitespace-nowrap truncate">
                      {t.readyEditableShortDesc}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Anchored Single-Line Launch Footer */}
            <div className="relative z-10 shrink-0 px-4 sm:px-6 lg:px-8 py-3 border-t border-[var(--sa-border-subtle)] bg-[var(--sa-bg-subsurface)] flex items-center justify-end gap-3">
              <div className="flex items-center justify-end gap-2 sm:gap-2.5 ms-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() =>
                    setStep(torrentSkipped ? 'qbit_check' : 'qbit_integration')
                  }
                  className="sa-btn-secondary inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BackArrow className="w-4 h-4 shrink-0" />
                  <span>{t.backBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={congratsProgress < 100 || isLaunchingOut}
                  onClick={() => handleLaunchIntoDesktop('settings')}
                  className="sa-btn-secondary hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 disabled:opacity-45 text-[12.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Gear className="w-4 h-4 shrink-0" />
                  <span>{t.openSettingsPageBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={congratsProgress < 100 || isLaunchingOut}
                  onClick={() => handleLaunchIntoDesktop(launchTarget)}
                  className={`sa-btn-primary flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[40px] px-5 sm:px-6 py-2 disabled:opacity-45 text-[13px] sm:text-[13.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                    congratsProgress >= 100 ? 'sa-ready-cta-sheen' : ''
                  }`}
                >
                  <span className="truncate">
                    {launchTarget === 'settings' ? t.openSettingsPageBtn : t.enterAppBtn}
                  </span>
                  <DirectionalArrow weight="bold" className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
