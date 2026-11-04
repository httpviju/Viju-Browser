'use strict';

const {
  app,
  BrowserWindow,
  WebContentsView,
  session,
  ipcMain,
  dialog
} = require('electron');
const path = require('path');
const fs = require('fs');
const {
  createDefaultFingerprintSpoofConfig,
  createDefaultRandomUASwitcherConfig,
  isDomainBlacklistedForUA,
  generateNextUserAgentProfile,
  validateFingerprintSpoofConfig,
  resolveAndValidateNavigationInput,
  validateRefreshInterval,
  validateUserAgentPayload,
  validateFingerprintProfile,
  validateWebRTCConfig,
  validateClearDataOptions,
  USER_AGENT_PRESETS
} = require('./ipc-validators');

const PARTITION_NAME = 'persist:viju-browser';
const CHROME_TOP_HEIGHT = 126;
const SIDE_PANEL_WIDTH = 420;

let mainWindow = null;
let browserSession = null;
let isSidePanelOpen = false;

const stateFilePath = () => path.join(app.getPath('userData'), 'viju-state.json');

const appState = {
  tabs: new Map(),
  activeTabId: null,
  closedTabs: [],
  bookmarks: [
    { id: 'bm-1', title: 'Chromium Security', url: 'https://www.chromium.org/Home/chromium-security/', createdAt: new Date().toISOString() },
    { id: 'bm-2', title: 'Electron Security Docs', url: 'https://www.electronjs.org/docs/latest/tutorial/security', createdAt: new Date().toISOString() }
  ],
  history: [],
  downloads: [],
  formData: [],
  passwords: [],
  webrtc: validateWebRTCConfig({
    enabled: true,
    policy: 'default_public_interface_only',
    shieldEnabled: true,
    blockLocalIp: true,
    blockPublicIp: false,
    blockUdp: false,
    forceProxy: false,
    leakDetectionEnabled: true
  }),
  fingerprintProfile: {
    name: 'Windows 11 Standard (1920x1080)',
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    language: 'en-US',
    timezone: 'America/New_York',
    platform: 'Win32'
  },
  fingerprintSpoofConfig: createDefaultFingerprintSpoofConfig(),
  uaSwitcherConfig: createDefaultRandomUASwitcherConfig(),
  protectionLogs: []
};

