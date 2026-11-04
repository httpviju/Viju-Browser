'use strict';

const MIN_REFRESH_SECONDS = 5;
const MAX_REFRESH_SECONDS = 86400;

const ALLOWED_WEBRTC_POLICIES = new Set([
  'default',
  'default_public_and_private_interfaces',
  'default_public_interface_only',
  'disable_non_proxied_udp'
]);

const ALL_FP_CONTROL_KEYS = [
  'canvas',
  'webgl',
  'audio',
  'font',
  'clientRects',
  'webrtc',
  'navigator',
  'timezone',
  'random',
  'noCache',
  'whitelist',
  'logs'
];

const TIME_RANGE_DURATION_MS = {
  last_15_min: 15 * 60 * 1000,
  last_hour: 60 * 60 * 1000,
  last_day: 24 * 60 * 60 * 1000,
  last_week: 7 * 24 * 60 * 60 * 1000,
  last_month: 30 * 24 * 60 * 60 * 1000,
  everything: null
};

const USER_AGENT_PRESETS = {
  default_desktop_chrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  android_chrome:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.45 Mobile Safari/537.36',
  iphone_safari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
  windows_edge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
};

function createDefaultFingerprintSpoofConfig() {
  return {
    mode: 'maximum_default',
    controls: {
      canvas: true,
      webgl: true,
      audio: true,
      font: true,
      clientRects: true,
      webrtc: true,
      navigator: true,
      timezone: true,
      random: true,
      noCache: true,
      whitelist: true,
      logs: true
    },
    profileSeed: 0x7F4A9C21,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    audioNoiseEpsilon: 1.4e-7,
    canvasNoiseStep: 2,
    clientRectsDeltaPx: 0.00037,
    fontJitterPx: 0.015,
    whitelistRules: [
      {
        id: 'wl-localhost',
        domain: 'localhost',
        enabled: true,
        bypassControls: ['noCache'],
        reason: 'Local development cache exception'
      }
    ]
  };
}

function validateFingerprintSpoofConfig(raw) {
  const def = createDefaultFingerprintSpoofConfig();
  if (!raw || typeof raw !== 'object') return def;

  const rawControls = raw.controls && typeof raw.controls === 'object' ? raw.controls : {};
  const controls = {};
  for (const key of ALL_FP_CONTROL_KEYS) {
    controls[key] = rawControls[key] === undefined ? true : Boolean(rawControls[key]);
  }

  const seed = Number.isInteger(raw.profileSeed) ? (raw.profileSeed >>> 0) : def.profileSeed;
  const whitelistRules = Array.isArray(raw.whitelistRules)
    ? raw.whitelistRules.slice(0, 100).map((r, idx) => ({
        id: String(r.id || 'wl-' + idx).slice(0, 48),
        domain: String(r.domain || '').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 128),
        enabled: r.enabled !== false,
        bypassControls: r.bypassControls === 'all' ? 'all' : ['noCache'],
        reason: String(r.reason || 'User site exception').slice(0, 160)
      })).filter((r) => r.domain.length > 0)
    : def.whitelistRules;

  return {
    mode: ['maximum_default', 'strict', 'custom', 'disabled'].includes(raw.mode)
      ? raw.mode
      : 'maximum_default',
    controls,
    profileSeed: seed,
    webglVendor: String(raw.webglVendor || def.webglVendor).slice(0, 128),
    webglRenderer: String(raw.webglRenderer || def.webglRenderer).slice(0, 180),
    audioNoiseEpsilon: Number(raw.audioNoiseEpsilon) || def.audioNoiseEpsilon,
    canvasNoiseStep: Math.max(1, Math.min(8, Number(raw.canvasNoiseStep) || 2)),
    clientRectsDeltaPx: Number(raw.clientRectsDeltaPx) || def.clientRectsDeltaPx,
    fontJitterPx: Number(raw.fontJitterPx) || def.fontJitterPx,
    whitelistRules
  };
}

