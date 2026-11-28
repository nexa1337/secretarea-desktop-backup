import type {
  DownloadManagerSnapshot,
  DownloadSourceType,
  DownloadTask,
  GameItem,
  MirrorLink,
  QbitLifecyclePreferences,
  SheetTabKey,
  TorrentConnectionTestResult,
  TorrentDetectionResult,
  TorrentIntegrationConfig,
} from '../types';

export interface StartDownloadPayload {
  url: string;
  title?: string;
  channelGroup?: string;
  coverImage?: string;
  gameId?: string;
  gameTab?: SheetTabKey;
}

export interface SecretAreaDownloadsBridge {
  getState: () => Promise<DownloadManagerSnapshot | null>;
  start: (payload: StartDownloadPayload) => Promise<DownloadTask>;
  addTorrentFile: () => Promise<DownloadTask | null>;
  pause: (id: string) => Promise<DownloadManagerSnapshot | null>;
  resume: (id: string) => Promise<DownloadManagerSnapshot | null>;
  cancel: (id: string) => Promise<DownloadManagerSnapshot | null>;
  retry: (id: string) => Promise<DownloadManagerSnapshot | null>;
  remove: (id: string, deleteFiles?: boolean) => Promise<DownloadManagerSnapshot | null>;
  clearCompleted: () => Promise<DownloadManagerSnapshot | null>;
  chooseFolder: () => Promise<DownloadManagerSnapshot | null>;
  openFolder: (id?: string) => Promise<boolean>;
  openFile: (id: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  detectTorrentClient: () => Promise<TorrentDetectionResult | null>;
  saveTorrentConfig: (
    cfg: Partial<TorrentIntegrationConfig>
  ) => Promise<DownloadManagerSnapshot | null>;
  testTorrentConnection: (
    cfg?: Partial<TorrentIntegrationConfig>
  ) => Promise<TorrentConnectionTestResult | null>;
  reconnectTorrent: () => Promise<DownloadManagerSnapshot | null>;
  startQbitBackground: () => Promise<DownloadManagerSnapshot | null>;
  quitQbit: () => Promise<{ ok: boolean; processRunning?: boolean; snapshot?: DownloadManagerSnapshot } | null>;
  applyDetectedPort: (port: number) => Promise<DownloadManagerSnapshot | null>;
  saveQbitLifecyclePrefs: (
    prefs: Partial<QbitLifecyclePreferences>
  ) => Promise<DownloadManagerSnapshot | null>;
  onUpdated: (callback: (snapshot: DownloadManagerSnapshot) => void) => () => void;
}

interface SecretAreaDesktopWithDownloads {
  isDesktop?: boolean;
  downloads?: SecretAreaDownloadsBridge;
}

export function getDesktopDownloadsBridge(): SecretAreaDownloadsBridge | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    secretAreaDesktop?: SecretAreaDesktopWithDownloads;
  };
  if (!win.secretAreaDesktop?.isDesktop || !win.secretAreaDesktop?.downloads) {
    return null;
  }
  return win.secretAreaDesktop.downloads;
}

export const DEFAULT_TORRENT_CONFIG: TorrentIntegrationConfig = {
  enabled: false,
  host: '127.0.0.1',
  port: 8080,
  username: 'admin',
  password: '',
  apiKey: '',
  hasSavedPassword: false,
  hasSavedApiKey: false,
  pollIntervalMs: 1500,
};

export const DEFAULT_QBIT_LIFECYCLE_PREFS: QbitLifecyclePreferences = {
  autoStartQbit: true,
  keepQbitRunningOnClose: true,
  launchQbitMinimized: true,
  autoReconnect: true,
};

export const EMPTY_DOWNLOAD_SNAPSHOT: DownloadManagerSnapshot = {
  tasks: [],
  downloadFolder: '',
  maxConcurrent: 3,
  torrentConfig: DEFAULT_TORRENT_CONFIG,
  torrentConnected: false,
  torrentVersion: null,
  torrentWebApiVersion: null,
  torrentError: null,
  torrentConnectionState: 'idle',
  torrentConnectionDetail: {
    reasonCode: 'disabled',
    hint: null,
    processRunning: false,
    processName: null,
    managedByApp: false,
    webUiEnabledInConfig: null,
    detectedConfigPort: null,
    detectedOpenPorts: [],
    httpsEnabledInConfig: false,
    attempt: 0,
    maxAttempts: 0,
    lastConnectedAt: null,
  },
  qbitLifecyclePrefs: DEFAULT_QBIT_LIFECYCLE_PREFS,
};