function isOriginWhitelistedInMain(rawUrl, controlKey) {
  const cfg = appState.fingerprintSpoofConfig;
  if (!cfg || !cfg.controls || !cfg.controls.whitelist) return false;
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    for (const rule of cfg.whitelistRules || []) {
      if (!rule.enabled || !rule.domain) continue;
      const d = rule.domain.toLowerCase();
      if (host === d || host.endsWith('.' + d)) {
        if (!controlKey || rule.bypassControls === 'all') return true;
        if (Array.isArray(rule.bypassControls) && rule.bypassControls.includes(controlKey)) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

function recordProtectionLog(control, level, origin, apiSurface, detail) {
  if (!appState.fingerprintSpoofConfig.controls.logs) return;
  const nowMs = Date.now();
  appState.protectionLogs.unshift({
    id: 'fplog-' + nowMs + '-' + Math.random().toString(36).slice(2, 6),
    timestamp: new Date(nowMs).toLocaleTimeString(),
    timestampMs: nowMs,
    control,
    level,
    origin: origin || 'browser-session',
    apiSurface,
    detail
  });
  if (appState.protectionLogs.length > 250) {
    appState.protectionLogs.length = 250;
  }
}

function loadPersistedState() {
  try {
    const file = stateFilePath();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(parsed.bookmarks)) appState.bookmarks = parsed.bookmarks;
      if (Array.isArray(parsed.history)) appState.history = parsed.history.slice(0, 500);
      if (Array.isArray(parsed.formData)) appState.formData = parsed.formData.slice(0, 500);
      if (Array.isArray(parsed.passwords)) appState.passwords = parsed.passwords.slice(0, 200);
      if (parsed.webrtc) appState.webrtc = validateWebRTCConfig(parsed.webrtc);
      if (parsed.fingerprintProfile) {
        appState.fingerprintProfile = validateFingerprintProfile(parsed.fingerprintProfile);
      }
      if (parsed.fingerprintSpoofConfig) {
        appState.fingerprintSpoofConfig = validateFingerprintSpoofConfig(parsed.fingerprintSpoofConfig);
      }
      if (parsed.uaSwitcherConfig && typeof parsed.uaSwitcherConfig === 'object') {
        appState.uaSwitcherConfig = Object.assign(
          createDefaultRandomUASwitcherConfig(),
          parsed.uaSwitcherConfig
        );
      }
      if (
        appState.uaSwitcherConfig.enabledGlobally &&
        appState.uaSwitcherConfig.rotateOnStartup &&
        !appState.uaSwitcherConfig.paused
      ) {
        const rotated = generateNextUserAgentProfile(appState.uaSwitcherConfig);
        if (rotated) {
          appState.uaSwitcherConfig.activeGeneratedProfile = rotated;
          appState.uaSwitcherConfig.rotationCount = (appState.uaSwitcherConfig.rotationCount || 0) + 1;
        }
      }
      if (Array.isArray(parsed.protectionLogs)) {
        appState.protectionLogs = parsed.protectionLogs.slice(0, 200);
      }
    }
  } catch (err) {
    console.error('[Viju Main] Failed to load persisted state:', err.message);
  }
}

function savePersistedState() {
  try {
    const payload = {
      bookmarks: appState.bookmarks,
      history: appState.history.slice(0, 500),
      formData: appState.formData.slice(0, 500),
      passwords: appState.passwords.slice(0, 200),
      webrtc: appState.webrtc,
      fingerprintProfile: appState.fingerprintProfile,
      fingerprintSpoofConfig: appState.fingerprintSpoofConfig,
      uaSwitcherConfig: appState.uaSwitcherConfig,
      protectionLogs: appState.protectionLogs.slice(0, 200)
    };
    fs.writeFileSync(stateFilePath(), JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('[Viju Main] Failed to save persisted state:', err.message);
  }
}

function broadcastStateToUI() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const serializedTabs = [];
  for (const [id, tab] of appState.tabs.entries()) {
    serializedTabs.push({
      id,
      title: tab.title || 'New Tab',
      url: tab.url || 'https://www.google.com',
      isLoading: tab.view.webContents.isLoading(),
      canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
      canGoForward: tab.view.webContents.navigationHistory.canGoForward(),
      userAgent: tab.userAgent,
      autoRefresh: {
        intervalSeconds: tab.autoRefresh.intervalSeconds,
        status: tab.autoRefresh.status,
        remainingSeconds: tab.autoRefresh.remainingSeconds,
        refreshCount: tab.autoRefresh.refreshCount
      }
    });
  }

  mainWindow.webContents.send('viju:state-updated', {
    tabs: serializedTabs,
    activeTabId: appState.activeTabId,
    closedTabsCount: appState.closedTabs.length,
    bookmarks: appState.bookmarks,
    history: appState.history.slice(0, 100),
    downloads: appState.downloads,
    formDataCount: appState.formData.length,
    passwordsCount: appState.passwords.length,
    webrtc: appState.webrtc,
    fingerprintProfile: appState.fingerprintProfile,
    fingerprintSpoofConfig: appState.fingerprintSpoofConfig,
    protectionLogs: appState.protectionLogs.slice(0, 80)
  });
}

function updateActiveViewBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { width, height } = mainWindow.getContentBounds();
  const rightInset = isSidePanelOpen ? SIDE_PANEL_WIDTH : 0;

  for (const [id, tab] of appState.tabs.entries()) {
    if (id === appState.activeTabId) {
      tab.view.setBounds({
        x: 0,
        y: CHROME_TOP_HEIGHT,
        width: Math.max(300, width - rightInset),
        height: Math.max(200, height - CHROME_TOP_HEIGHT)
      });
      tab.view.setVisible(true);
    } else {
      tab.view.setVisible(false);
    }
  }
}

