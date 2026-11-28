const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');

const ALLOWED_EXECUTABLE_BASENAMES = new Set([
  'qbittorrent.exe',
  'qbittorrent',
  'qbittorrent-nox',
  'qbittorrent.app',
  'org.qbittorrent.qbittorrent',
]);

function isLoopbackHost(host) {
  const clean = String(host || '').trim().toLowerCase();
  return (
    clean === '127.0.0.1' ||
    clean === 'localhost' ||
    clean === '::1' ||
    clean === '[::1]'
  );
}

function normalizeVersionString(raw) {
  const str = String(raw || '').trim();
  if (!str) return '';
  const match = str.match(/(\d+(?:\.\d+){1,3})/);
  if (!match || !match[1]) return '';
  const parts = match[1].split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length > 3 && parts[parts.length - 1] === 0) {
    parts.pop();
  }
  return parts.join('.');
}

function validateQbitExecutablePath(exePath, platform = process.platform) {
  if (typeof exePath !== 'string' || !exePath.trim()) return '';
  if (/[\x00-\x1f\x7f]/.test(exePath)) return '';
  const cleaned = exePath.trim();
  const isWin = platform === 'win32';
  const resolved = isWin ? path.win32.normalize(cleaned) : path.resolve(cleaned);
  const isAbs = isWin ? path.win32.isAbsolute(resolved) : path.isAbsolute(resolved);
  if (!isAbs) return '';
  const base = (isWin ? path.win32.basename(resolved) : path.basename(resolved)).toLowerCase();
  if (isWin && base !== 'qbittorrent.exe') return '';
  if (!isWin && !ALLOWED_EXECUTABLE_BASENAMES.has(base)) return '';
  return resolved;
}

