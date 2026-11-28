'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function getFreeUnusedPort() {
  const srv = net.createServer();
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address();
  await new Promise((resolve) => srv.close(resolve));
  return port;
}

const qbitLifecycle = require('../electron/qbitLifecycle.cjs');
const { createDownloadManager, scrubSensitiveText } = require('../electron/downloadManager.cjs');

function makeTempDir(prefix = 'sa-qbit-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures on temp dir
  }
}

async function startMockQbitWebUiServer(options = {}) {
  const validUser = options.username ?? 'admin';
  const validPass = options.password ?? 'secretpass';
  const version = options.version ?? 'v5.0.3';
  const webApiVersion = options.webApiVersion ?? '2.11.2';
  const force403Ban = Boolean(options.force403Ban);
  const sidToken = 'MockSidToken123456';

  const calls = {
    loginAttempts: 0,
    apiCalls: [],
    addedMagnets: [],
    stoppedHashes: [],
    startedHashes: [],
    deletedHashes: [],
    shutdownCalled: 0,
  };

  let torrents = Array.isArray(options.initialTorrents) ? [...options.initialTorrents] : [];

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');

    calls.apiCalls.push(reqUrl.pathname);

    if (reqUrl.pathname === '/api/v2/auth/login') {
      calls.loginAttempts += 1;
      if (force403Ban) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('User IP is banned for too many failed login attempts');
        return;
      }
      const params = new URLSearchParams(rawBody);
      const u = params.get('username') || '';
      const p = params.get('password') || '';
      if (u === validUser && p === validPass) {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Set-Cookie': `SID=${sidToken}; HttpOnly; Path=/`,
        });
        res.end('Ok.');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Fails.');
      }
      return;
    }

    const cookieHeader = String(req.headers.cookie || '');
    const authed =
      Boolean(options.localhostBypass) || cookieHeader.includes(`SID=${sidToken}`);

    if (!authed) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    if (reqUrl.pathname === '/api/v2/app/version') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(version);
      return;
    }

    if (reqUrl.pathname === '/api/v2/app/webapiVersion') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(webApiVersion);
      return;
    }

    if (reqUrl.pathname === '/api/v2/torrents/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(torrents));
      return;
    }

    if (reqUrl.pathname === '/api/v2/torrents/add') {
      calls.addedMagnets.push(rawBody);
      torrents.push({
        hash: '0123456789abcdef0123456789abcdef01234567',
        name: 'Test Game Repack',
        size: 1024 * 1024 * 100,
        completed: 1024 * 1024 * 25,
        progress: 0.25,
        dlspeed: 5 * 1024 * 1024,
        upspeed: 128 * 1024,
        eta: 15,
        state: 'downloading',
        num_leechs: 4,
        num_incomplete: 12,
        num_seeds: 18,
        num_complete: 40,
        ratio: 0.12,
        save_path: '/downloads',
      });
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Ok.');
      return;
    }

    if (reqUrl.pathname === '/api/v2/torrents/stop' || reqUrl.pathname === '/api/v2/torrents/pause') {
      const params = new URLSearchParams(rawBody);
      calls.stoppedHashes.push({ endpoint: reqUrl.pathname, hashes: params.get('hashes') });
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('');
      return;
    }

    if (reqUrl.pathname === '/api/v2/torrents/start' || reqUrl.pathname === '/api/v2/torrents/resume') {
      const params = new URLSearchParams(rawBody);
      calls.startedHashes.push({ endpoint: reqUrl.pathname, hashes: params.get('hashes') });
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('');
      return;
    }

    if (reqUrl.pathname === '/api/v2/torrents/delete') {
      const params = new URLSearchParams(rawBody);
      calls.deletedHashes.push(params.get('hashes'));
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('');
      return;
    }

    if (reqUrl.pathname === '/api/v2/app/shutdown') {
      calls.shutdownCalled += 1;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('');
      setImmediate(() => {
        if (options.onShutdown) options.onShutdown();
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    port: address.port,
    calls,
    setTorrents(next) {
      torrents = next;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function createMockEnvAndFs({ iniContent = null, platform = 'linux', fakeBinaryPath = '/usr/bin/qbittorrent' } = {}) {
  const tempDir = makeTempDir();
  const fakeHome = path.join(tempDir, 'home');
  const fakeAppData = path.join(tempDir, 'AppData');
  const userDataDir = path.join(tempDir, 'userData');
  fs.mkdirSync(fakeHome, { recursive: true });
  fs.mkdirSync(fakeAppData, { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  if (iniContent !== null) {
    let iniTarget;
    if (platform === 'win32') {
      iniTarget = path.join(fakeAppData, 'qBittorrent', 'qBittorrent.ini');
    } else if (platform === 'darwin') {
      iniTarget = path.join(fakeHome, 'Library', 'Preferences', 'qBittorrent', 'qBittorrent.ini');
    } else {
      iniTarget = path.join(fakeHome, '.config', 'qBittorrent', 'qBittorrent.conf');
    }
    fs.mkdirSync(path.dirname(iniTarget), { recursive: true });
    fs.writeFileSync(iniTarget, iniContent, 'utf8');
  }

  const fakeFs = new Proxy(fs, {
    get(target, prop) {
      if (prop === 'existsSync') {
        return (targetPath) => {
          const clean = String(targetPath || '');
          if (fakeBinaryPath && clean === fakeBinaryPath) return true;
          if (clean.startsWith(tempDir)) return target.existsSync(clean);
          return false;
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  const env = {
    HOME: fakeHome,
    APPDATA: fakeAppData,
    LOCALAPPDATA: path.join(tempDir, 'LocalAppData'),
    XDG_CONFIG_HOME: path.join(fakeHome, '.config'),
    ProgramFiles: path.join(tempDir, 'ProgramFiles'),
    'ProgramFiles(x86)': path.join(tempDir, 'ProgramFilesX86'),
  };

  return {
    tempDir,
    userDataDir,
    fakeFs,
    fakeOs: {
      homedir: () => fakeHome,
      tmpdir: () => tempDir,
    },
    env,
    cleanup() {
      cleanupTempDir(tempDir);
    },
  };
}

test('1. qBittorrent already running -> reuses existing process, connects via WebUI API v2, zero duplicate spawns', async () => {
  const srv = await startMockQbitWebUiServer({ username: 'admin', password: 'secret' });
  const envFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: '/usr/bin/qbittorrent',
    iniContent: `[Preferences]\nWebUI\\Enabled=true\nWebUI\\Port=${srv.port}\n`,
  });

  let spawnCount = 0;
  let settingsStore = { downloadFolder: envFixture.tempDir };

  try {
    const dm = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => settingsStore,
      writeSettings: (next) => { settingsStore = next; },
      backoffDelaysMs: [20, 40],
      execFileFn: (file, args, _opts, cb) => {
        if (file === 'pgrep') {
          return cb(null, '4242\n', '');
        }
        return cb(new Error('not found'), '', '');
      },
      spawnFn: () => {
        spawnCount += 1;
        return { unref() {} };
      },
    });

    await dm.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: srv.port,
      username: 'admin',
      password: 'secret',
    });

    const snap = dm.getSnapshot();
    assert.equal(snap.torrentConnected, true);
    assert.equal(snap.torrentConnectionState, 'connected');
    assert.equal(snap.torrentVersion, 'v5.0.3');
    assert.equal(snap.torrentWebApiVersion, '2.11.2');
    assert.equal(spawnCount, 0, 'Must not spawn duplicate process when qBittorrent is already running');
    assert.ok(srv.calls.apiCalls.includes('/api/v2/app/version'));
    assert.ok(srv.calls.apiCalls.includes('/api/v2/app/webapiVersion'));
    assert.ok(srv.calls.apiCalls.includes('/api/v2/torrents/info'));

    dm.shutdown();
  } finally {
    await srv.close();
    envFixture.cleanup();
  }
});

test('2 & 7. qBittorrent installed but stopped + slow WebUI startup -> auto-launches minimized, waits with backoff, authenticates & connects', async () => {
  let serverReady = false;
  const srv = await startMockQbitWebUiServer({ username: 'admin', password: 'secret' });
  const envFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: '/usr/bin/qbittorrent-nox',
    iniContent: `[Preferences]\nWebUI\\Enabled=true\nWebUI\\Port=${srv.port}\n`,
  });

  let processRunning = false;
  let spawnCalls = [];

  try {
    const dm = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => ({ downloadFolder: envFixture.tempDir }),
      backoffDelaysMs: [40, 60, 80, 120],
      maxStartupWaitMs: 3000,
      netTcpConnectFn: async (_host, port) => serverReady && port === srv.port,
      execFileFn: (file, args, _opts, cb) => {
        if (file === 'pgrep' && processRunning) {
          return cb(null, '9001\n', '');
        }
        return cb(new Error('not running'), '', '');
      },
      spawnFn: (exe, args, opts) => {
        spawnCalls.push({ exe, args, opts });
        processRunning = true;
        // Simulate slow WebUI startup (becomes ready after ~90ms, spanning initial refused backoff attempts)
        setTimeout(() => {
          serverReady = true;
        }, 90);
        return { unref() {} };
      },
    });

    await dm.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: srv.port,
      username: 'admin',
      password: 'secret',
    });

    const snap = dm.getSnapshot();
    assert.equal(spawnCalls.length, 1, 'Should auto-launch qBittorrent once');
    assert.equal(spawnCalls[0].exe, '/usr/bin/qbittorrent-nox');
    assert.equal(spawnCalls[0].opts.detached, true);
    assert.equal(spawnCalls[0].opts.shell, false);
    assert.equal(snap.torrentConnected, true);
    assert.equal(snap.torrentConnectionState, 'connected');
    assert.equal(snap.torrentConnectionDetail.managedByApp, true);

    dm.shutdown();
  } finally {
    await srv.close();
    envFixture.cleanup();
  }
});