const WEB_DOWNLOADS_STORAGE_KEY = 'secretarea_web_downloads_v1';
const WEB_TORRENT_CFG_STORAGE_KEY = 'secretarea_web_qbit_cfg_v1';

export function isLoopbackHost(host: string): boolean {
  const clean = host.trim().toLowerCase();
  return (
    clean === '127.0.0.1' ||
    clean === 'localhost' ||
    clean === '::1' ||
    clean === '[::1]'
  );
}

export function detectDownloadSourceFromUrl(
  rawUrl: string,
  channelGroup?: string
): DownloadSourceType {
  const lower = rawUrl.trim().toLowerCase();
  const groupLower = (channelGroup || '').toLowerCase();
  if (
    lower.startsWith('magnet:') ||
    lower.endsWith('.torrent') ||
    lower.includes('.torrent?') ||
    groupLower.includes('magnet') ||
    groupLower.includes('torrent')
  ) {
    return 'qbittorrent';
  }
  if (lower.includes('mediafire.com') || groupLower.includes('mediafire')) {
    return 'mediafire';
  }
  if (lower.includes('mega.nz') || lower.includes('mega.co.nz') || groupLower.includes('mega')) {
    return 'mega';
  }
  return 'direct';
}

export function isValidDownloadInputUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  if (/^magnet:\?/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildMirrorDownloadPayload(
  mirror: MirrorLink,
  game: GameItem
): StartDownloadPayload {
  const sameLabel =
    mirror.label.trim().toLowerCase() === game.name.trim().toLowerCase();
  const title = sameLabel ? game.name : `${game.name} — ${mirror.label}`;
  return {
    url: mirror.url,
    title,
    channelGroup: mirror.group,
    coverImage: game.coverImage || undefined,
    gameId: game.id,
    gameTab: game.tab,
  };
}

function extractWebMagnetDisplayName(magnetUrl: string): string {
  const match = magnetUrl.match(/[?&]dn=([^&]+)/i);
  if (!match || !match[1]) return '';
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
  } catch {
    return match[1].trim();
  }
}

export function loadWebFallbackSnapshot(): DownloadManagerSnapshot {
  if (typeof window === 'undefined') return EMPTY_DOWNLOAD_SNAPSHOT;
  let tasks: DownloadTask[] = [];
  let torrentConfig: TorrentIntegrationConfig = { ...DEFAULT_TORRENT_CONFIG };
  try {
    const rawTasks = window.localStorage.getItem(WEB_DOWNLOADS_STORAGE_KEY);
    if (rawTasks) {
      const parsed = JSON.parse(rawTasks);
      if (Array.isArray(parsed)) {
        tasks = parsed.map((rawItem) => {
          if (!rawItem || typeof rawItem !== 'object') return rawItem;
          const item: DownloadTask =
            rawItem.source === 'utorrent'
              ? { ...rawItem, source: 'qbittorrent' as const }
              : rawItem;
          if (
            item.status === 'completed' &&
            Number(item.totalBytes || 0) === 0 &&
            Number(item.downloadedBytes || 0) === 0
          ) {
            return {
              ...item,
              status: 'queued',
              progress: 0,
              etaSeconds: null,
              completedAt: null,
              fileName:
                item.fileName === 'magnet:' && item.url
                  ? extractWebMagnetDisplayName(item.url) || item.title
                  : item.fileName,
              error:
                item.error ||
                (item.source === 'qbittorrent'
                  ? 'Handed off in Web Preview — live qBittorrent progress requires SecretArea.exe Desktop App.'
                  : 'Opened externally in Web Preview — live tracking requires SecretArea.exe Desktop App.'),
            };
          }
          return item;
        });
      }
    }
  } catch {
    // ignore
  }
  try {
    const rawCfg = window.localStorage.getItem(WEB_TORRENT_CFG_STORAGE_KEY);
    if (rawCfg) {
      const parsed = JSON.parse(rawCfg) as Partial<TorrentIntegrationConfig>;
      torrentConfig = {
        ...DEFAULT_TORRENT_CONFIG,
        ...parsed,
        host:
          typeof parsed.host === 'string' && isLoopbackHost(parsed.host)
            ? parsed.host.trim()
            : '127.0.0.1',
        password: '',
        apiKey: '',
      };
    }
  } catch {
    // ignore
  }
  return {
    tasks,
    downloadFolder: 'Browser Downloads',
    maxConcurrent: 3,
    torrentConfig,
    torrentConnected: false,
    torrentVersion: null,
    torrentWebApiVersion: null,
    torrentError: null,
    torrentConnectionState: 'idle',
    torrentConnectionDetail: {
      reasonCode: 'web_preview',
      hint: null,
      processRunning: false,
      processName: null,
      managedByApp: false,
      webUiEnabledInConfig: null,
      detectedConfigPort: null,
      detectedOpenPorts: [],
      httpsEnabledInConfig: false,
      attempt: 0,
      maxAttempts: 0,
      lastConnectedAt: null,
    },
    qbitLifecyclePrefs: DEFAULT_QBIT_LIFECYCLE_PREFS,
  };
}