function defaultExecFilePromise(cmd, args, options = {}, execFileFn = execFile) {
  return new Promise((resolve) => {
    try {
      execFileFn(
        cmd,
        args,
        {
          timeout: options.timeoutMs || 5000,
          windowsHide: true,
          maxBuffer: 2 * 1024 * 1024,
          env: options.env ? { ...(options.baseEnv || process.env), ...options.env } : options.baseEnv || process.env,
        },
        (err, stdout, stderr) => {
          resolve({
            ok: !err,
            code: err && typeof err.code === 'number' ? err.code : err ? -1 : 0,
            stdout: String(stdout || '').trim(),
            stderr: String(stderr || '').trim(),
            error: err || null,
          });
        }
      );
    } catch (err) {
      resolve({
        ok: false,
        code: -1,
        stdout: '',
        stderr: '',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  });
}

function parseQbitIniWebUi(iniContent) {
  const result = {
    configFound: false,
    webUiEnabled: false,
    address: '127.0.0.1',
    port: 8080,
    username: 'admin',
    isLoopbackOnly: true,
    localhostAuthDisabled: false,
    httpsEnabled: false,
    startMinimized: false,
    systrayEnabled: false,
  };
  if (typeof iniContent !== 'string' || !iniContent.trim()) {
    return result;
  }
  result.configFound = true;
  const lines = iniContent.split(/\r?\n/);
  let explicitAddress = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';') || line.startsWith('[')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    const normKey = key.replace(/\//g, '\\').toLowerCase();

    if (normKey === 'webui\\enabled') {
      result.webUiEnabled = val.toLowerCase() === 'true';
    } else if (normKey === 'webui\\address') {
      explicitAddress = val;
    } else if (normKey === 'webui\\port') {
      const p = parseInt(val, 10);
      if (Number.isFinite(p) && p > 0 && p <= 65535) {
        result.port = p;
      }
    } else if (normKey === 'webui\\username') {
      if (val) result.username = val;
    } else if (normKey === 'webui\\localhostauth') {
      // qBittorrent LocalHostAuth=false means localhost bypass is enabled
      result.localhostAuthDisabled = val.toLowerCase() === 'false';
    } else if (normKey === 'webui\\https\\enabled') {
      result.httpsEnabled = val.toLowerCase() === 'true';
    } else if (normKey === 'preferences\\general\\startminimized') {
      result.startMinimized = val.toLowerCase() === 'true';
    } else if (normKey === 'preferences\\general\\systray') {
      result.systrayEnabled = val.toLowerCase() === 'true';
    }
  }

  if (explicitAddress) {
    result.address = explicitAddress;
    const lowerAddr = explicitAddress.toLowerCase();
    result.isLoopbackOnly =
      lowerAddr === '127.0.0.1' || lowerAddr === 'localhost' || lowerAddr === '::1';
  } else {
    // qBittorrent defaults WebUI\Address to "*" (all interfaces) unless bound explicitly
    result.address = '*';
    result.isLoopbackOnly = false;
  }

  return result;
}

function resolveQbitIniCandidates(deps = {}) {
  const platform = deps.platform || process.platform;
  const env = deps.env || process.env;
  const homeDir = deps.homeDir || (deps.osModule || os).homedir();

  if (platform === 'win32') {
    const appData = env.APPDATA || path.win32.join(homeDir, 'AppData', 'Roaming');
    return [
      path.win32.join(appData, 'qBittorrent', 'qBittorrent.ini'),
      path.win32.join(appData, 'qBittorrent', 'qBittorrent.conf'),
    ];
  }

  if (platform === 'darwin') {
    return [
      path.join(homeDir, 'Library', 'Preferences', 'qBittorrent', 'qBittorrent.ini'),
      path.join(homeDir, 'Library', 'Preferences', 'qBittorrent', 'qBittorrent.conf'),
      path.join(homeDir, '.config', 'qBittorrent', 'qBittorrent.conf'),
    ];
  }

  const xdgConfig = env.XDG_CONFIG_HOME && String(env.XDG_CONFIG_HOME).trim()
    ? String(env.XDG_CONFIG_HOME).trim()
    : path.join(homeDir, '.config');

  const candidates = [
    path.join(xdgConfig, 'qBittorrent', 'qBittorrent.conf'),
    path.join(homeDir, '.config', 'qBittorrent', 'qBittorrent.conf'),
    path.join(homeDir, '.config', 'qBittorrent', 'qBittorrent.ini'),
    path.join(homeDir, '.var', 'app', 'org.qbittorrent.qBittorrent', 'config', 'qBittorrent', 'qBittorrent.conf'),
  ];
  return Array.from(new Set(candidates));
}

function inspectQbitWebUiConfig(deps = {}) {
  const fsModule = deps.fsModule || fs;
  const candidates = resolveQbitIniCandidates(deps);
  let iniPath = candidates[0] || null;
  for (const cand of candidates) {
    try {
      if (cand && fsModule.existsSync(cand)) {
        iniPath = cand;
        break;
      }
    } catch {
      // ignore access errors
    }
  }

  if (!iniPath || !fsModule.existsSync(iniPath)) {
    return {
      iniPath,
      configFound: false,
      webUiEnabled: false,
      address: '127.0.0.1',
      port: 8080,
      username: 'admin',
      isLoopbackOnly: true,
      localhostAuthDisabled: false,
      httpsEnabled: false,
      startMinimized: false,
      systrayEnabled: false,
    };
  }

  try {
    const content = fsModule.readFileSync(iniPath, 'utf8');
    return {
      iniPath,
      ...parseQbitIniWebUi(content),
    };
  } catch {
    return {
      iniPath,
      configFound: false,
      webUiEnabled: false,
      address: '127.0.0.1',
      port: 8080,
      username: 'admin',
      isLoopbackOnly: true,
      localhostAuthDisabled: false,
      httpsEnabled: false,
      startMinimized: false,
      systrayEnabled: false,
    };
  }
}

async function detectQbitProcessStatus(deps = {}) {
  const platform = deps.platform || process.platform;
  const execPromise =
    deps.execFilePromise ||
    ((cmd, args, opts) => defaultExecFilePromise(cmd, args, opts, deps.execFileFn || execFile));

  const processes = [];

  if (platform === 'win32') {
    const res = await execPromise(
      'tasklist.exe',
      ['/FI', 'IMAGENAME eq qbittorrent.exe', '/FO', 'CSV', '/NH'],
      { timeoutMs: 3500 }
    );
    if (res.ok && res.stdout) {
      for (const rawLine of res.stdout.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || !line.toLowerCase().includes('qbittorrent.exe')) continue;
        const pidMatch = line.match(/^"[^"]*qbittorrent\.exe"\s*,\s*"(\d+)"/i);
        const pid = pidMatch ? parseInt(pidMatch[1], 10) : null;
        processes.push({
          name: 'qbittorrent.exe',
          pid: Number.isFinite(pid) ? pid : null,
          kind: 'gui',
        });
      }
    }
    return {
      running: processes.length > 0,
      processName: processes[0]?.name || null,
      viaSystemdUser: false,
      processes,
    };
  }

  if (platform === 'darwin') {
    const [guiRes, noxRes] = await Promise.all([
      execPromise('pgrep', ['-ix', 'qbittorrent'], { timeoutMs: 2500 }),
      execPromise('pgrep', ['-x', 'qbittorrent-nox'], { timeoutMs: 2500 }),
    ]);
    if (guiRes.ok && guiRes.stdout) {
      for (const line of guiRes.stdout.split(/\r?\n/)) {
        const pid = parseInt(line.trim(), 10);
        if (Number.isFinite(pid)) {
          processes.push({ name: 'qbittorrent', pid, kind: 'gui' });
        }
      }
    }
    if (noxRes.ok && noxRes.stdout) {
      for (const line of noxRes.stdout.split(/\r?\n/)) {
        const pid = parseInt(line.trim(), 10);
        if (Number.isFinite(pid)) {
          processes.push({ name: 'qbittorrent-nox', pid, kind: 'nox' });
        }
      }
    }
    return {
      running: processes.length > 0,
      processName: processes[0]?.name || null,
      viaSystemdUser: false,
      processes,
    };
  }

  // Linux: detect qbittorrent, qbittorrent-nox, Flatpak, or user systemd unit
  const [guiRes, noxRes] = await Promise.all([
    execPromise('pgrep', ['-x', 'qbittorrent'], { timeoutMs: 2500 }),
    execPromise('pgrep', ['-x', 'qbittorrent-nox'], { timeoutMs: 2500 }),
  ]);

  if (guiRes.ok && guiRes.stdout) {
    for (const line of guiRes.stdout.split(/\r?\n/)) {
      const pid = parseInt(line.trim(), 10);
      if (Number.isFinite(pid)) {
        processes.push({ name: 'qbittorrent', pid, kind: 'gui' });
      }
    }
  }
  if (noxRes.ok && noxRes.stdout) {
    for (const line of noxRes.stdout.split(/\r?\n/)) {
      const pid = parseInt(line.trim(), 10);
      if (Number.isFinite(pid)) {
        processes.push({ name: 'qbittorrent-nox', pid, kind: 'nox' });
      }
    }
  }

  if (processes.length === 0) {
    const sysRes = await execPromise(
      'systemctl',
      ['--user', 'is-active', 'qbittorrent-nox'],
      { timeoutMs: 2000 }
    );
    if (sysRes.ok && String(sysRes.stdout || '').trim().toLowerCase() === 'active') {
      processes.push({ name: 'qbittorrent-nox', pid: null, kind: 'systemd' });
    }
  }

  return {
    running: processes.length > 0,
    processName: processes[0]?.name || null,
    viaSystemdUser: processes.some((p) => p.kind === 'systemd'),
    processes,
  };
}

async function detectInstalledQbitPaths(deps = {}) {
  const platform = deps.platform || process.platform;
  const fsModule = deps.fsModule || fs;
  const env = deps.env || process.env;
  const homeDir = deps.homeDir || (deps.osModule || os).homedir();
  const execPromise =
    deps.execFilePromise ||
    ((cmd, args, opts) => defaultExecFilePromise(cmd, args, opts, deps.execFileFn || execFile));

  if (platform === 'win32') {
    let executablePath = null;
    let registryVersion = null;

    const psDetectScript = [
      '$ErrorActionPreference = "SilentlyContinue";',
      '$roots = @(',
      '  "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",',
      '  "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",',
      '  "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"',
      ');',
      '$entry = Get-ItemProperty $roots | Where-Object { $_.DisplayName -like "*qBittorrent*" } | Select-Object -First 1 DisplayVersion, InstallLocation, UninstallString;',
      '$qbitReg = Get-ItemProperty "HKLM:\\SOFTWARE\\qBittorrent" | Select-Object -First 1 "(default)", InstallLocation;',
      '$magnetCmd = (Get-ItemProperty "HKCU:\\Software\\Classes\\magnet\\shell\\open\\command")."(default)";',
      '$classCmd = (Get-ItemProperty "HKLM:\\SOFTWARE\\Classes\\qBittorrent\\shell\\open\\command")."(default)";',
      '@{ entry = $entry; qbitReg = $qbitReg; magnetCmd = $magnetCmd; classCmd = $classCmd } | ConvertTo-Json -Depth 4 -Compress',
    ].join(' ');

    const regRes = await execPromise(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psDetectScript],
      { timeoutMs: 5000 }
    );

    if (regRes.ok && regRes.stdout) {
      try {
        const parsed = JSON.parse(regRes.stdout);
        if (parsed?.entry?.DisplayVersion) {
          registryVersion = normalizeVersionString(parsed.entry.DisplayVersion) || null;
        }
        const rawCandidates = [];
        if (parsed?.entry?.InstallLocation) {
          rawCandidates.push(path.win32.join(String(parsed.entry.InstallLocation), 'qbittorrent.exe'));
        }
        if (parsed?.qbitReg?.InstallLocation) {
          rawCandidates.push(path.win32.join(String(parsed.qbitReg.InstallLocation), 'qbittorrent.exe'));
        }
        for (const cmdVal of [parsed?.magnetCmd, parsed?.classCmd, parsed?.entry?.UninstallString]) {
          const str = String(cmdVal || '');
          const exeMatch =
            str.match(/"([^"]*qbittorrent\.exe)"/i) ||
            str.match(/([A-Za-z]:\\[^\r\n"]*qbittorrent\.exe)/i);
          if (exeMatch && exeMatch[1]) {
            rawCandidates.push(exeMatch[1]);
          } else if (str.toLowerCase().includes('qbittorrent') && str.toLowerCase().includes('uninst.exe')) {
            const uninstMatch =
              str.match(/"([^"]*uninst\.exe)"/i) || str.match(/([A-Za-z]:\\[^\r\n"]*uninst\.exe)/i);
            if (uninstMatch && uninstMatch[1]) {
              rawCandidates.push(path.win32.join(path.win32.dirname(uninstMatch[1]), 'qbittorrent.exe'));
            }
          }
        }
        for (const cand of rawCandidates) {
          if (cand && fsModule.existsSync(cand)) {
            executablePath = cand;
            break;
          }
        }
      } catch {
        // continue to fallback path checks
      }
    }

    if (!executablePath) {
      const localAppData = env.LOCALAPPDATA || '';
      const programFiles = env.ProgramFiles || 'C:\\Program Files';
      const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const fallbackPaths = [
        path.win32.join(programFiles, 'qBittorrent', 'qbittorrent.exe'),
        path.win32.join(programFilesX86, 'qBittorrent', 'qbittorrent.exe'),
        localAppData ? path.win32.join(localAppData, 'Programs', 'qBittorrent', 'qbittorrent.exe') : '',
      ].filter(Boolean);
      for (const cand of fallbackPaths) {
        if (fsModule.existsSync(cand)) {
          executablePath = cand;
          break;
        }
      }
    }

    let exeVersion = null;
    if (executablePath && fsModule.existsSync(executablePath)) {
      const verRes = await execPromise(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          '$v = (Get-Item -LiteralPath $env:QBIT_EXE_PATH).VersionInfo; @{ ProductVersion = $v.ProductVersion; FileVersion = $v.FileVersion } | ConvertTo-Json -Compress',
        ],
        { timeoutMs: 4500, env: { QBIT_EXE_PATH: executablePath } }
      );
      if (verRes.ok && verRes.stdout) {
        try {
          const parsedVer = JSON.parse(verRes.stdout);
          exeVersion =
            normalizeVersionString(parsedVer?.ProductVersion) ||
            normalizeVersionString(parsedVer?.FileVersion) ||
            null;
        } catch {
          // ignore
        }
      }
    }

    return {
      installed: Boolean(executablePath || registryVersion),
      executablePath,
      noxExecutablePath: null,
      installedVersion: exeVersion || registryVersion || null,
    };
  }

  if (platform === 'darwin') {
    const bundleCandidates = [
      '/Applications/qBittorrent.app',
      path.join(homeDir, 'Applications', 'qBittorrent.app'),
      '/Applications/qbittorrent.app',
    ];
    const cliCandidates = [
      '/opt/homebrew/bin/qbittorrent',
      '/opt/homebrew/bin/qbittorrent-nox',
      '/usr/local/bin/qbittorrent',
      '/usr/local/bin/qbittorrent-nox',
    ];
    let executablePath = null;
    let noxExecutablePath = null;

    for (const cand of bundleCandidates) {
      if (fsModule.existsSync(cand)) {
        executablePath = cand;
        break;
      }
    }
    for (const cand of cliCandidates) {
      if (fsModule.existsSync(cand)) {
        if (cand.endsWith('-nox') && !noxExecutablePath) {
          noxExecutablePath = cand;
        }
        if (!executablePath) {
          executablePath = cand;
        }
      }
    }

    if (!executablePath) {
      const whichRes = await execPromise('which', ['qbittorrent'], { timeoutMs: 2000 });
      if (whichRes.ok && whichRes.stdout && fsModule.existsSync(whichRes.stdout.split(/\r?\n/)[0])) {
        executablePath = whichRes.stdout.split(/\r?\n/)[0];
      }
    }

    let installedVersion = null;
    if (executablePath) {
      if (executablePath.toLowerCase().endsWith('.app')) {
        const plistPath = path.join(executablePath, 'Contents', 'Info.plist');
        if (fsModule.existsSync(plistPath)) {
          const plistOut = await execPromise(
            'plutil',
            ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', plistPath],
            { timeoutMs: 2500 }
          );
          if (plistOut.ok && plistOut.stdout) {
            installedVersion = normalizeVersionString(plistOut.stdout) || null;
          }
        }
      } else {
        const out = await execPromise(executablePath, ['--version'], { timeoutMs: 2500 });
        if (out.ok && out.stdout) {
          installedVersion = normalizeVersionString(out.stdout) || null;
        }
      }
    }

    return {
      installed: Boolean(executablePath || noxExecutablePath),
      executablePath: executablePath || noxExecutablePath,
      noxExecutablePath,
      installedVersion,
    };
  }

  // Linux: check standard binaries, qbittorrent-nox, PATH via which, and Flatpak
  const guiCandidates = [
    '/usr/bin/qbittorrent',
    '/usr/local/bin/qbittorrent',
    '/var/lib/flatpak/exports/bin/org.qbittorrent.qBittorrent',
    path.join(homeDir, '.local', 'share', 'flatpak', 'exports', 'bin', 'org.qbittorrent.qBittorrent'),
  ];
  const noxCandidates = [
    '/usr/bin/qbittorrent-nox',
    '/usr/local/bin/qbittorrent-nox',
  ];

  let guiPath = guiCandidates.find((p) => fsModule.existsSync(p)) || null;
  let noxPath = noxCandidates.find((p) => fsModule.existsSync(p)) || null;

  if (!guiPath) {
    const whichGui = await execPromise('which', ['qbittorrent'], { timeoutMs: 2000 });
    const cand = whichGui.ok ? whichGui.stdout.split(/\r?\n/)[0].trim() : '';
    if (cand && fsModule.existsSync(cand)) guiPath = cand;
  }
  if (!noxPath) {
    const whichNox = await execPromise('which', ['qbittorrent-nox'], { timeoutMs: 2000 });
    const cand = whichNox.ok ? whichNox.stdout.split(/\r?\n/)[0].trim() : '';
    if (cand && fsModule.existsSync(cand)) noxPath = cand;
  }

  // Prefer GUI unless headless (no DISPLAY/WAYLAND_DISPLAY) or only qbittorrent-nox is installed
  const hasDisplay = Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
  const preferredPath = (!hasDisplay && noxPath) ? noxPath : (guiPath || noxPath);

  let installedVersion = null;
  const verTarget = preferredPath || noxPath || guiPath;
  if (verTarget && !verTarget.includes('flatpak')) {
    const out = await execPromise(verTarget, ['--version'], { timeoutMs: 2500 });
    if (out.ok && out.stdout) {
      installedVersion = normalizeVersionString(out.stdout) || null;
    }
  }

  return {
    installed: Boolean(preferredPath),
    executablePath: preferredPath,
    noxExecutablePath: noxPath,
    installedVersion,
  };
}