test('3. qBittorrent not installed -> reports not_installed cleanly with zero spawns', async () => {
  const envFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: null,
  });

  let spawnCount = 0;
  try {
    const dm = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => ({ downloadFolder: envFixture.tempDir }),
      netTcpConnectFn: async () => false,
      execFileFn: (_file, _args, _opts, cb) => cb(new Error('missing'), '', ''),
      spawnFn: () => {
        spawnCount += 1;
        return { unref() {} };
      },
    });

    await dm.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: 18080,
      username: 'admin',
      password: 'pw',
    });

    const snap = dm.getSnapshot();
    assert.equal(snap.torrentConnected, false);
    assert.equal(snap.torrentConnectionState, 'not_installed');
    assert.equal(snap.torrentConnectionDetail.reasonCode, 'not_installed');
    assert.equal(spawnCount, 0);

    dm.shutdown();
  } finally {
    envFixture.cleanup();
  }
});

test('4. WebUI disabled in qBittorrent configuration -> reports webui_disabled and stops retrying', async () => {
  const envFixture = createMockEnvAndFs({
    platform: 'win32',
    fakeBinaryPath: null,
    iniContent: '[Preferences]\nWebUI\\Enabled=false\nWebUI\\Port=8080\n',
  });
  const winExePath = 'C:\\Program Files\\qBittorrent\\qbittorrent.exe';
  const winEnv = {
    ...envFixture.env,
    APPDATA: path.join(envFixture.tempDir, 'AppData'),
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
  };
  const winTempPrefix = envFixture.tempDir.replace(/\//g, '\\');
  const mapWinTempPath = (p) => {
    const raw = String(p || '');
    return raw.startsWith(winTempPrefix) ? raw.replace(/\\/g, '/') : raw;
  };
  const winMockFs = new Proxy(fs, {
    get(target, prop) {
      if (prop === 'existsSync') {
        return (p) => String(p) === winExePath || target.existsSync(mapWinTempPath(p));
      }
      if (prop === 'readFileSync') {
        return (p, ...rest) => target.readFileSync(mapWinTempPath(p), ...rest);
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  let spawnCount = 0;
  try {
    const dm = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'win32',
      fsModule: winMockFs,
      osModule: envFixture.fakeOs,
      envOverride: winEnv,
      readSettings: () => ({ downloadFolder: envFixture.tempDir }),
      netTcpConnectFn: async () => false,
      execFileFn: (file, _args, _opts, cb) => {
        if (file === 'tasklist.exe') {
          return cb(null, 'INFO: No tasks are running which match the specified criteria.\r\n', '');
        }
        return cb(new Error('nope'), '', '');
      },
      spawnFn: () => {
        spawnCount += 1;
        return { unref() {} };
      },
    });

    await dm.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: 8080,
      username: 'admin',
      password: 'pw',
    });

    const snap = dm.getSnapshot();
    assert.equal(snap.torrentConnected, false);
    assert.equal(snap.torrentConnectionState, 'webui_disabled');
    assert.equal(snap.torrentConnectionDetail.reasonCode, 'webui_disabled');
    assert.equal(snap.torrentConnectionDetail.webUiEnabledInConfig, false);
    assert.equal(spawnCount, 0, 'Should not spam launch when WebUI is explicitly disabled in config');

    dm.shutdown();
  } finally {
    envFixture.cleanup();
  }
});

test('5. Incorrect WebUI credentials -> reports auth_required immediately without brute-forcing login', async () => {
  const srv = await startMockQbitWebUiServer({ username: 'admin', password: 'right-password' });
  const envFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: '/usr/bin/qbittorrent',
    iniContent: `[Preferences]\nWebUI\\Enabled=true\nWebUI\\Port=${srv.port}\n`,
  });

  try {
    const dm = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => ({ downloadFolder: envFixture.tempDir }),
      backoffDelaysMs: [20, 40, 80],
      execFileFn: (file, _args, _opts, cb) => {
        if (file === 'pgrep') return cb(null, '1234\n', '');
        return cb(new Error('nope'), '', '');
      },
    });

    await dm.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: srv.port,
      username: 'admin',
      password: 'wrong-password',
    });

    const snap = dm.getSnapshot();
    assert.equal(snap.torrentConnected, false);
    assert.equal(snap.torrentConnectionState, 'auth_required');
    assert.equal(snap.torrentConnectionDetail.reasonCode, 'auth_failed');
    assert.equal(srv.calls.loginAttempts, 1, 'Must stop immediately on failed credentials so localhost is not 403-banned');

    dm.shutdown();
  } finally {
    await srv.close();
    envFixture.cleanup();
  }
});

