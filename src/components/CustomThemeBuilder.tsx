import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  Check,
  Drop,
  GameController,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  Swatches,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  CUSTOM_THEME_ACCENT_PRESETS,
  CUSTOM_THEME_SURFACE_PALETTES,
  restoreOsDefaultCustomColors,
  type AppLanguage,
  type AppThemeMode,
  type CustomThemeButtonStyle,
  type CustomThemeCardRadius,
  type CustomThemeConfig,
  type CustomThemeSurfaceStyle,
  type ResolvedOsTheme,
} from '../services/launcherSettings';
import { evaluateThemeContrast, getAccessibleTextOnAccent, parseHexRgb } from '../services/themeContrast';
import { getTranslations } from '../i18n/translations';

interface CustomThemeBuilderProps {
  language: AppLanguage;
  customTheme: CustomThemeConfig;
  hasConsoleThemeActive?: boolean;
  activeBaseTheme?: AppThemeMode;
  activeOsTheme?: ResolvedOsTheme;
  isDarkMode?: boolean;
  onUpdateCustomTheme: (patch: Partial<CustomThemeConfig>) => void;
  onResetCustomTheme: () => void;
  compact?: boolean;
}

export function CustomThemeBuilder({
  language,
  customTheme,
  hasConsoleThemeActive = false,
  activeBaseTheme = 'default',
  activeOsTheme = 'windows',
  isDarkMode = true,
  onUpdateCustomTheme,
  onResetCustomTheme,
  compact = false,
}: CustomThemeBuilderProps) {
  const tr = getTranslations(language);
  const t = tr.customTheme;
  const ts = tr.settings;
  const resolvedBaseTheme: AppThemeMode =
    activeBaseTheme !== 'default'
      ? activeBaseTheme
      : hasConsoleThemeActive
      ? 'ps5'
      : 'default';
  const baseLayerLabel =
    resolvedBaseTheme === 'xbox'
      ? 'Xbox Nexus'
      : resolvedBaseTheme === 'ps5'
      ? 'PlayStation 5'
      : activeOsTheme === 'linux'
      ? 'Linux (Nordic Darker)'
      : activeOsTheme === 'macos'
      ? 'macOS (Cobalt Glass)'
      : 'Windows (Fluent Slate)';

  const [draftTheme, setDraftTheme] = useState<CustomThemeConfig>(customTheme);
  const lastCommittedKeyRef = useRef<string>(JSON.stringify(customTheme));

  useEffect(() => {
    const incomingKey = JSON.stringify(customTheme);
    if (incomingKey !== lastCommittedKeyRef.current) {
      lastCommittedKeyRef.current = incomingKey;
      setDraftTheme(customTheme);
    }
  }, [customTheme]);

  const hasPendingDraft =
    draftTheme.accentColor.toLowerCase() !== customTheme.accentColor.toLowerCase() ||
    draftTheme.secondaryColor.toLowerCase() !== customTheme.secondaryColor.toLowerCase() ||
    draftTheme.surfaceStyle !== customTheme.surfaceStyle ||
    draftTheme.buttonStyle !== customTheme.buttonStyle ||
    draftTheme.cardRadius !== customTheme.cardRadius ||
    draftTheme.glassBlur !== customTheme.glassBlur;

  const surfaceOptions: { id: CustomThemeSurfaceStyle; label: string }[] = [
    { id: 'midnight', label: t.surfaceMidnight },
    { id: 'obsidian', label: t.surfaceObsidian },
    { id: 'abyss', label: t.surfaceAbyss },
    { id: 'daylight', label: t.surfaceDaylight },
  ];

  const buttonOptions: { id: CustomThemeButtonStyle; label: string; radiusClass: string }[] = [
    { id: 'rounded', label: t.btnRounded, radiusClass: 'rounded-lg' },
    { id: 'pill', label: t.btnPill, radiusClass: 'rounded-full' },
    { id: 'sharp', label: t.btnSharp, radiusClass: 'rounded-[4px]' },
  ];

  const cardOptions: { id: CustomThemeCardRadius; label: string; previewRadius: string }[] = [
    { id: 'sharp', label: t.cardSharp, previewRadius: '6px' },
    { id: 'medium', label: t.cardMedium, previewRadius: '12px' },
    { id: 'soft', label: t.cardSoft, previewRadius: '20px' },
  ];

  const activeSurface = CUSTOM_THEME_SURFACE_PALETTES[draftTheme.surfaceStyle];
  const contrastEval = useMemo(
    () => evaluateThemeContrast(draftTheme.accentColor, activeSurface.canvas),
    [draftTheme.accentColor, activeSurface.canvas]
  );
  const secondaryContrastFg = useMemo(
    () => getAccessibleTextOnAccent(draftTheme.secondaryColor),
    [draftTheme.secondaryColor]
  );

  const accentRgb = useMemo(() => parseHexRgb(draftTheme.accentColor), [draftTheme.accentColor]);
  const secondaryRgb = useMemo(
    () => parseHexRgb(draftTheme.secondaryColor),
    [draftTheme.secondaryColor]
  );

  const previewBtnRadius =
    draftTheme.buttonStyle === 'pill'
      ? '9999px'
      : draftTheme.buttonStyle === 'sharp'
      ? '4px'
      : '10px';
  const previewInputRadius =
    draftTheme.buttonStyle === 'pill'
      ? '9999px'
      : draftTheme.buttonStyle === 'sharp'
      ? '5px'
      : '10px';
  const previewCardRadius =
    draftTheme.cardRadius === 'sharp'
      ? '6px'
      : draftTheme.cardRadius === 'soft'
      ? '20px'
      : '12px';
  const previewCardInnerRadius =
    draftTheme.cardRadius === 'sharp'
      ? '4px'
      : draftTheme.cardRadius === 'soft'
      ? '14px'
      : '8px';

  const updateDraft = (patch: Partial<CustomThemeConfig>) => {
    setDraftTheme((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  const handleApplyDraft = () => {
    const next: CustomThemeConfig = {
      ...draftTheme,
      enabled: true,
    };
    lastCommittedKeyRef.current = JSON.stringify(next);
    setDraftTheme(next);
    onUpdateCustomTheme(next);
  };

  const handleDiscardDraft = () => {
    setDraftTheme(customTheme);
  };

  const handleRestoreOsColors = () => {
    const osPatch = restoreOsDefaultCustomColors(activeOsTheme, isDarkMode);
    setDraftTheme((prev) => ({
      ...prev,
      ...osPatch,
    }));
  };

  return (
    <div
      className={`rounded-xl border transition-colors ${
        customTheme.enabled
          ? 'bg-slate-50/90 dark:bg-[#111824] border-sky-400/50 dark:border-white/[0.14]'
          : 'bg-slate-50 dark:bg-[#11161f] border-slate-200 dark:border-white/[0.08]'
      } ${compact ? 'p-4 sm:p-5 space-y-4' : 'p-4 sm:p-5 space-y-5'}`}
    >
      {/* Header & Enable Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-colors"
            style={{
              backgroundColor: draftTheme.accentColor,
              color: contrastEval.recommendedFg,
            }}
          >
            <Swatches className="w-4.5 h-4.5" />
          </span>
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-[14px] sm:text-[14.5px] font-semibold text-slate-900 dark:text-white tracking-normal">
              {t.sectionTitle}
            </h3>
            <p className="text-[12px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
              {t.sectionSubtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRestoreOsColors}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.1] text-[11.5px] font-semibold text-slate-700 dark:text-[#c6d4df] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Swatches className="w-3.5 h-3.5" />
            <span>{t.restoreOsColorsBtn}</span>
          </button>

          <button
            type="button"
            onClick={onResetCustomTheme}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.1] text-[11.5px] font-semibold text-slate-700 dark:text-[#c6d4df] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowCounterClockwise className="w-3.5 h-3.5" />
            <span>{t.resetBtn}</span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={customTheme.enabled}
            onClick={() => {
              const next: CustomThemeConfig = {
                ...draftTheme,
                enabled: !customTheme.enabled,
              };
              lastCommittedKeyRef.current = JSON.stringify(next);
              setDraftTheme(next);
              onUpdateCustomTheme(next);
            }}
            className="inline-flex items-center gap-2.5 min-h-[36px] shrink-0 cursor-pointer group focus:outline-none"
          >
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap ${
                customTheme.enabled
                  ? 'text-[#0284c7] dark:text-[#66c0f4]'
                  : 'text-slate-500 dark:text-[#8b9bb4]'
              }`}
            >
              {customTheme.enabled ? ts.activeLabel : ts.inactiveLabel}
            </span>
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200 ${
                customTheme.enabled
                  ? 'border-transparent'
                  : 'bg-slate-200 border-slate-300 dark:bg-[#0e131b] dark:border-white/[0.14]'
              }`}
              style={
                customTheme.enabled
                  ? { backgroundColor: draftTheme.accentColor }
                  : undefined
              }
            >
              <span
                className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  customTheme.enabled ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-[11.5px]">
        <span className="text-slate-600 dark:text-[#9cb0c9]">
          {baseLayerLabel}
        </span>
        <span
          className="font-semibold"
          style={{ color: customTheme.enabled ? draftTheme.accentColor : undefined }}
        >
          {customTheme.enabled ? ts.activeLabel : ts.inactiveLabel}
        </span>
      </div>

      {/* Surface Palette Picker + Primary & Secondary Color Pickers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Base Surface */}
        <div className="space-y-2">
          <div className="text-[12.5px] font-semibold text-slate-800 dark:text-[#dce4ee]">
            {t.surfaceLabel}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
            {surfaceOptions.map((surf) => {
              const palette = CUSTOM_THEME_SURFACE_PALETTES[surf.id];
              const selected = draftTheme.surfaceStyle === surf.id;
              return (
                <button
                  key={surf.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateDraft({ surfaceStyle: surf.id })}
                  className={`p-2.5 rounded-lg border text-start transition-all cursor-pointer flex items-center gap-2.5 ${
                    selected
                      ? 'bg-white dark:bg-[#172231] border-[#1a9fff] ring-1 ring-[#1a9fff]/45'
                      : 'bg-white/75 dark:bg-[#0e141c] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.2]'
                  }`}
                >
                  <span
                    className="w-7 h-7 rounded-md border border-black/15 dark:border-white/15 shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${palette.swatchTop} 0%, ${palette.swatchBottom} 100%)`,
                    }}
                  />
                  <span className="text-[12px] font-semibold text-slate-800 dark:text-white truncate">
                    {surf.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary & Secondary Accent Colors */}
        <div className="space-y-3">
          {/* Primary Accent */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-slate-800 dark:text-[#dce4ee]">
                {t.accentColorLabel}
              </span>
              <span
                dir="ltr"
                className="text-[11.5px] font-mono-tabular font-semibold text-slate-500 dark:text-[#8b9bb4]"
              >
                {draftTheme.accentColor.toUpperCase()}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {CUSTOM_THEME_ACCENT_PRESETS.map((preset) => {
                const selected =
                  draftTheme.accentColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-label={preset.id}
                    onClick={() =>
                      updateDraft({
                        accentColor: preset.hex,
                        secondaryColor: preset.secondary,
                      })
                    }
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer border ${
                      selected
                        ? 'border-slate-900 dark:border-white ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-[#11161f] ring-sky-400/60'
                        : 'border-black/15 dark:border-white/15'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  >
                    {selected && <Check weight="bold" className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                );
              })}

              <label className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-[#0e141c] border border-slate-200 dark:border-white/[0.1] text-[11.5px] font-semibold text-slate-700 dark:text-[#c6d4df] cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.22]">
                <input
                  type="color"
                  value={draftTheme.accentColor}
                  onChange={(e) =>
                    updateDraft({
                      accentColor: e.target.value,
                    })
                  }
                  aria-label={t.customHexLabel}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span>{t.customHexLabel}</span>
              </label>
            </div>
          </div>

          {/* Secondary Accent */}
          <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate-700 dark:text-[#c6d4df]">
                {t.secondaryColorLabel}
              </span>
              <span
                dir="ltr"
                className="text-[11px] font-mono-tabular font-semibold text-slate-500 dark:text-[#8b9bb4]"
              >
                {draftTheme.secondaryColor.toUpperCase()}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {CUSTOM_THEME_ACCENT_PRESETS.map((preset) => {
                const selected =
                  draftTheme.secondaryColor.toLowerCase() === preset.secondary.toLowerCase();
                return (
                  <button
                    key={`${preset.id}-sec`}
                    type="button"
                    aria-label={`${preset.id}-secondary`}
                    onClick={() => updateDraft({ secondaryColor: preset.secondary })}
                    className={`w-6.5 h-6.5 rounded-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer border ${
                      selected
                        ? 'border-slate-900 dark:border-white ring-2 ring-offset-1 ring-sky-400/60'
                        : 'border-black/15 dark:border-white/15'
                    }`}
                    style={{ backgroundColor: preset.secondary }}
                  >
                    {selected && <Check weight="bold" className="w-3 h-3 text-slate-900" />}
                  </button>
                );
              })}

              <label className="inline-flex items-center gap-1.5 min-h-[30px] px-2 py-0.5 rounded-md bg-white dark:bg-[#0e141c] border border-slate-200 dark:border-white/[0.1] text-[11px] font-semibold text-slate-700 dark:text-[#c6d4df] cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.22]">
                <input
                  type="color"
                  value={draftTheme.secondaryColor}
                  onChange={(e) => updateDraft({ secondaryColor: e.target.value })}
                  aria-label={t.secondaryColorLabel}
                  className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span>{t.customHexLabel}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Geometry Controls: Button Style + Card Radius + Glass Blur */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
        {/* Button Style */}
        <div className="space-y-1.5">
          <div className="text-[12px] font-semibold text-slate-700 dark:text-[#c6d4df]">
            {t.buttonStyleLabel}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {buttonOptions.map((opt) => {
              const selected = draftTheme.buttonStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateDraft({ buttonStyle: opt.id })}
                  className={`min-h-[38px] px-2 py-1.5 ${opt.radiusClass} border text-[11.5px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    selected
                      ? 'border-transparent shadow-sm'
                      : 'bg-white dark:bg-[#0e141c] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#b8c6d8] hover:border-slate-300 dark:hover:border-white/[0.2]'
                  }`}
                  style={
                    selected
                      ? {
                          backgroundColor: draftTheme.accentColor,
                          color: contrastEval.recommendedFg,
                        }
                      : undefined
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card Radius */}
        <div className="space-y-1.5">
          <div className="text-[12px] font-semibold text-slate-700 dark:text-[#c6d4df]">
            {t.cardRadiusLabel}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {cardOptions.map((opt) => {
              const selected = draftTheme.cardRadius === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateDraft({ cardRadius: opt.id })}
                  style={{
                    borderRadius: opt.previewRadius,
                    ...(selected
                      ? {
                          backgroundColor: draftTheme.accentColor,
                          color: contrastEval.recommendedFg,
                        }
                      : {}),
                  }}
                  className={`min-h-[38px] px-2 py-1.5 border text-[11.5px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    selected
                      ? 'border-transparent shadow-sm'
                      : 'bg-white dark:bg-[#0e141c] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#b8c6d8] hover:border-slate-300 dark:hover:border-white/[0.2]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Frosted Glass Blur */}
        <div className="space-y-1.5">
          <div className="text-[12px] font-semibold text-slate-700 dark:text-[#c6d4df]">
            {t.glassBlurLabel}
          </div>
          <button
            type="button"
            aria-pressed={draftTheme.glassBlur}
            onClick={() => updateDraft({ glassBlur: !draftTheme.glassBlur })}
            className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-[12px] font-semibold transition-colors cursor-pointer ${
              draftTheme.glassBlur
                ? 'bg-white dark:bg-[#172231] border-sky-400/60 text-slate-900 dark:text-white'
                : 'bg-white dark:bg-[#0e141c] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-[#9cb0c9]'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <Drop className="w-4 h-4 shrink-0" style={{ color: draftTheme.accentColor }} />
              <span className="truncate">{t.glassBlurDesc}</span>
            </span>
            <span className="font-mono-tabular text-[11px] shrink-0">
              {draftTheme.glassBlur ? ts.activeLabel : ts.inactiveLabel}
            </span>
          </button>
        </div>
      </div>

      {/* Live Miniature Theme Studio Stage (Showcases Surface, Blur Orbs, Search Bar, Game Card, Links, Buttons, Contrast) */}
      <div
        className="relative overflow-hidden p-3.5 sm:p-4 border transition-all"
        style={{
          backgroundColor: activeSurface.canvas,
          borderColor: activeSurface.borderStrong,
          borderRadius: previewCardRadius,
        }}
      >
        {/* Ambient backdrop color orbs behind the glass surface so Frosted Glass Blur is unmistakably visible */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -end-10 w-44 h-44 rounded-full transition-colors duration-300"
          style={{
            background: `radial-gradient(circle, rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${
              activeSurface.isDark ? 0.55 : 0.42
            }) 0%, transparent 70%)`,
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 -start-10 w-44 h-44 rounded-full transition-colors duration-300"
          style={{
            background: `radial-gradient(circle, rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, ${
              activeSurface.isDark ? 0.48 : 0.36
            }) 0%, transparent 70%)`,
          }}
        />

        {/* Inner Surface / Frosted Glass Card */}
        <div
          className="relative z-10 p-3.5 sm:p-4 border transition-all duration-200 space-y-3.5"
          style={{
            backgroundColor: draftTheme.glassBlur
              ? activeSurface.surfaceGlass
              : activeSurface.surface,
            backdropFilter: draftTheme.glassBlur ? 'blur(18px) saturate(165%)' : 'none',
            WebkitBackdropFilter: draftTheme.glassBlur ? 'blur(18px) saturate(165%)' : 'none',
            borderColor: activeSurface.border,
            borderRadius: previewCardRadius,
            color: activeSurface.textPrimary,
            boxShadow: activeSurface.isDark
              ? '0 14px 32px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 10px 26px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
          }}
        >
          {/* Preview Header + Miniature Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 flex items-center justify-center shrink-0 border"
                style={{
                  borderRadius: previewCardInnerRadius,
                  backgroundColor: `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.16)`,
                  borderColor: `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.38)`,
                  color: draftTheme.accentColor,
                }}
              >
                <Sparkle weight="fill" className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.09em] truncate"
                  style={{ color: draftTheme.secondaryColor }}
                >
                  {t.previewLabel}
                </div>
                <div className="text-[13.5px] font-display font-bold truncate">
                  {t.previewTitle}
                </div>
              </div>
            </div>

            {/* Live Miniature Search Bar */}
            <div
              className="flex items-center gap-2 px-3 min-h-[34px] border text-[11.5px] transition-all sm:w-52 shrink-0"
              style={{
                backgroundColor: draftTheme.glassBlur
                  ? activeSurface.subsurfaceGlass
                  : activeSurface.subsurface,
                borderColor: `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.45)`,
                borderRadius: previewInputRadius,
                boxShadow: `0 0 0 2px rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.14)`,
                color: activeSurface.textMuted,
              }}
            >
              <MagnifyingGlass
                weight="bold"
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: draftTheme.accentColor }}
              />
              <span className="truncate flex-1">{tr.library?.searchPlaceholder || 'Search catalog...'}</span>
              <span
                dir="ltr"
                className="text-[9.5px] font-mono-tabular font-semibold px-1.5 py-0.5 rounded border"
                style={{
                  borderColor: activeSurface.border,
                  color: draftTheme.secondaryColor,
                }}
              >
                /
              </span>
            </div>
          </div>

          {/* Preview Body: Miniature Game Tile + Typography + Primary/Secondary Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            {/* Miniature Game Card + Link */}
            <div
              className="flex items-center gap-3 p-2 border transition-transform hover:-translate-y-0.5"
              style={{
                backgroundColor: draftTheme.glassBlur
                  ? activeSurface.subsurfaceGlass
                  : activeSurface.subsurface,
                borderColor: activeSurface.border,
                borderRadius: previewCardInnerRadius,
              }}
            >
              <div
                className="relative w-12 h-14 shrink-0 overflow-hidden flex items-center justify-center border"
                style={{
                  borderRadius: previewCardInnerRadius,
                  borderColor: `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.45)`,
                  background: `linear-gradient(135deg, ${draftTheme.accentColor} 0%, ${draftTheme.secondaryColor} 100%)`,
                }}
              >
                <GameController
                  className="w-6 h-6 opacity-90"
                  style={{ color: contrastEval.recommendedFg }}
                />
                <span
                  className="absolute top-1 start-1 px-1 py-[1px] rounded text-[8px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: draftTheme.secondaryColor,
                    color: secondaryContrastFg,
                  }}
                >
                  NEW
                </span>
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-[12.5px] font-display font-bold truncate">
                  Cyberpunk Horizon
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className="underline decoration-dotted underline-offset-2 font-semibold"
                    style={{ color: draftTheme.secondaryColor }}
                  >
                    Night City Studios
                  </span>
                  <span style={{ color: activeSurface.textMuted }} className="font-mono-tabular">
                    · 48.2 GB
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Preview Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span
                className="inline-flex items-center justify-center min-h-[34px] px-3.5 py-1 text-[12px] font-semibold whitespace-nowrap transition-transform hover:-translate-y-0.5 shadow-sm"
                style={{
                  backgroundColor: draftTheme.accentColor,
                  color: contrastEval.recommendedFg,
                  borderRadius: previewBtnRadius,
                  boxShadow: `0 6px 16px rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.34)`,
                }}
              >
                {t.previewPrimaryBtn}
              </span>
              <span
                className="inline-flex items-center justify-center min-h-[34px] px-3.5 py-1 border text-[12px] font-semibold whitespace-nowrap transition-colors"
                style={{
                  borderColor: draftTheme.secondaryColor,
                  backgroundColor: `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.14)`,
                  borderRadius: previewBtnRadius,
                  color: activeSurface.isDark ? '#f1f5f9' : '#0f172a',
                }}
              >
                {t.previewSecondaryBtn}
              </span>
            </div>
          </div>

          {/* Contrast Verification + Live Metrics Bar */}
          <div
            className="pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-[11.5px]"
            style={{ borderColor: activeSurface.border }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span style={{ color: activeSurface.textMuted }}>{t.contrastLabel}:</span>
              <span dir="ltr" className="font-mono-tabular font-bold">
                {contrastEval.buttonTextContrast.toFixed(1)}:1
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                  contrastEval.passesAA
                    ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                }`}
              >
                {contrastEval.passesAA ? (
                  <ShieldCheck weight="fill" className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <WarningCircle weight="fill" className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{contrastEval.passesAA ? t.contrastPassBadge : t.contrastWarnBadge}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10.5px] font-mono-tabular" style={{ color: activeSurface.textMuted }}>
              <span>{draftTheme.buttonStyle}</span>
              <span>·</span>
              <span>{draftTheme.cardRadius}</span>
              <span>·</span>
              <span>{draftTheme.glassBlur ? 'glass' : 'solid'}</span>
            </div>
          </div>
          {!contrastEval.passesAA && (
            <div className="text-[11px] text-amber-500 dark:text-amber-400">{t.contrastHint}</div>
          )}
        </div>
      </div>

      {/* Live Preview Apply / Discard Bar */}
      {(hasPendingDraft || !customTheme.enabled) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg bg-sky-500/10 dark:bg-[#1a9fff]/10 border border-sky-400/30 dark:border-[#1a9fff]/25">
          <span className="text-[12px] font-medium text-slate-700 dark:text-[#cbd6e4]">
            {t.previewingDraftNote}
          </span>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasPendingDraft && (
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="min-h-[34px] px-3 py-1 rounded-lg bg-white dark:bg-[#11161f] hover:bg-slate-100 dark:hover:bg-[#1a222e] border border-slate-300 dark:border-white/[0.12] text-[12px] font-semibold text-slate-700 dark:text-[#c6d4df] transition-colors cursor-pointer"
              >
                {t.discardPreviewBtn}
              </button>
            )}
            <button
              type="button"
              onClick={handleApplyDraft}
              className="min-h-[34px] px-3.5 py-1 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
              style={{
                backgroundColor: draftTheme.accentColor,
                color: contrastEval.recommendedFg,
              }}
            >
              {t.applyThemeBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