function resolveAndValidateNavigationInput(rawInput) {
  if (typeof rawInput !== 'string') {
    return 'https://www.google.com';
  }
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed === 'viju://home') {
    return 'https://www.google.com';
  }

  if (/^(javascript|data|file|vbscript):/i.test(trimmed)) {
    throw new Error('Blocked unsafe URI scheme in navigation request.');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch {
      // Fallback to search
    }
  }

  if (!/\s/.test(trimmed) && /^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(trimmed)) {
    try {
      const parsed = new URL('https://' + trimmed);
      return parsed.toString();
    } catch {
      // Fallback to search
    }
  }

  return 'https://www.google.com/search?q=' + encodeURIComponent(trimmed);
}

function validateRefreshInterval(seconds) {
  const num = Number(seconds);
  if (!Number.isFinite(num) || num < MIN_REFRESH_SECONDS) {
    throw new Error(`Refresh interval must be at least ${MIN_REFRESH_SECONDS} seconds.`);
  }
  if (num > MAX_REFRESH_SECONDS) {
    throw new Error(`Refresh interval cannot exceed ${MAX_REFRESH_SECONDS} seconds.`);
  }
  return Math.floor(num);
}

function validateUserAgentPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid User-Agent payload.');
  }
  const { preset, customUserAgent } = payload;
  if (preset && preset !== 'custom' && USER_AGENT_PRESETS[preset]) {
    return USER_AGENT_PRESETS[preset];
  }
  if (typeof customUserAgent !== 'string') {
    throw new Error('Custom User-Agent must be a string.');
  }
  const cleaned = customUserAgent.trim();
  if (cleaned.length < 8 || cleaned.length > 512) {
    throw new Error('Custom User-Agent must be between 8 and 512 characters.');
  }
  if (/[\r\n\0]/.test(cleaned)) {
    throw new Error('CR/LF/Null characters are forbidden in User-Agent strings.');
  }
  return cleaned;
}

function validateFingerprintProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('Invalid fingerprint profile object.');
  }
  const width = Number(profile.screenWidth);
  const height = Number(profile.screenHeight);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || width > 7680 || height < 240 || height > 4320) {
    throw new Error('Screen dimensions must be integers between 320x240 and 7680x4320.');
  }
  const cores = Number(profile.hardwareConcurrency);
  if (!Number.isInteger(cores) || cores < 1 || cores > 128) {
    throw new Error('Hardware concurrency must be between 1 and 128.');
  }
  const memory = Number(profile.deviceMemory);
  if (![1, 2, 4, 8, 16, 32].includes(memory)) {
    throw new Error('Device memory must be a standard value (1, 2, 4, 8, 16, 32).');
  }
  const language = typeof profile.language === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(profile.language)
    ? profile.language
    : 'en-US';
  const timezone = typeof profile.timezone === 'string' && profile.timezone.length <= 64
    ? profile.timezone
    : 'America/New_York';
  return {
    name: String(profile.name || 'Custom Profile').slice(0, 64),
    screenWidth: width,
    screenHeight: height,
    colorDepth: Number(profile.colorDepth) === 30 ? 30 : 24,
    hardwareConcurrency: cores,
    deviceMemory: memory,
    language,
    timezone,
    platform: 'Win32'
  };
}

function validateWebRTCConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid WebRTC configuration payload.');
  }
  const enabled = config.enabled !== false;
  const shieldEnabled = config.shieldEnabled !== false;
  const blockLocalIp = config.blockLocalIp !== false;
  const blockPublicIp = Boolean(config.blockPublicIp);
  const blockUdp = Boolean(config.blockUdp);
  const forceProxy = Boolean(config.forceProxy);
  const leakDetectionEnabled = config.leakDetectionEnabled !== false;

  let policy = ALLOWED_WEBRTC_POLICIES.has(config.policy)
    ? config.policy
    : 'default_public_interface_only';
  if (!enabled) {
    policy = 'disable_non_proxied_udp';
  } else if (shieldEnabled) {
    if (blockUdp || forceProxy || blockPublicIp) {
      policy = 'disable_non_proxied_udp';
    } else if (blockLocalIp) {
      policy = 'default_public_interface_only';
    } else {
      policy = 'default';
    }
  }

  const defaultWhitelist = [
    { id: 'wrtc-wl-meet', domain: 'meet.google.com', enabled: true, note: 'Google Meet WebRTC calls' },
    { id: 'wrtc-wl-zoom', domain: 'zoom.us', enabled: true, note: 'Zoom Web Client video calls' },
    { id: 'wrtc-wl-teams', domain: 'teams.microsoft.com', enabled: true, note: 'Microsoft Teams WebRTC media' }
  ];

  const whitelistDomains = Array.isArray(config.whitelistDomains)
    ? config.whitelistDomains
        .slice(0, 100)
        .map((r, idx) => ({
          id: String(r.id || 'wrtc-wl-' + idx).slice(0, 48),
          domain: String(r.domain || '').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 128),
          enabled: r.enabled !== false,
          note: String(r.note || 'Trusted WebRTC site').slice(0, 160)
        }))
        .filter((r) => r.domain.length > 0)
    : defaultWhitelist;

  return {
    enabled,
    policy,
    shieldEnabled,
    blockLocalIp,
    blockPublicIp,
    blockUdp,
    forceProxy,
    leakDetectionEnabled,
    whitelistDomains
  };
}

function validateClearDataOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('Invalid cache clearing options.');
  }
  const timeRange = Object.prototype.hasOwnProperty.call(TIME_RANGE_DURATION_MS, options.timeRange)
    ? options.timeRange
    : 'everything';
  const webData = options.webData || {};
  const browserData = options.browserData || {};

  return {
    timeRange,
    cutoffMs: TIME_RANGE_DURATION_MS[timeRange] === null
      ? 0
      : Date.now() - TIME_RANGE_DURATION_MS[timeRange],
    webData: {
      appCache: Boolean(webData.appCache),
      cache: Boolean(webData.cache),
      cacheStorage: Boolean(webData.cacheStorage),
      cookies: Boolean(webData.cookies),
      fileSystems: Boolean(webData.fileSystems),
      indexedDB: Boolean(webData.indexedDB),
      localStorage: Boolean(webData.localStorage),
      serviceWorkers: Boolean(webData.serviceWorkers),
      webSQL: Boolean(webData.webSQL)
    },
    browserData: {
      downloads: Boolean(browserData.downloads),
      formData: Boolean(browserData.formData),
      history: Boolean(browserData.history),
      passwords: Boolean(browserData.passwords)
    }
  };
}

const UA_GENERATOR_COMBINATIONS = [
  // Enabled by default (9)
  {
    key: 'chrome_macos',
    label: 'Chrome on macOS',
    browser: 'chrome',
    os: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
  },
  {
    key: 'chrome_windows',
    label: 'Chrome on Windows',
    browser: 'chrome',
    os: 'windows',
    defaultEnabled: true,
    platform: 'Win32',
    vendor: 'Google Inc.',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
  },
  {
    key: 'edge_macos',
    label: 'Edge on macOS',
    browser: 'edge',
    os: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
  },
  {
    key: 'edge_windows',
    label: 'Edge on Windows',
    browser: 'edge',
    os: 'windows',
    defaultEnabled: true,
    platform: 'Win32',
    vendor: 'Google Inc.',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
  },
  {
    key: 'firefox_macos',
    label: 'Firefox on macOS',
    browser: 'firefox',
    os: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: '',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:135.0) Gecko/20100101 Firefox/135.0'
  },
  {
    key: 'firefox_windows',
    label: 'Firefox on Windows',
    browser: 'firefox',
    os: 'windows',
    defaultEnabled: true,
    platform: 'Win32',
    vendor: '',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'
  },
  {
    key: 'opera_macos',
    label: 'Opera on macOS',
    browser: 'opera',
    os: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 OPR/117.0.0.0'
  },
  {
    key: 'opera_windows',
    label: 'Opera on Windows',
    browser: 'opera',
    os: 'windows',
    defaultEnabled: true,
    platform: 'Win32',
    vendor: 'Google Inc.',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 OPR/117.0.0.0'
  },
  {
    key: 'safari_macos',
    label: 'Safari on macOS',
    browser: 'safari',
    os: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: 'Apple Computer, Inc.',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15'
  },
  // Disabled by default (5)
  {
    key: 'chrome_android',
    label: 'Chrome on Android',
    browser: 'chrome',
    os: 'android',
    defaultEnabled: false,
    platform: 'Linux armv81',
    vendor: 'Google Inc.',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.45 Mobile Safari/537.36'
  },
  {
    key: 'chrome_linux',
    label: 'Chrome on Linux',
    browser: 'chrome',
    os: 'linux',
    defaultEnabled: false,
    platform: 'Linux x86_64',
    vendor: 'Google Inc.',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
  },
  {
    key: 'firefox_android',
    label: 'Firefox on Android',
    browser: 'firefox',
    os: 'android',
    defaultEnabled: false,
    platform: 'Linux armv81',
    vendor: '',
    userAgent: 'Mozilla/5.0 (Android 15; Mobile; rv:135.0) Gecko/135.0 Firefox/135.0'
  },
  {
    key: 'firefox_linux',
    label: 'Firefox on Linux',
    browser: 'firefox',
    os: 'linux',
    defaultEnabled: false,
    platform: 'Linux x86_64',
    vendor: '',
    userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0'
  },
  {
    key: 'safari_iphone',
    label: 'Safari on iPhone',
    browser: 'safari',
    os: 'iphone',
    defaultEnabled: false,
    platform: 'iPhone',
    vendor: 'Apple Computer, Inc.',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'
  }
];