test('6. Incorrect WebUI port -> detects config/open port mismatch and switches cleanly via applyDetectedTorrentPort', async () => {
  const srv = await startMockQbitWebUiServer({ username: 'admin', password: 'secret' });
  const envFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: '/usr/bin/qbittorrent',
    iniContent: `[Preferences]\nWebUI\\Enabled=true\nWebUI\\Port=${srv.port}\n`,
  });

  try {
    const wrongPort = await getFreeUnusedPort();
    const dm = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => ({ downloadFolder: envFixture.tempDir }),
      backoffDelaysMs: [15],
      maxStartupWaitMs: 60,
      execFileFn: (file, _args, _opts, cb) => {
        if (file === 'pgrep') return cb(null, '5555\n', '');
        return cb(new Error('nope'), '', '');
      },
    });

    await dm.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: wrongPort,
      username: 'admin',
      password: 'secret',
    });

    let snap = dm.getSnapshot();
    assert.equal(snap.torrentConnected, false);
    assert.equal(snap.torrentConnectionState, 'failed');
    assert.equal(snap.torrentConnectionDetail.reasonCode, 'port_mismatch');
    assert.equal(snap.torrentConnectionDetail.detectedConfigPort, srv.port);

    // One-click fix applies detected port and connects
    snap = await dm.applyDetectedTorrentPort(snap.torrentConnectionDetail.detectedConfigPort);
    assert.equal(snap.torrentConnected, true);
    assert.equal(snap.torrentConnectionState, 'connected');
    assert.equal(snap.torrentConfig.port, srv.port);

    dm.shutdown();
  } finally {
    await srv.close();
    envFixture.cleanup();
  }
});