function selectPreferredLaunchTarget(installInfo, deps = {}) {
  const platform = deps.platform || process.platform;
  const env = deps.env || process.env;
  const preferBackground = Boolean(deps.minimized);

  if (platform === 'linux') {
    const hasDisplay = Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
    // On headless Linux, or when qbittorrent-nox is installed alongside minimized preference and no GUI is strictly needed:
    if (!hasDisplay && installInfo.noxExecutablePath) {
      return installInfo.noxExecutablePath;
    }
    if (preferBackground && installInfo.noxExecutablePath && !installInfo.executablePath) {
      return installInfo.noxExecutablePath;
    }
  }

  return installInfo.executablePath || installInfo.noxExecutablePath || null;
}

async function launchQbitProcess(options = {}, deps = {}) {
  const platform = deps.platform || process.platform;
  const fsModule = deps.fsModule || fs;
  const env = deps.env || process.env;
  const spawnFn = deps.spawnFn || spawn;
  const execPromise =
    deps.execFilePromise ||
    ((cmd, args, opts) => defaultExecFilePromise(cmd, args, opts, deps.execFileFn || execFile));
  const shellModule = deps.shellModule || null;
  const minimized = options.minimized !== false;

  // 1. Pre-launch duplicate check
  const runningBefore = await detectQbitProcessStatus({ platform, execFilePromise: execPromise });
  if (runningBefore.running) {
    return {
      ok: true,
      launched: false,
      alreadyRunning: true,
      executablePath: options.executablePath || null,
      processName: runningBefore.processName,
      pid: runningBefore.processes[0]?.pid ?? null,
    };
  }

  const rawExe = options.executablePath;
  const safeExe = validateQbitExecutablePath(rawExe, platform);
  if (!safeExe || !fsModule.existsSync(safeExe)) {
    const targetOsLabel =
      platform === 'darwin' ? 'this Mac' : platform === 'linux' ? 'this Linux system' : 'this PC';
    return {
      ok: false,
      launched: false,
      alreadyRunning: false,
      executablePath: null,
      error: `qBittorrent executable was not found on ${targetOsLabel}.`,
    };
  }

  // 2. Platform-specific launch
  if (platform === 'win32') {
    if (minimized) {
      const psCmd =
        '$p = Start-Process -FilePath $env:QBIT_EXE_PATH -WindowStyle Minimized -PassThru; if ($p) { $p.Id }';
      const psRes = await execPromise(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psCmd],
        { timeoutMs: 6000, env: { QBIT_EXE_PATH: safeExe }, baseEnv: env }
      );
      if (psRes.ok) {
        const pidNum = parseInt(psRes.stdout, 10);
        return {
          ok: true,
          launched: true,
          alreadyRunning: false,
          minimized: true,
          executablePath: safeExe,
          processName: 'qbittorrent.exe',
          pid: Number.isFinite(pidNum) ? pidNum : null,
        };
      }
    }

    try {
      const child = spawnFn(safeExe, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: minimized,
        shell: false,
      });
      if (child && typeof child.unref === 'function') {
        child.unref();
      }
      return {
        ok: true,
        launched: true,
        alreadyRunning: false,
        minimized,
        executablePath: safeExe,
        processName: 'qbittorrent.exe',
        pid: child?.pid ?? null,
      };
    } catch (err) {
      if (shellModule && typeof shellModule.openPath === 'function') {
        const errMsg = await shellModule.openPath(safeExe);
        if (!errMsg) {
          return {
            ok: true,
            launched: true,
            alreadyRunning: false,
            minimized: false,
            executablePath: safeExe,
            processName: 'qbittorrent.exe',
            pid: null,
          };
        }
        return { ok: false, launched: false, alreadyRunning: false, error: errMsg };
      }
      return {
        ok: false,
        launched: false,
        alreadyRunning: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (platform === 'darwin') {
    const appBundleMatch = safeExe.match(/^(.*\.app)(?:\/Contents\/MacOS\/[^/]+)?$/i);
    const appBundlePath = appBundleMatch ? appBundleMatch[1] : null;
    if (appBundlePath) {
      const args = minimized ? ['-g', '-j', '-a', appBundlePath] : ['-a', appBundlePath];
      let openRes = await execPromise('open', args, { timeoutMs: 5000, baseEnv: env });
      if (!openRes.ok && minimized) {
        openRes = await execPromise('open', ['-g', '-a', appBundlePath], { timeoutMs: 5000, baseEnv: env });
      }
      if (!openRes.ok && shellModule && typeof shellModule.openPath === 'function') {
        const shellErr = await shellModule.openPath(appBundlePath);
        if (!shellErr) openRes = { ok: true, stdout: '', stderr: '' };
      }
      if (openRes.ok) {
        return {
          ok: true,
          launched: true,
          alreadyRunning: false,
          minimized,
          executablePath: safeExe,
          processName: 'qbittorrent',
          pid: null,
        };
      }
      return {
        ok: false,
        launched: false,
        alreadyRunning: false,
        error: openRes.stderr || 'Failed to launch qBittorrent.app',
      };
    }
  }

  // Linux & macOS CLI / Homebrew / qbittorrent-nox
  try {
    const child = spawnFn(safeExe, [], {
      detached: true,
      stdio: 'ignore',
      env,
      shell: false,
    });
    if (child && typeof child.unref === 'function') {
      child.unref();
    }
    return {
      ok: true,
      launched: true,
      alreadyRunning: false,
      minimized,
      executablePath: safeExe,
      processName: path.basename(safeExe),
      pid: child?.pid ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      launched: false,
      alreadyRunning: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

module.exports = {
  isLoopbackHost,
  normalizeVersionString,
  validateQbitExecutablePath,
  parseQbitIniWebUi,
  resolveQbitIniCandidates,
  inspectQbitWebUiConfig,
  detectQbitProcessStatus,
  detectInstalledQbitPaths,
  selectPreferredLaunchTarget,
  launchQbitProcess,
};
