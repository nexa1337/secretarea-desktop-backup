import {
  BatteryCharging,
  CheckCircle,
  GraphicsCard,
  Info,
  Laptop,
  Monitor,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import type {
  GpuCapabilitiesProfile,
  HardwareMonitorSnapshot,
  HardwareTechStatus,
} from '../../types';
import type { AppLanguage } from '../../services/launcherSettings';
import { getTranslations } from '../../i18n/translations';
import { isValidMetric } from '../../services/hardwareMonitor';

interface GpuCapabilitiesPanelProps {
  language: AppLanguage;
  snapshot: HardwareMonitorSnapshot;
}

function getTechStatusDisplay(
  status: HardwareTechStatus,
  t: ReturnType<typeof getTranslations>['hardware']
) {
  switch (status) {
    case 'active':
      return {
        label: t.techStatusActive,
        tone: 'text-emerald-700 dark:text-[#34d399] bg-emerald-500/12 border-emerald-500/30',
        Icon: CheckCircle,
      };
    case 'supported':
      return {
        label: t.techStatusSupported,
        tone: 'text-[var(--sa-accent)] bg-[var(--sa-accent-soft)] border-[var(--sa-accent-ring)]',
        Icon: CheckCircle,
      };
    case 'detected':
      return {
        label: t.techStatusDetected,
        tone: 'text-emerald-700 dark:text-[#34d399] bg-emerald-500/12 border-emerald-500/30',
        Icon: CheckCircle,
      };
    case 'requires_game_integration':
      return {
        label: t.techStatusRequiresGame,
        tone: 'text-violet-700 dark:text-[#c4b5fd] bg-violet-500/12 border-violet-500/30',
        Icon: Info,
      };
    case 'requires_driver_or_sdk':
      return {
        label: t.techStatusRequiresDriver,
        tone: 'text-amber-700 dark:text-amber-300 bg-amber-500/12 border-amber-500/30',
        Icon: WarningCircle,
      };
    case 'unsupported':
      return {
        label: t.techStatusUnsupported,
        tone: 'text-slate-600 dark:text-[#94a3b8] bg-slate-500/10 border-slate-500/25',
        Icon: XCircle,
      };
    default:
      return {
        label: t.techStatusUnavailable,
        tone: 'text-slate-500 dark:text-[#8b9bb4] bg-slate-500/10 border-slate-500/20',
        Icon: Info,
      };
  }
}

export function GpuCapabilitiesPanel({ language, snapshot }: GpuCapabilitiesPanelProps) {
  const t = getTranslations(language).hardware;
  const naLabel = t.naValue;

  const capabilities = snapshot.capabilities;
  const gpuTechProfiles: GpuCapabilitiesProfile[] = capabilities?.gpuTechnologies || [];
  const display = capabilities?.display || null;
  const laptop = capabilities?.laptop || null;
  const primaryDisplay = display?.primaryMonitor || display?.monitors?.[0] || null;

  return (
    <div className="space-y-5">
      {/* Header Summary */}
      <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs dark:shadow-md space-y-2">
        <div className="flex items-start gap-3">
          <div className="sa-icon-badge w-9 h-9 flex items-center justify-center shrink-0">
            <GraphicsCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-[16px] font-bold text-slate-900 dark:text-white">{t.techTitle}</h2>
            <p className="text-[12.5px] text-slate-600 dark:text-[#9cb0c9]">{t.techSubtitle}</p>
          </div>
        </div>
      </section>

      {/* Per-GPU Vendor Technology Matrix */}
      {gpuTechProfiles.length === 0 ? (
        <section className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-5 text-[13px] text-slate-500 dark:text-[#8b9bb4]">
          {t.noGpuDetected}
        </section>
      ) : (
        <div className="space-y-4">
          {gpuTechProfiles.map((profile) => (
            <article
              key={profile.gpuId}
              className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs dark:shadow-md space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--sa-accent)]">
                    {profile.vendor} {profile.isIntegrated ? '· iGPU' : '· dGPU'}
                  </div>
                  <h3 className="text-[15.5px] font-bold text-slate-900 dark:text-white truncate">
                    {profile.model || naLabel}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600 dark:text-[#9cb0c9]">
                  <span>
                    {t.techArchitectureLabel}:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {profile.architecture || naLabel}
                    </strong>
                  </span>
                  <span>
                    {t.techDriverLabel}:{' '}
                    <strong dir="ltr" className="font-mono-tabular text-slate-900 dark:text-white">
                      {profile.driverVersion || naLabel}
                    </strong>
                  </span>
                  <span>
                    {t.techRebarLabel}:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {profile.resizableBarActive === true
                        ? t.techStatusActive
                        : profile.resizableBarActive === false
                        ? t.techStatusUnsupported
                        : naLabel}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {profile.features.map((feat) => {
                  const statusMeta = getTechStatusDisplay(feat.status, t);
                  const StatusIcon = statusMeta.Icon;

                  return (
                    <div
                      key={feat.id}
                      className="sa-ps5-subpanel rounded-lg bg-slate-50/90 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.07] p-3 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-bold text-slate-900 dark:text-white leading-snug">
                          {feat.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10.5px] font-semibold shrink-0 ${statusMeta.tone}`}
                        >
                          <StatusIcon className="w-3 h-3 shrink-0" />
                          <span>{statusMeta.label}</span>
                        </span>
                      </div>
                      <p className="text-[11.5px] text-slate-600 dark:text-[#8b9bb4] leading-relaxed">
                        {feat.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Display & Laptop Capabilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Display & Windows Gaming Settings */}
        <article className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs dark:shadow-md space-y-3">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-5 h-5 text-[var(--sa-accent)] shrink-0" />
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t.displayTitle}</h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-[12.5px]">
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.displayPrimaryLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-white text-end">
                {primaryDisplay?.model || naLabel}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.displayResolutionLabel}</span>
              <span dir="ltr" className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {primaryDisplay?.resolutionText || naLabel}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.displayRefreshRateLabel}</span>
              <span dir="ltr" className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {isValidMetric(primaryDisplay?.refreshRateHz)
                  ? `${primaryDisplay.refreshRateHz} Hz`
                  : naLabel}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.displayConnectionLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {primaryDisplay?.connectionType || naLabel}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.displayActiveGpuLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-white text-end">
                {display?.activeRenderingGpu || naLabel}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.displayDirectXLabel}</span>
              <span dir="ltr" className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {display?.directXVersion ||
                  (snapshot.platform === 'linux' || snapshot.platform === 'darwin'
                    ? `${naLabel} · ${t.windowsOnlyTag}`
                    : naLabel)}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.displayHagsLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {display?.hagsStatus ||
                  (snapshot.platform === 'linux' || snapshot.platform === 'darwin'
                    ? `${naLabel} · ${t.windowsOnlyTag}`
                    : naLabel)}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.displayGameModeLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {display?.windowsGameMode ||
                  (snapshot.platform === 'linux' || snapshot.platform === 'darwin'
                    ? `${naLabel} · ${t.windowsOnlyTag}`
                    : naLabel)}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.displayHdrLabel} / {t.displayVrrLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {display?.hdrActive === true
                  ? t.techStatusActive
                  : display?.hdrSupported === true
                  ? t.techStatusSupported
                  : naLabel}
                {' · '}
                {display?.vrrActive === true
                  ? t.techStatusActive
                  : display?.vrrSupported === true
                  ? t.techStatusSupported
                  : naLabel}
              </span>
            </div>
          </div>
        </article>

        {/* Laptop & Hybrid GPU Telemetry */}
        <article className="sa-ps5-panel rounded-xl bg-white dark:bg-[#171d25] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs dark:shadow-md space-y-3">
          <div className="flex items-center gap-2.5">
            {laptop?.isLaptopOrBatteryDevice ? (
              <BatteryCharging className="w-5 h-5 text-emerald-600 dark:text-[#34d399] shrink-0" />
            ) : (
              <Laptop className="w-5 h-5 text-emerald-600 dark:text-[#34d399] shrink-0" />
            )}
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t.laptopTitle}</h3>
          </div>

          {!laptop?.isLaptopOrBatteryDevice && (
            <p className="rounded-lg bg-slate-50 dark:bg-[#11161d] border border-slate-200/80 dark:border-white/[0.06] px-3 py-2 text-[12px] text-slate-600 dark:text-[#9cb0c9]">
              {t.laptopDesktopNotice}
            </p>
          )}

          <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-[12.5px]">
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.laptopBatteryLabel}</span>
              <span dir="ltr" className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {isValidMetric(laptop?.batteryPercent) ? `${laptop.batteryPercent}%` : naLabel}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.laptopPowerStateLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {laptop?.isCharging
                  ? t.laptopCharging
                  : laptop?.acConnected === true
                  ? t.laptopPluggedIn
                  : laptop?.acConnected === false
                  ? t.laptopOnBattery
                  : naLabel}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.laptopHealthLabel}</span>
              <span dir="ltr" className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {isValidMetric(laptop?.batteryHealthPercent) ? `${laptop.batteryHealthPercent}%` : naLabel}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.laptopPowerPlanLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-white text-end">
                {laptop?.powerPlan || naLabel}
              </span>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-[#9cb0c9]">{t.laptopHybridGpuLabel}</span>
              <span className="font-semibold text-slate-900 dark:text-white text-end">
                {laptop?.hybridGpuMode || naLabel}
              </span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