test('8. Failure after max timeout -> bounded backoff terminates cleanly with failed state and no infinite loop', async () => {
  const envFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: '/usr/bin/qbittorrent',
    iniContent: '[Preferences]\nWebUI\\Enabled=true\nWebUI\\Port=19191\n',
  });

  let probeCount = 0;
  try {
    const dm = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => ({ downloadFolder: envFixture.tempDir }),
      backoffDelaysMs: [15, 25],
      maxStartupWaitMs: 120,
      netTcpConnectFn: async () => {
        probeCount += 1;
        return false;
      },
      execFileFn: (file, _args, _opts, cb) => {
        if (file === 'pgrep') return cb(null, '7777\n', '');
        return cb(new Error('nope'), '', '');
      },
    });

    const result = await dm.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: 19191,
      username: 'admin',
      password: 'secret',
    });

    assert.equal(result.torrentConnected, false);
    assert.equal(result.torrentConnectionState, 'failed');
    assert.equal(result.torrentConnectionDetail.reasonCode, 'timeout');
    assert.ok(probeCount >= 2 && probeCount <= 8, 'Retries must stay strictly bounded');

    dm.shutdown();
  } finally {
    envFixture.cleanup();
  }
});

test('9. Concurrent ensureQbitConnected calls -> single-flight deduplication prevents duplicate qBittorrent launches', async () => {
  const srv = await startMockQbitWebUiServer({ username: 'admin', password: 'secret' });
  const envFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: '/usr/bin/qbittorrent',
    iniContent: `[Preferences]\nWebUI\\Enabled=true\nWebUI\\Port=${srv.port}\n`,
  });

  let procRunning = false;
  let spawnCount = 0;
  let webReady = false;

  try {
    const dm = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => ({ downloadFolder: envFixture.tempDir }),
      backoffDelaysMs: [35, 60],
      netTcpConnectFn: async (_h, port) => webReady && port === srv.port,
      execFileFn: (file, _args, _opts, cb) => {
        if (file === 'pgrep' && procRunning) return cb(null, '8888\n', '');
        return cb(new Error('not running'), '', '');
      },
      spawnFn: () => {
        spawnCount += 1;
        procRunning = true;
        setTimeout(() => {
          webReady = true;
        }, 40);
        return { unref() {} };
      },
    });

    // Save config disabled first, then manually flip & launch 5 concurrent recovery attempts
    await dm.saveTorrentConfig({
      enabled: false,
      host: '127.0.0.1',
      port: srv.port,
      username: 'admin',
      password: 'secret',
    });

    const results = await Promise.all([
      dm.reconnectTorrent(),
      dm.reconnectTorrent(),
      dm.reconnectTorrent(),
      dm.startQbitInBackground(),
      dm.ensureQbitConnected({ trigger: 'manual', allowAutoStart: true, ignoreUserQuit: true }),
    ]);

    assert.equal(spawnCount, 1, 'Concurrent startup calls must never spawn duplicate qBittorrent processes');
    for (const r of results) {
      assert.equal(r.torrentConnected || r.ok, true);
    }

    dm.shutdown();
  } finally {
    await srv.close();
    envFixture.cleanup();
  }
});