function isOriginWhitelistedForWebRTC(rawUrl) {
  const rules = (appState.webrtc && appState.webrtc.whitelistDomains) || [];
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    for (const r of rules) {
      if (!r || !r.enabled || !r.domain) continue;
      const d = r.domain.toLowerCase();
      if (host === d || host.endsWith('.' + d)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function applyWebRTCPolicyToWebContents(wc) {
  if (!wc || wc.isDestroyed()) return;
  const currentUrl = wc.getURL() || '';
  const whitelisted = isOriginWhitelistedForWebRTC(currentUrl);
  const webrtcControlActive = appState.fingerprintSpoofConfig.controls.webrtc;
  const w = appState.webrtc;

  let effectivePolicy = 'default';
  if (!w.enabled || appState.fingerprintSpoofConfig.mode === 'strict') {
    effectivePolicy = 'disable_non_proxied_udp';
  } else if (whitelisted) {
    effectivePolicy = 'default';
  } else if (w.shieldEnabled) {
    if (w.blockUdp || w.forceProxy || w.blockPublicIp) {
      effectivePolicy = 'disable_non_proxied_udp';
    } else if (w.blockLocalIp) {
      effectivePolicy = 'default_public_interface_only';
    } else {
      effectivePolicy = w.policy || 'default';
    }
  } else if (webrtcControlActive) {
    effectivePolicy = w.policy || 'default_public_interface_only';
  }

  wc.setWebRTCIPHandlingPolicy(effectivePolicy);
}

/**
 * Applies Chromium DevTools Protocol (CDP) emulation overrides directly inside Blink
 * without weakening contextIsolation or sandbox settings.
 */
async function applyCdpFingerprintOverrides(wc, customUserAgent) {
  if (!wc || wc.isDestroyed()) return;
  const cfg = appState.fingerprintSpoofConfig;
  const fp = appState.fingerprintProfile;
  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
    }
    if (cfg.controls.timezone && fp.timezone) {
      await wc.debugger.sendCommand('Emulation.setTimezoneOverride', {
        timezoneId: fp.timezone
      }).catch(() => {});
    }
    if (cfg.controls.navigator) {
      await wc.debugger.sendCommand('Emulation.setLocaleOverride', {
        locale: fp.language || 'en-US'
      }).catch(() => {});
      await wc.debugger.sendCommand('Emulation.setUserAgentOverride', {
        userAgent: customUserAgent || USER_AGENT_PRESETS.default_desktop_chrome,
        acceptLanguage: (fp.language || 'en-US') + ',en;q=0.9',
        platform: fp.platform || 'Win32'
      }).catch(() => {});
    }
    await wc.debugger.sendCommand('Network.enable').catch(() => {});
    await wc.debugger.sendCommand('Network.setCacheDisabled', {
      cacheDisabled: Boolean(cfg.controls.noCache)
    }).catch(() => {});
  } catch (err) {
    console.warn('[Viju CDP Override Warning]:', err.message);
  }
}

function createTab(initialUrl = 'https://www.google.com') {
  const safeUrl = resolveAndValidateNavigationInput(initialUrl);
  const tabId = 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  const view = new WebContentsView({
    webPreferences: {
      partition: PARTITION_NAME,
      preload: path.join(__dirname, 'tab-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  const defaultUa = USER_AGENT_PRESETS.default_desktop_chrome;
  view.webContents.setUserAgent(defaultUa);
  applyWebRTCPolicyToWebContents(view.webContents);
  applyCdpFingerprintOverrides(view.webContents, defaultUa);

  view.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      createTab(url);
    }
    return { action: 'deny' };
  });

  const tabRecord = {
    id: tabId,
    view,
    title: 'Loading...',
    url: safeUrl,
    userAgent: defaultUa,
    autoRefresh: {
      intervalSeconds: 15,
      status: 'stopped',
      remainingSeconds: 15,
      refreshCount: 0,
      timerId: null
    }
  };

  view.webContents.on('page-title-updated', (_event, title) => {
    tabRecord.title = title;
    broadcastStateToUI();
  });

  view.webContents.on('did-navigate', (_event, url) => {
    tabRecord.url = url;
    const nowMs = Date.now();
    appState.history.unshift({
      id: 'hist-' + nowMs,
      title: tabRecord.title || url,
      url,
      visitedAt: new Date(nowMs).toISOString(),
      timestampMs: nowMs
    });
    savePersistedState();
    broadcastStateToUI();
  });

  view.webContents.on('did-start-loading', () => broadcastStateToUI());
  view.webContents.on('did-stop-loading', () => broadcastStateToUI());

  appState.tabs.set(tabId, tabRecord);
  mainWindow.contentView.addChildView(view);
  appState.activeTabId = tabId;

  updateActiveViewBounds();
  view.webContents.loadURL(safeUrl).catch((err) => {
    console.warn('[Viju Navigation Warning]:', err.message);
  });

  broadcastStateToUI();
  return tabId;
}

function stopTabAutoRefresh(tabRecord) {
  if (tabRecord.autoRefresh.timerId) {
    clearInterval(tabRecord.autoRefresh.timerId);
    tabRecord.autoRefresh.timerId = null;
  }
  tabRecord.autoRefresh.status = 'stopped';
  tabRecord.autoRefresh.remainingSeconds = tabRecord.autoRefresh.intervalSeconds;
}

function startTabAutoRefresh(tabRecord, intervalSeconds) {
  const validInterval = validateRefreshInterval(intervalSeconds);
  if (tabRecord.autoRefresh.timerId) {
    clearInterval(tabRecord.autoRefresh.timerId);
  }
  tabRecord.autoRefresh.intervalSeconds = validInterval;
  tabRecord.autoRefresh.remainingSeconds = validInterval;
  tabRecord.autoRefresh.status = 'running';

  tabRecord.autoRefresh.timerId = setInterval(() => {
    if (tabRecord.autoRefresh.status !== 'running') return;
    tabRecord.autoRefresh.remainingSeconds -= 1;
    if (tabRecord.autoRefresh.remainingSeconds <= 0) {
      if (!tabRecord.view.webContents.isDestroyed()) {
        tabRecord.view.webContents.reload();
        tabRecord.autoRefresh.refreshCount += 1;
      }
      tabRecord.autoRefresh.remainingSeconds = tabRecord.autoRefresh.intervalSeconds;
    }
    broadcastStateToUI();
  }, 1000);

  broadcastStateToUI();
}

function closeTab(tabId) {
  const tab = appState.tabs.get(tabId);
  if (!tab) return;

  stopTabAutoRefresh(tab);
  appState.closedTabs.unshift({
    url: tab.url,
    title: tab.title,
    userAgent: tab.userAgent
  });

  mainWindow.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  appState.tabs.delete(tabId);

  if (appState.tabs.size === 0) {
    createTab('https://www.google.com');
  } else if (appState.activeTabId === tabId) {
    const remainingIds = Array.from(appState.tabs.keys());
    appState.activeTabId = remainingIds[remainingIds.length - 1];
  }

  updateActiveViewBounds();
  broadcastStateToUI();
}

function setupDownloadManager(ses) {
  ses.on('will-download', (_event, item) => {
    const nowMs = Date.now();
    const downloadId = 'dl-' + nowMs + '-' + Math.random().toString(36).slice(2, 6);
    const record = {
      id: downloadId,
      filename: item.getFilename(),
      url: item.getURL(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      status: 'progressing',
      startedAt: new Date(nowMs).toISOString(),
      timestampMs: nowMs
    };
    appState.downloads.unshift(record);
    broadcastStateToUI();

    item.on('updated', (_e, state) => {
      record.receivedBytes = item.getReceivedBytes();
      record.totalBytes = item.getTotalBytes();
      record.status = state === 'interrupted' ? 'paused' : 'progressing';
      broadcastStateToUI();
    });

    item.once('done', (_e, state) => {
      record.receivedBytes = item.getReceivedBytes();
      record.status = state;
      broadcastStateToUI();
    });
  });
}

function registerIpcHandlers() {
  ipcMain.on('viju:get-tab-preload-config-sync', (event) => {
    event.returnValue = {
      webrtc: appState.webrtc,
      fingerprintProfile: appState.fingerprintProfile,
      fingerprintSpoofConfig: appState.fingerprintSpoofConfig,
      uaSwitcherConfig: appState.uaSwitcherConfig
    };
  });

  ipcMain.on('viju:fp-log', (_event, logPayload) => {
    if (!logPayload || typeof logPayload !== 'object') return;
    recordProtectionLog(
      logPayload.control || 'system',
      logPayload.level || 'protected',
      logPayload.origin || '',
      logPayload.apiSurface || 'DOM API',
      logPayload.detail || 'Applied protection'
    );
    broadcastStateToUI();
  });

  ipcMain.handle('viju:get-initial-state', () => {
    broadcastStateToUI();
    return { ok: true };
  });

  ipcMain.handle('viju:set-side-panel-open', (_e, isOpen) => {
    isSidePanelOpen = Boolean(isOpen);
    updateActiveViewBounds();
    return { ok: true };
  });

  ipcMain.handle('viju:tab-create', (_e, url) => {
    const id = createTab(url || 'https://www.google.com');
    return { ok: true, tabId: id };
  });

  ipcMain.handle('viju:tab-switch', (_e, tabId) => {
    if (appState.tabs.has(tabId)) {
      appState.activeTabId = tabId;
      updateActiveViewBounds();
      broadcastStateToUI();
    }
    return { ok: true };
  });

  ipcMain.handle('viju:tab-close', (_e, tabId) => {
    closeTab(tabId);
    return { ok: true };
  });

  ipcMain.handle('viju:tab-restore', () => {
    const lastClosed = appState.closedTabs.shift();
    if (lastClosed) {
      createTab(lastClosed.url);
    }
    return { ok: true };
  });

  ipcMain.handle('viju:navigate', (_e, rawInput) => {
    const active = appState.tabs.get(appState.activeTabId);
    if (!active) return { ok: false, error: 'No active tab' };
    const targetUrl = resolveAndValidateNavigationInput(rawInput);
    if (targetUrl.includes('google.com/search')) {
      const nowMs = Date.now();
      appState.formData.unshift({
        id: 'form-' + nowMs,
        fieldName: 'search_query',
        value: String(rawInput).trim(),
        timestampMs: nowMs
      });
      savePersistedState();
    }
    active.view.webContents.loadURL(targetUrl);
    return { ok: true, url: targetUrl };
  });

  ipcMain.handle('viju:nav-control', (_e, action) => {
    const active = appState.tabs.get(appState.activeTabId);
    if (!active) return { ok: false };
    const wc = active.view.webContents;
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    if (action === 'reload') wc.reload();
    if (action === 'home') wc.loadURL('https://www.google.com');
    return { ok: true };
  });

  ipcMain.handle('viju:auto-refresh-control', (_e, payload) => {
    const { tabId, command, intervalSeconds } = payload || {};
    const tab = appState.tabs.get(tabId || appState.activeTabId);
    if (!tab) throw new Error('Target tab not found.');

    if (command === 'start') {
      startTabAutoRefresh(tab, intervalSeconds);
    } else if (command === 'pause') {
      tab.autoRefresh.status = 'paused';
      broadcastStateToUI();
    } else if (command === 'resume') {
      tab.autoRefresh.status = 'running';
      broadcastStateToUI();
    } else if (command === 'stop') {
      stopTabAutoRefresh(tab);
      broadcastStateToUI();
    }
    return { ok: true };
  });

  ipcMain.handle('viju:set-user-agent', (_e, payload) => {
    const active = appState.tabs.get(appState.activeTabId);
    if (!active) throw new Error('No active tab.');
    const validUa = validateUserAgentPayload(payload);
    active.userAgent = validUa;
    active.view.webContents.setUserAgent(validUa);
    applyCdpFingerprintOverrides(active.view.webContents, validUa);
    active.view.webContents.reload();
    broadcastStateToUI();
    return { ok: true, userAgent: validUa };
  });

  ipcMain.handle('viju:ua-get-new-agent', () => {
    const generated = generateNextUserAgentProfile(appState.uaSwitcherConfig);
    if (!generated) {
      return {
        ok: false,
        error: 'No Browser/OS combinations are enabled in Generator Settings.'
      };
    }
    appState.uaSwitcherConfig.activeGeneratedProfile = generated;
    appState.uaSwitcherConfig.rotationCount = (appState.uaSwitcherConfig.rotationCount || 0) + 1;
    savePersistedState();
    for (const tab of appState.tabs.values()) {
      const effectiveUa =
        appState.uaSwitcherConfig.enabledGlobally &&
        !isDomainBlacklistedForUA(tab.url, appState.uaSwitcherConfig.blacklistDomains)
          ? generated.userAgent
          : USER_AGENT_PRESETS.default_desktop_chrome;
      tab.userAgent = effectiveUa;
      tab.view.webContents.setUserAgent(effectiveUa);
      applyCdpFingerprintOverrides(tab.view.webContents, effectiveUa);
    }
    const active = appState.tabs.get(appState.activeTabId);
    if (active) active.view.webContents.reload();
    broadcastStateToUI();
    return { ok: true, profile: generated };
  });

  ipcMain.handle('viju:ua-update-config', (_e, nextConfig) => {
    if (nextConfig && typeof nextConfig === 'object') {
      appState.uaSwitcherConfig = Object.assign(
        createDefaultRandomUASwitcherConfig(),
        appState.uaSwitcherConfig,
        nextConfig
      );
      savePersistedState();
      for (const tab of appState.tabs.values()) {
        const activeProf = appState.uaSwitcherConfig.activeGeneratedProfile;
        const effectiveUa =
          appState.uaSwitcherConfig.enabledGlobally &&
          activeProf &&
          !isDomainBlacklistedForUA(tab.url, appState.uaSwitcherConfig.blacklistDomains)
            ? activeProf.userAgent
            : USER_AGENT_PRESETS.default_desktop_chrome;
        tab.userAgent = effectiveUa;
        tab.view.webContents.setUserAgent(effectiveUa);
        applyCdpFingerprintOverrides(tab.view.webContents, effectiveUa);
      }
      broadcastStateToUI();
    }
    return { ok: true, uaSwitcherConfig: appState.uaSwitcherConfig };
  });

  ipcMain.handle('viju:ua-reset-defaults', () => {
    appState.uaSwitcherConfig = createDefaultRandomUASwitcherConfig();
    savePersistedState();
    broadcastStateToUI();
    return { ok: true, uaSwitcherConfig: appState.uaSwitcherConfig };
  });

  ipcMain.handle('viju:set-fingerprint-profile', (_e, profilePayload) => {
    const validated = validateFingerprintProfile(profilePayload);
    appState.fingerprintProfile = validated;
    savePersistedState();
    for (const tab of appState.tabs.values()) {
      applyCdpFingerprintOverrides(tab.view.webContents, tab.userAgent);
    }
    const active = appState.tabs.get(appState.activeTabId);
    if (active) active.view.webContents.reload();
    broadcastStateToUI();
    return { ok: true, profile: validated };
  });

  ipcMain.handle('viju:set-fingerprint-spoof-config', (_e, spoofPayload) => {
    const validated = validateFingerprintSpoofConfig(spoofPayload);
    appState.fingerprintSpoofConfig = validated;
    savePersistedState();
    for (const tab of appState.tabs.values()) {
      applyWebRTCPolicyToWebContents(tab.view.webContents);
      applyCdpFingerprintOverrides(tab.view.webContents, tab.userAgent);
    }
    const active = appState.tabs.get(appState.activeTabId);
    if (active) active.view.webContents.reload();
    broadcastStateToUI();
    return { ok: true, config: validated };
  });

  ipcMain.handle('viju:set-webrtc-config', (_e, configPayload) => {
    const validated = validateWebRTCConfig(configPayload);
    appState.webrtc = validated;
    savePersistedState();
    for (const tab of appState.tabs.values()) {
      applyWebRTCPolicyToWebContents(tab.view.webContents);
    }
    const active = appState.tabs.get(appState.activeTabId);
    if (active) active.view.webContents.reload();
    broadcastStateToUI();
    return { ok: true, webrtc: validated };
  });

  ipcMain.handle('viju:clear-browser-data', async (_e, rawOptions) => {
    const opts = validateClearDataOptions(rawOptions);
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Clear Data'],
      defaultId: 1,
      cancelId: 0,
      title: 'Confirm Clear Browsing Data',
      message: `Clear selected Web Data and Browser Data (${opts.timeRange})?`,
      detail: 'This will permanently delete the selected items within the chosen time range.'
    });

    if (response.response !== 1) {
      return { ok: false, cancelled: true };
    }

    if (opts.webData.cache || opts.webData.appCache) {
      try {
        await browserSession.clearCache();
      } catch (err) {
        console.warn('[Viju ClearCache] clearCache warning:', err.message);
      }
    }

    const storages = [];
    if (opts.webData.cacheStorage) storages.push('cachestorage');
    if (opts.webData.cookies) storages.push('cookies');
    if (opts.webData.fileSystems) storages.push('filesystem');
    if (opts.webData.indexedDB) storages.push('indexdb');
    if (opts.webData.localStorage) storages.push('localstorage');
    if (opts.webData.serviceWorkers) storages.push('serviceworkers');
    if (opts.webData.webSQL) storages.push('websql');

    if (storages.length > 0) {
      try {
        await browserSession.clearStorageData({ storages });
      } catch (_err) {
        for (const st of storages) {
          try {
            await browserSession.clearStorageData({ storages: [st] });
          } catch (innerErr) {
            console.warn(`[Viju ClearStorage] Skipped unsupported storage "${st}":`, innerErr.message);
          }
        }
      }
    }

    const filterByCutoff = (arr) =>
      opts.cutoffMs === 0 ? [] : arr.filter((item) => (item.timestampMs || 0) < opts.cutoffMs);

    if (opts.browserData.downloads) appState.downloads = filterByCutoff(appState.downloads);
    if (opts.browserData.formData) appState.formData = filterByCutoff(appState.formData);
    if (opts.browserData.history) {
      appState.history = filterByCutoff(appState.history);
      if (opts.cutoffMs === 0) {
        for (const tab of appState.tabs.values()) {
          if (!tab.view.webContents.isDestroyed()) {
            tab.view.webContents.navigationHistory.clear();
          }
        }
      }
    }
    if (opts.browserData.passwords) {
      appState.passwords = filterByCutoff(appState.passwords);
      try {
        await browserSession.clearAuthCache();
      } catch {}
    }

    savePersistedState();
    broadcastStateToUI();
    return { ok: true, clearedAt: new Date().toISOString(), timeRange: opts.timeRange };
  });

  ipcMain.handle('viju:toggle-bookmark', (_e, payload) => {
    const { title, url } = payload || {};
    if (typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('Only valid HTTP/HTTPS URLs can be bookmarked.');
    }
    const existingIdx = appState.bookmarks.findIndex((b) => b.url === url);
    if (existingIdx >= 0) {
      appState.bookmarks.splice(existingIdx, 1);
    } else {
      appState.bookmarks.unshift({
        id: 'bm-' + Date.now(),
        title: String(title || url).slice(0, 120),
        url,
        createdAt: new Date().toISOString()
      });
    }
    savePersistedState();
    broadcastStateToUI();
    return { ok: true };
  });
}

app.whenReady().then(() => {
  loadPersistedState();
  browserSession = session.fromPartition(PARTITION_NAME);

  // Outbound HTTP Request Header Spoofing (Random UA Switcher + Navigator Client Hints + No-Cache ETag defense)
  browserSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const cfg = appState.fingerprintSpoofConfig;
    const fp = appState.fingerprintProfile;
    const uaCfg = appState.uaSwitcherConfig;
    const headers = details.requestHeaders || {};

    if (
      uaCfg &&
      uaCfg.enabledGlobally &&
      uaCfg.activeGeneratedProfile &&
      !isDomainBlacklistedForUA(details.url, uaCfg.blacklistDomains)
    ) {
      headers['User-Agent'] = uaCfg.activeGeneratedProfile.userAgent;
    } else if (uaCfg) {
      headers['User-Agent'] = USER_AGENT_PRESETS.default_desktop_chrome;
    }

    if (cfg.controls.navigator && !isOriginWhitelistedInMain(details.url, 'navigator')) {
      headers['Accept-Language'] = (fp.language || 'en-US') + ',en;q=0.9';
      headers['Sec-CH-UA'] = '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"';
      headers['Sec-CH-UA-Platform'] = '"Windows"';
      headers['Sec-CH-UA-Mobile'] = '?0';
    }

    if (cfg.controls.noCache && !isOriginWhitelistedInMain(details.url, 'noCache')) {
      delete headers['If-None-Match'];
      delete headers['if-none-match'];
      delete headers['If-Modified-Since'];
      delete headers['if-modified-since'];
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      headers['Pragma'] = 'no-cache';
    }

    callback({ requestHeaders: headers });
  });

  // Inbound HTTP Response Header Sanitization (Strip ETag tracking headers when No-Cache is active)
  browserSession.webRequest.onHeadersReceived((details, callback) => {
    const cfg = appState.fingerprintSpoofConfig;
    const responseHeaders = details.responseHeaders || {};
    if (cfg.controls.noCache && !isOriginWhitelistedInMain(details.url, 'noCache')) {
      delete responseHeaders['ETag'];
      delete responseHeaders['etag'];
      delete responseHeaders['Last-Modified'];
      delete responseHeaders['last-modified'];
    }
    callback({ responseHeaders });
  });

  setupDownloadManager(browserSession);
  registerIpcHandlers();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0B0F19',
    title: 'Viju Browser',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('resize', updateActiveViewBounds);

  createTab('https://www.google.com');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