export function saveWebFallbackTasks(tasks: DownloadTask[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEB_DOWNLOADS_STORAGE_KEY, JSON.stringify(tasks.slice(0, 60)));
  } catch {
    // ignore quota error
  }
}

export function saveWebFallbackTorrentConfig(cfg: Partial<TorrentIntegrationConfig>): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized: TorrentIntegrationConfig = {
      ...DEFAULT_TORRENT_CONFIG,
      ...cfg,
      host:
        typeof cfg.host === 'string' && isLoopbackHost(cfg.host)
          ? cfg.host.trim()
          : '127.0.0.1',
      password: '',
      apiKey: '',
    };
    window.localStorage.setItem(WEB_TORRENT_CFG_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore
  }
}

export function createWebFallbackTask(payload: StartDownloadPayload): DownloadTask {
  const cleanUrl = payload.url.trim();
  const source = detectDownloadSourceFromUrl(cleanUrl, payload.channelGroup);
  const magnetName = source === 'qbittorrent' ? extractWebMagnetDisplayName(cleanUrl) : '';
  const urlTail = cleanUrl.startsWith('magnet:')
    ? ''
    : cleanUrl.split('/').filter(Boolean).pop()?.split('?')[0] || '';
  const fileName = magnetName || urlTail || payload.title || 'SecretArea-Download';
  const now = Date.now();
  return {
    id: `web-${now}-${Math.random().toString(36).slice(2, 6)}`,
    title: payload.title || fileName,
    fileName,
    url: cleanUrl,
    source,
    channelGroup: payload.channelGroup || 'Direct Link',
    coverImage: payload.coverImage,
    gameId: payload.gameId,
    gameTab: payload.gameTab,
    status: 'queued',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
    uploadSpeedBytesPerSec: 0,
    etaSeconds: null,
    savePath: '',
    canPauseResume: false,
    error:
      source === 'qbittorrent'
        ? 'Handed off to external torrent app (Web Preview cannot sync live qBittorrent progress — use SecretArea.exe Desktop App).'
        : 'Opened externally in Web Preview — live speed & progress tracking run in SecretArea.exe Desktop App.',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const decimals = idx === 0 ? 0 : idx === 1 ? 0 : value >= 100 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[idx]}`;
}

export function formatDownloadSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  const kb = bytesPerSec / 1024;
  if (kb < 1024) return `${kb >= 100 ? kb.toFixed(0) : kb.toFixed(1)} KB/s`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb >= 100 ? mb.toFixed(0) : mb.toFixed(2)} MB/s`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB/s`;
}

export function formatEta(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  if (seconds === 0) return '0s';
  const total = Math.ceil(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