test('10. Background persistence on close + active download protection + explicit quitQbitClient', async () => {
  let procRunning = false;
  const srv = await startMockQbitWebUiServer({
    username: 'admin',
    password: 'secret',
    onShutdown: () => {
      procRunning = false;
    },
  });
  const envFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: '/usr/bin/qbittorrent',
    iniContent: `[Preferences]\nWebUI\\Enabled=true\nWebUI\\Port=${srv.port}\n`,
  });

  try {
    // Case A: Auto-launched by SecretArea, keepQbitRunningOnClose = true (default) -> shutdown() keeps qBit running
    const dm1 = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => ({ downloadFolder: envFixture.tempDir }),
      backoffDelaysMs: [20],
      execFileFn: (file, _args, _opts, cb) => {
        if (file === 'pgrep' && procRunning) return cb(null, '3210\n', '');
        return cb(new Error('not running'), '', '');
      },
      spawnFn: () => {
        procRunning = true;
        return { unref() {} };
      },
    });

    await dm1.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: srv.port,
      username: 'admin',
      password: 'secret',
    });
    assert.equal(dm1.getSnapshot().torrentConnected, true);
    dm1.shutdown();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(srv.calls.shutdownCalled, 0, 'Must NOT kill qBittorrent when keepQbitRunningOnClose is true');

    // Case B: keepQbitRunningOnClose = false, but an active torrent exists -> MUST NOT kill qBittorrent
    const dm2 = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => ({ downloadFolder: envFixture.tempDir }),
      backoffDelaysMs: [20],
      execFileFn: (file, _args, _opts, cb) => {
        if (file === 'pgrep' && procRunning) return cb(null, '3210\n', '');
        return cb(new Error('not running'), '', '');
      },
      spawnFn: () => {
        procRunning = true;
        return { unref() {} };
      },
    });

    procRunning = false; // pretend launched fresh by SecretArea
    await dm2.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: srv.port,
      username: 'admin',
      password: 'secret',
      lifecyclePrefs: { keepQbitRunningOnClose: false },
    });

    await dm2.startDownload({
      url: 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Test%20Game%20Repack',
      title: 'Test Game Repack',
    });
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(srv.calls.addedMagnets.length >= 1, 'Magnet must be submitted to WebUI API v2');

    dm2.shutdown();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(srv.calls.shutdownCalled, 0, 'Must NOT terminate active torrent downloads on SecretArea close');

    // Case C: Explicit quitQbitClient() shuts down qBit and prevents auto-restart
    const quitRes = await dm2.quitQbitClient();
    assert.equal(srv.calls.shutdownCalled, 1);
    assert.equal(quitRes.snapshot.torrentConnected, false);
    assert.equal(quitRes.snapshot.torrentConnectionDetail.reasonCode, 'user_stopped');
  } finally {
    await srv.close();
    envFixture.cleanup();
  }
});