function createDefaultRandomUASwitcherConfig() {
  const generatorToggles = {};
  for (const item of UA_GENERATOR_COMBINATIONS) {
    generatorToggles[item.key] = item.defaultEnabled;
  }
  return {
    enabledGlobally: true,
    paused: false,
    autoRotateEnabled: false,
    autoRotateIntervalSeconds: 60,
    rotateOnStartup: true,
    jsProtectionEnabled: true,
    syncOsWithSelectedProfile: true,
    selectedBrowserIcon: 'chrome',
    selectedOsIcon: 'windows',
    useCustomAgentsMode: false,
    customAgentsList: [],
    generatorToggles,
    blacklistDomains: [
      { id: 'uabl-1', domainPattern: 'accounts.google.com', matchSubdomains: true, enabled: true },
      { id: 'uabl-2', domainPattern: '*.internal.corp.local', matchSubdomains: true, enabled: true }
    ],
    activeGeneratedProfile: {
      comboKey: 'chrome_windows',
      label: 'Chrome on Windows',
      browser: 'chrome',
      os: 'windows',
      userAgent: USER_AGENT_PRESETS.default_desktop_chrome,
      appVersion: USER_AGENT_PRESETS.default_desktop_chrome.replace(/^Mozilla\//, ''),
      platform: 'Win32',
      vendor: 'Google Inc.'
    },
    rotationCount: 0
  };
}

function isDomainBlacklistedForUA(rawUrl, blacklistDomains) {
  if (!rawUrl || !Array.isArray(blacklistDomains)) return false;
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    for (const rule of blacklistDomains) {
      if (!rule || !rule.enabled || !rule.domainPattern) continue;
      const pattern = String(rule.domainPattern).toLowerCase().trim();
      if (pattern.startsWith('*.')) {
        const base = pattern.slice(2);
        if (host === base || host.endsWith('.' + base)) return true;
      } else if (host === pattern || (rule.matchSubdomains && host.endsWith('.' + pattern))) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function generateNextUserAgentProfile(uaConfig) {
  const toggles = (uaConfig && uaConfig.generatorToggles) || {};
  const enabledPool = UA_GENERATOR_COMBINATIONS.filter((c) => Boolean(toggles[c.key]));
  if (enabledPool.length === 0) return null;
  const currentUa = uaConfig.activeGeneratedProfile && uaConfig.activeGeneratedProfile.userAgent;
  const diffPool = enabledPool.filter((c) => c.userAgent !== currentUa);
  const pool = diffPool.length > 0 ? diffPool : enabledPool;
  const pick = pool[Math.floor(Math.random() * pool.length)] || pool[0];
  return {
    comboKey: pick.key,
    label: pick.label,
    browser: pick.browser,
    os: pick.os,
    userAgent: pick.userAgent,
    appVersion: pick.userAgent.replace(/^Mozilla\//, ''),
    platform: pick.platform,
    vendor: pick.vendor
  };
}

module.exports = {
  MIN_REFRESH_SECONDS,
  ALL_FP_CONTROL_KEYS,
  USER_AGENT_PRESETS,
  UA_GENERATOR_COMBINATIONS,
  TIME_RANGE_DURATION_MS,
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
  validateClearDataOptions
};