test('11. Platform-specific detection & background launch: Windows, Linux (GUI + nox + systemd), and macOS (Intel & Apple Silicon)', async () => {
  // --- WINDOWS ---
  const winFixture = createMockEnvAndFs({ platform: 'win32', fakeBinaryPath: null });
  const winExe = 'C:\\Program Files\\qBittorrent\\qbittorrent.exe';
  const winEnv = {
    ...winFixture.env,
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
  };
  const winFs = new Proxy(fs, {
    get(target, prop) {
      if (prop === 'existsSync') {
        return (p) => String(p) === winExe;
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  const winDetected = await qbitLifecycle.detectInstalledQbitPaths({
    platform: 'win32',
    fsModule: winFs,
    osModule: winFixture.fakeOs,
    env: winEnv,
    execFilePromise: async () => ({ ok: false, stdout: '', stderr: '' }),
  });
  assert.equal(winDetected.installed, true);
  assert.equal(winDetected.executablePath, winExe);

  const winExecCalls = [];
  const winLaunch = await qbitLifecycle.launchQbitProcess(
    { executablePath: winExe, minimized: true },
    {
      platform: 'win32',
      fsModule: winFs,
      env: winEnv,
      execFilePromise: async (file, args) => {
        winExecCalls.push({ file, args });
        if (file === 'tasklist.exe') {
          return { ok: true, stdout: 'INFO: No tasks running.\r\n', stderr: '' };
        }
        return { ok: true, stdout: '', stderr: '' };
      },
      spawnFn: () => ({ unref() {} }),
    }
  );
  assert.equal(winLaunch.ok, true);
  assert.equal(winLaunch.launched, true);
  assert.ok(
    winExecCalls.some((c) => c.file === 'powershell.exe' && c.args.join(' ').includes('Minimized')),
    'Windows minimized launch should invoke Start-Process -WindowStyle Minimized'
  );
  winFixture.cleanup();

  // --- LINUX (qbittorrent-nox + systemd user check + GUI) ---
  const linuxFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: '/usr/bin/qbittorrent-nox',
  });
  const linuxDetected = await qbitLifecycle.detectInstalledQbitPaths({
    platform: 'linux',
    fsModule: linuxFixture.fakeFs,
    osModule: linuxFixture.fakeOs,
    env: linuxFixture.env,
    execFilePromise: async (file, args) => {
      if (file === 'which' && args[0] === 'qbittorrent-nox') {
        return { ok: true, stdout: '/usr/bin/qbittorrent-nox\n', stderr: '' };
      }
      return { ok: false, stdout: '', stderr: '' };
    },
  });
  assert.equal(linuxDetected.installed, true);
  assert.equal(linuxDetected.noxExecutablePath, '/usr/bin/qbittorrent-nox');

  const linuxProcStatus = await qbitLifecycle.detectQbitProcessStatus({
    platform: 'linux',
    execFilePromise: async (file, args) => {
      if (file === 'systemctl' && args.includes('qbittorrent-nox')) {
        return { ok: true, stdout: 'active\n', stderr: '' };
      }
      return { ok: false, stdout: '', stderr: '' };
    },
  });
  assert.equal(linuxProcStatus.running, true);
  assert.equal(linuxProcStatus.viaSystemdUser, true);
  linuxFixture.cleanup();

  // --- MACOS (Apple Silicon Homebrew + Intel /usr/local + .app bundle) ---
  const macFixture = createMockEnvAndFs({
    platform: 'darwin',
    fakeBinaryPath: '/opt/homebrew/bin/qbittorrent',
  });
  const macDetected = await qbitLifecycle.detectInstalledQbitPaths({
    platform: 'darwin',
    fsModule: macFixture.fakeFs,
    osModule: macFixture.fakeOs,
    env: macFixture.env,
    execFilePromise: async () => ({ ok: false, stdout: '', stderr: '' }),
  });
  assert.equal(macDetected.installed, true);
  assert.equal(macDetected.executablePath, '/opt/homebrew/bin/qbittorrent');

  const macExecCalls = [];
  const macAppFixture = createMockEnvAndFs({
    platform: 'darwin',
    fakeBinaryPath: '/Applications/qBittorrent.app/Contents/MacOS/qbittorrent',
  });
  // Allow /Applications/qBittorrent.app directory check cleanly
  const origExists = macAppFixture.fakeFs.existsSync;
  const macFsWithApp = new Proxy(macAppFixture.fakeFs, {
    get(target, prop) {
      if (prop === 'existsSync') {
        return (p) =>
          p === '/Applications/qBittorrent.app' || origExists(p);
      }
      return target[prop];
    },
  });
  await qbitLifecycle.launchQbitProcess(
    { executablePath: '/Applications/qBittorrent.app/Contents/MacOS/qbittorrent', minimized: true },
    {
      platform: 'darwin',
      fsModule: macFsWithApp,
      env: macAppFixture.env,
      execFilePromise: async (file, args) => {
        macExecCalls.push({ file, args });
        if (file === 'pgrep') return { ok: false, stdout: '', stderr: '' };
        return { ok: true, stdout: '', stderr: '' };
      },
      spawnFn: () => ({ unref() {} }),
    }
  );
  assert.ok(
    macExecCalls.some((c) => c.file === 'open' && c.args.includes('-g') && c.args.includes('-j')),
    'macOS background launch should use open -g -j -a'
  );
  macFixture.cleanup();
  macAppFixture.cleanup();
});

test('12. Startup & lifecycle preferences persistence, autoStartQbit=false enforcement, security & WebUI API v2 regressions', async () => {
  const srv = await startMockQbitWebUiServer({
    username: 'admin',
    password: 'secret',
    version: 'v4.6.7',
    webApiVersion: '2.9.3',
  });
  const envFixture = createMockEnvAndFs({
    platform: 'linux',
    fakeBinaryPath: '/usr/bin/qbittorrent',
    iniContent: `[Preferences]\nWebUI\\Enabled=true\nWebUI\\Port=${srv.port}\n`,
  });

  let osAutoLaunchWrites = 0;
  let launcherSettings = { downloadFolder: envFixture.tempDir, startWithComputer: false };
  let spawnCount = 0;

  try {
    const dm1 = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => launcherSettings,
      writeSettings: (next) => {
        if (next.startWithComputer !== launcherSettings.startWithComputer) {
          osAutoLaunchWrites += 1;
        }
        launcherSettings = next;
      },
      backoffDelaysMs: [20],
      execFileFn: (file, _args, _opts, cb) => cb(new Error('stopped'), '', ''),
      spawnFn: () => {
        spawnCount += 1;
        return { unref() {} };
      },
    });

    await dm1.saveTorrentConfig({
      enabled: true,
      host: '127.0.0.1',
      port: srv.port,
      username: 'admin',
      password: 'secret',
    });

    await dm1.saveQbitLifecyclePrefs({
      autoStartQbit: false,
      keepQbitRunningOnClose: true,
      launchQbitMinimized: false,
      autoReconnect: false,
    });
    dm1.shutdown();

    assert.equal(osAutoLaunchWrites, 0, 'Must NEVER modify OS startup consent when saving qBit lifecycle prefs');

    // Second session loads persisted lifecycle prefs and obeys autoStartQbit=false
    spawnCount = 0;
    const dm2 = createDownloadManager({
      userDataPath: envFixture.userDataDir,
      platformOverride: 'linux',
      fsModule: envFixture.fakeFs,
      osModule: envFixture.fakeOs,
      envOverride: envFixture.env,
      readSettings: () => launcherSettings,
      backoffDelaysMs: [20],
      netTcpConnectFn: async () => false,
      execFileFn: (_file, _args, _opts, cb) => cb(new Error('stopped'), '', ''),
      spawnFn: () => {
        spawnCount += 1;
        return { unref() {} };
      },
    });
    dm2.init();
    await new Promise((r) => setTimeout(r, 80));

    const snap2 = dm2.getSnapshot();
    assert.deepEqual(snap2.qbitLifecyclePrefs, {
      autoStartQbit: false,
      keepQbitRunningOnClose: true,
      launchQbitMinimized: false,
      autoReconnect: false,
    });
    assert.equal(spawnCount, 0, 'autoStartQbit=false must prevent automatic launch on SecretArea startup');

    // Loopback security enforcement: non-loopback host is rejected/sanitized
    const badHostSnap = await dm2.saveTorrentConfig({
      enabled: true,
      host: '192.168.1.50',
      port: srv.port,
    });
    assert.equal(badHostSnap.torrentConfig.host, '127.0.0.1', 'Non-loopback host must never be persisted');

    // Sensitive text scrubbing preserves security (no SID or credentials leaked)
    const scrubbed = scrubSensitiveText('Cookie SID=SuperSecretSid; Bearer tok12345; https://user:pass@127.0.0.1:8080');
    assert.ok(!scrubbed.includes('SuperSecretSid'));
    assert.ok(!scrubbed.includes('tok12345'));
    assert.ok(!scrubbed.includes('user:pass'));

    dm2.shutdown();
  } finally {
    await srv.close();
    envFixture.cleanup();
  }
});
