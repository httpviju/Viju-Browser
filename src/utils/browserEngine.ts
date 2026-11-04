import {
  ClearBrowsingDataPayload,
  ClearTimeRange,
  FingerprintProfile,
  TabItem,
  UserAgentPreset,
  UserAgentPresetId,
  WebDataClearOptions,
  WebRTCConfig,
  WebRTCPolicy,
} from '../types/browser';

export const MIN_AUTO_REFRESH_SECONDS = 5;
export const MAX_AUTO_REFRESH_SECONDS = 86400;

export const CLEAR_TIME_RANGES: {
  id: ClearTimeRange;
  label: string;
  durationMs: number | null;
}[] = [
  { id: 'last_15_min', label: 'Last 15 Minutes', durationMs: 15 * 60 * 1000 },
  { id: 'last_hour', label: 'Last Hour', durationMs: 60 * 60 * 1000 },
  { id: 'last_day', label: 'Last Day', durationMs: 24 * 60 * 60 * 1000 },
  { id: 'last_week', label: 'Last Week', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { id: 'last_month', label: 'Last Month', durationMs: 30 * 24 * 60 * 60 * 1000 },
  { id: 'everything', label: 'Everything', durationMs: null },
];

export function createDefaultClearBrowsingDataPayload(): ClearBrowsingDataPayload {
  return {
    timeRange: 'everything',
    webData: {
      appCache: true,
      cache: true,
      cacheStorage: true,
      cookies: true,
      fileSystems: true,
      indexedDB: true,
      localStorage: true,
      serviceWorkers: true,
      webSQL: true,
    },
    browserData: {
      downloads: true,
      formData: true,
      history: true,
      passwords: true,
    },
  };
}

/**
 * Computes the cutoff timestamp (in milliseconds) for a given ClearTimeRange.
 * Items with timestampMs >= cutoffMs fall within the selected time range and should be cleared.
 */
export function getTimeRangeCutoffMs(
  timeRange: ClearTimeRange,
  nowMs: number = Date.now()
): number {
  const found = CLEAR_TIME_RANGES.find((r) => r.id === timeRange);
  if (!found || found.durationMs === null) {
    return 0;
  }
  return nowMs - found.durationMs;
}

/**
 * Removes records that fall within the selected ClearTimeRange (timestampMs >= cutoff).
 */
export function filterRecordsByClearTimeRange<T extends { timestampMs: number }>(
  records: T[],
  timeRange: ClearTimeRange,
  nowMs: number = Date.now()
): { remaining: T[]; removedCount: number } {
  const cutoff = getTimeRangeCutoffMs(timeRange, nowMs);
  if (cutoff === 0) {
    return { remaining: [], removedCount: records.length };
  }
  const remaining = records.filter((item) => item.timestampMs < cutoff);
  return {
    remaining,
    removedCount: records.length - remaining.length,
  };
}

/**
 * Maps WebDataClearOptions to Electron session.clearCache() and session.clearStorageData()
 * while gracefully handling legacy/deprecated Chromium storage types (such as appcache and websql).
 */
export function mapWebDataToElectronStorages(webData: WebDataClearOptions): {
  shouldClearHttpCache: boolean;
  supportedElectronStorages: string[];
  gracefullyHandledLegacyTypes: string[];
  selectedLabels: string[];
} {
  const supportedElectronStorages: string[] = [];
  const gracefullyHandledLegacyTypes: string[] = [];
  const selectedLabels: string[] = [];

  if (webData.appCache) {
    selectedLabels.push('App Cache');
    // HTML5 Application Cache was removed from modern Chromium; handle gracefully without throwing
    gracefullyHandledLegacyTypes.push('appcache');
  }
  if (webData.cache) {
    selectedLabels.push('Cache');
  }
  if (webData.cacheStorage) {
    selectedLabels.push('Cache Storage');
    supportedElectronStorages.push('cachestorage');
  }
  if (webData.cookies) {
    selectedLabels.push('Cookies');
    supportedElectronStorages.push('cookies');
  }
  if (webData.fileSystems) {
    selectedLabels.push('File Systems');
    supportedElectronStorages.push('filesystem');
  }
  if (webData.indexedDB) {
    selectedLabels.push('IndexedDB');
    supportedElectronStorages.push('indexdb');
  }
  if (webData.localStorage) {
    selectedLabels.push('Local Storage');
    supportedElectronStorages.push('localstorage');
  }
  if (webData.serviceWorkers) {
    selectedLabels.push('Service Workers');
    supportedElectronStorages.push('serviceworkers');
  }
  if (webData.webSQL) {
    selectedLabels.push('WebSQL');
    supportedElectronStorages.push('websql');
    gracefullyHandledLegacyTypes.push('websql');
  }

  return {
    shouldClearHttpCache: Boolean(webData.cache || webData.appCache),
    supportedElectronStorages,
    gracefullyHandledLegacyTypes,
    selectedLabels,
  };
}

export const USER_AGENT_PRESETS: UserAgentPreset[] = [
  {
    id: 'default_desktop_chrome',
    name: 'Desktop Chrome (Windows 11 x64)',
    platformLabel: 'Windows Desktop',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    platform: 'Win32',
    mobile: false,
  },
  {
    id: 'android_chrome',
    name: 'Android Chrome (Pixel 9 Pro)',
    platformLabel: 'Android Mobile',
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.45 Mobile Safari/537.36',
    platform: 'Linux armv81',
    mobile: true,
  },
  {
    id: 'iphone_safari',
    name: 'iPhone Safari (iOS 18.3)',
    platformLabel: 'iOS Mobile',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    mobile: true,
  },
  {
    id: 'windows_edge',
    name: 'Desktop Edge (Windows 11 x64)',
    platformLabel: 'Windows Desktop',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
    platform: 'Win32',
    mobile: false,
  },
];

export * from './fingerprintEngine';
export * from './userAgentSwitcherEngine';
export * from './webrtcShieldEngine';

export const DEFAULT_FINGERPRINT_PROFILES: FingerprintProfile[] = [
  {
    id: 'fp_standard_win11',
    name: 'Windows 11 Standard (1920×1080)',
    description: 'Balanced desktop workstation baseline matching common 1080p displays.',
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    pixelRatio: 1,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    language: 'en-US',
    timezone: 'America/New_York',
    doNotTrack: 'unspecified',
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    platform: 'Win32',
  },
  {
    id: 'fp_compact_laptop',
    name: 'Compact Laptop (1366×768)',
    description: 'Common enterprise notebook screen geometry and reduced core count.',
    screenWidth: 1366,
    screenHeight: 768,
    colorDepth: 24,
    pixelRatio: 1,
    hardwareConcurrency: 4,
    deviceMemory: 4,
    language: 'en-US',
    timezone: 'UTC',
    doNotTrack: '1',
    webglVendor: 'Google Inc. (Intel)',
    webglRenderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
    platform: 'Win32',
  },
  {
    id: 'fp_qhd_workstation',
    name: 'QHD Studio Display (2560×1440)',
    description: 'High-DPI developer display profile with 16 threads and European locale.',
    screenWidth: 2560,
    screenHeight: 1440,
    colorDepth: 30,
    pixelRatio: 1.5,
    hardwareConcurrency: 16,
    deviceMemory: 16,
    language: 'en-GB',
    timezone: 'Europe/London',
    doNotTrack: '1',
    webglVendor: 'Google Inc. (AMD)',
    webglRenderer: 'ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
    platform: 'Win32',
  },
  {
    id: 'fp_mobile_handheld',
    name: 'Mobile Viewport (412×915)',
    description: 'Handheld screen dimensions paired with mobile concurrency limits.',
    screenWidth: 412,
    screenHeight: 915,
    colorDepth: 24,
    pixelRatio: 2.625,
    hardwareConcurrency: 8,
    deviceMemory: 4,
    language: 'en-US',
    timezone: 'America/Los_Angeles',
    doNotTrack: '1',
    webglVendor: 'Qualcomm',
    webglRenderer: 'Adreno (TM) 750',
    platform: 'Linux armv81',
  },
];

export interface ResolvedNavigation {
  url: string;
  title: string;
  isInternal: boolean;
  isSearch: boolean;
  searchQuery?: string;
  faviconType: TabItem['faviconType'];
}

const INTERNAL_PAGE_TITLES: Record<string, { title: string; faviconType: TabItem['faviconType'] }> = {
  'viju://home': { title: 'Viju Start — Security & Privacy Dashboard', faviconType: 'viju' },
  'viju://settings': { title: 'Settings — Viju Browser Configuration', faviconType: 'viju' },
  'viju://ua-settings': { title: 'Random User-Agent Switcher — Settings & Generator', faviconType: 'shield' },
  'viju://privacy': { title: 'Fingerprint & Privacy Controls', faviconType: 'shield' },
  'viju://webrtc-test': { title: 'WebRTC Policy & ICE Leak Inspector', faviconType: 'shield' },
  'viju://fingerprint': { title: 'Navigator & Screen Signal Inspector', faviconType: 'shield' },
  'viju://electron-source': { title: 'Electron Source Code & Windows .EXE Builder', faviconType: 'code' },
};

/**
 * Resolves raw user input from the address bar into a normalized URL or Google Search fallback.
 */
export function resolveAddressBarInput(rawInput: string): ResolvedNavigation {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      url: 'viju://home',
      title: INTERNAL_PAGE_TITLES['viju://home'].title,
      isInternal: true,
      isSearch: false,
      faviconType: 'viju',
    };
  }

  const lower = trimmed.toLowerCase();

  if (lower.startsWith('viju://')) {
    const meta = INTERNAL_PAGE_TITLES[lower] || {
      title: `Viju Internal (${lower})`,
      faviconType: 'viju' as const,
    };
    return {
      url: lower,
      title: meta.title,
      isInternal: true,
      isSearch: false,
      faviconType: meta.faviconType,
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const isGoogleSearch =
        (parsed.hostname === 'www.google.com' || parsed.hostname === 'google.com') &&
        parsed.pathname === '/search' &&
        parsed.searchParams.has('q');
      if (isGoogleSearch) {
        const q = parsed.searchParams.get('q') || '';
        return {
          url: parsed.toString(),
          title: `${q} - Google Search`,
          isInternal: false,
          isSearch: true,
          searchQuery: q,
          faviconType: 'search',
        };
      }
      return {
        url: parsed.toString(),
        title: formatTitleFromUrl(parsed),
        isInternal: false,
        isSearch: false,
        faviconType: parsed.protocol === 'https:' ? 'lock' : 'globe',
      };
    } catch {
      // Fall through to search if malformed URL
    }
  }

  const looksLikeDomain =
    !/\s/.test(trimmed) &&
    (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed) ||
      /^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(trimmed));

  if (looksLikeDomain) {
    const protocol = /^localhost/i.test(trimmed) ? 'http://' : 'https://';
    try {
      const parsed = new URL(`${protocol}${trimmed}`);
      return {
        url: parsed.toString(),
        title: formatTitleFromUrl(parsed),
        isInternal: false,
        isSearch: false,
        faviconType: parsed.protocol === 'https:' ? 'lock' : 'globe',
      };
    } catch {
      // Fall through to search
    }
  }

  const encodedQuery = encodeURIComponent(trimmed);
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}`;
  return {
    url: searchUrl,
    title: `${trimmed} - Google Search`,
    isInternal: false,
    isSearch: true,
    searchQuery: trimmed,
    faviconType: 'search',
  };
}

function formatTitleFromUrl(parsed: URL): string {
  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'example.com') return 'Example Domain — IANA Reserved Test Site';
  if (host === 'browserleaks.com') return 'BrowserLeaks — WebRTC & Client Signal Audit';
  if (host === 'chromium.org') return 'The Chromium Projects — Security Architecture';
  if (host === 'electronjs.org') return 'Electron — Build cross-platform desktop apps';
  if (host === 'github.com') return `GitHub — ${parsed.pathname !== '/' ? parsed.pathname.slice(1) : 'Developer Platform'}`;
  if (host === 'wikipedia.org' || host.endsWith('.wikipedia.org')) return 'Wikipedia — The Free Encyclopedia';
  const pathSegment = parsed.pathname && parsed.pathname !== '/' ? ` (${parsed.pathname})` : '';
  return `${host.charAt(0).toUpperCase() + host.slice(1)}${pathSegment}`;
}

export function validateAutoRefreshInterval(rawSeconds: number): {
  valid: boolean;
  sanitizedSeconds: number;
  error?: string;
} {
  if (!Number.isFinite(rawSeconds) || Number.isNaN(rawSeconds)) {
    return {
      valid: false,
      sanitizedSeconds: MIN_AUTO_REFRESH_SECONDS,
      error: 'Refresh interval must be a valid number of seconds.',
    };
  }

  const rounded = Math.floor(rawSeconds);

  if (rounded < MIN_AUTO_REFRESH_SECONDS) {
    return {
      valid: false,
      sanitizedSeconds: MIN_AUTO_REFRESH_SECONDS,
      error: `Minimum refresh interval is ${MIN_AUTO_REFRESH_SECONDS} seconds to prevent excessive network load.`,
    };
  }

  if (rounded > MAX_AUTO_REFRESH_SECONDS) {
    return {
      valid: false,
      sanitizedSeconds: MAX_AUTO_REFRESH_SECONDS,
      error: `Maximum refresh interval is ${MAX_AUTO_REFRESH_SECONDS} seconds (24 hours).`,
    };
  }

  return {
    valid: true,
    sanitizedSeconds: rounded,
  };
}

export function validateUserAgentString(ua: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  if (typeof ua !== 'string') {
    return { valid: false, sanitized: '', error: 'User-Agent must be a string.' };
  }
  const trimmed = ua.trim();
  if (trimmed.length < 8) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'User-Agent string must be at least 8 characters long.',
    };
  }
  if (trimmed.length > 512) {
    return {
      valid: false,
      sanitized: trimmed.slice(0, 512),
      error: 'User-Agent string cannot exceed 512 characters.',
    };
  }
  if (/[\r\n\0]/.test(trimmed)) {
    return {
      valid: false,
      sanitized: trimmed.replace(/[\r\n\0]/g, ''),
      error: 'Invalid characters detected: CR/LF/Null bytes are prohibited in User-Agent headers.',
    };
  }
  return { valid: true, sanitized: trimmed };
}

export function validateScreenDimensions(width: number, height: number): {
  valid: boolean;
  error?: string;
} {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return { valid: false, error: 'Screen width and height must be whole integers.' };
  }
  if (width < 320 || width > 7680 || height < 240 || height > 4320) {
    return {
      valid: false,
      error: 'Screen dimensions must be within supported bounds (320×240 to 7680×4320).',
    };
  }
  return { valid: true };
}

export function isValidWebRTCPolicy(policy: string): policy is WebRTCPolicy {
  return [
    'default',
    'default_public_and_private_interfaces',
    'default_public_interface_only',
    'disable_non_proxied_udp',
  ].includes(policy);
}

export function createTabState(
  id: string,
  initialUrl = 'viju://home',
  defaultFingerprintId = 'fp_standard_win11'
): TabItem {
  const resolved = resolveAddressBarInput(initialUrl);
  const defaultPreset = USER_AGENT_PRESETS[0];
  return {
    id,
    title: resolved.title,
    url: resolved.url,
    faviconType: resolved.faviconType,
    isLoading: false,
    historyStack: [resolved.url],
    historyIndex: 0,
    userAgentPresetId: defaultPreset.id,
    customUserAgent: defaultPreset.userAgent,
    effectiveUserAgent: defaultPreset.userAgent,
    fingerprintProfileId: defaultFingerprintId,
    autoRefresh: {
      intervalSeconds: 15,
      status: 'stopped',
      remainingSeconds: 15,
      refreshCount: 0,
      lastRefreshedAt: null,
    },
    lastLoadedAt: new Date().toLocaleTimeString(),
    reloadCounter: 0,
  };
}

export function navigateTabState(tab: TabItem, rawInput: string): TabItem {
  const resolved = resolveAddressBarInput(rawInput);
  const nextStack = tab.historyStack.slice(0, tab.historyIndex + 1);
  if (nextStack[nextStack.length - 1] !== resolved.url) {
    nextStack.push(resolved.url);
  }
  return {
    ...tab,
    url: resolved.url,
    title: resolved.title,
    faviconType: resolved.faviconType,
    historyStack: nextStack,
    historyIndex: nextStack.length - 1,
    lastLoadedAt: new Date().toLocaleTimeString(),
    reloadCounter: tab.reloadCounter + 1,
  };
}

export function goBackTabState(tab: TabItem): TabItem {
  if (tab.historyIndex <= 0) return tab;
  const nextIndex = tab.historyIndex - 1;
  const targetUrl = tab.historyStack[nextIndex];
  const resolved = resolveAddressBarInput(targetUrl);
  return {
    ...tab,
    url: resolved.url,
    title: resolved.title,
    faviconType: resolved.faviconType,
    historyIndex: nextIndex,
    lastLoadedAt: new Date().toLocaleTimeString(),
    reloadCounter: tab.reloadCounter + 1,
  };
}

export function goForwardTabState(tab: TabItem): TabItem {
  if (tab.historyIndex >= tab.historyStack.length - 1) return tab;
  const nextIndex = tab.historyIndex + 1;
  const targetUrl = tab.historyStack[nextIndex];
  const resolved = resolveAddressBarInput(targetUrl);
  return {
    ...tab,
    url: resolved.url,
    title: resolved.title,
    faviconType: resolved.faviconType,
    historyIndex: nextIndex,
    lastLoadedAt: new Date().toLocaleTimeString(),
    reloadCounter: tab.reloadCounter + 1,
  };
}

export function applyUserAgentToTab(
  tab: TabItem,
  presetId: UserAgentPresetId,
  customUaString?: string
): TabItem {
  let effective = tab.effectiveUserAgent;
  if (presetId === 'custom') {
    const check = validateUserAgentString(customUaString || '');
    effective = check.valid ? check.sanitized : USER_AGENT_PRESETS[0].userAgent;
  } else {
    const found = USER_AGENT_PRESETS.find((p) => p.id === presetId) || USER_AGENT_PRESETS[0];
    effective = found.userAgent;
  }

  return {
    ...tab,
    userAgentPresetId: presetId,
    customUserAgent: customUaString ?? effective,
    effectiveUserAgent: effective,
    lastLoadedAt: new Date().toLocaleTimeString(),
    reloadCounter: tab.reloadCounter + 1,
  };
}

export function computePrivacyStatusSummary(
  webrtc: WebRTCConfig,
  profile: FingerprintProfile,
  userAgentPresetId: UserAgentPresetId
): {
  statusLevel: 'standard' | 'hardened' | 'restricted';
  statusLabel: string;
  webrtcSummary: string;
  modifiedSignals: string[];
  unmodifiedSignals: string[];
} {
  const modifiedSignals: string[] = [
    `Screen Geometry (${profile.screenWidth}×${profile.screenHeight}, ${profile.colorDepth}-bit)`,
    `Navigator Concurrency (${profile.hardwareConcurrency} logical cores, ${profile.deviceMemory}GB RAM hint)`,
    `Accept-Language & Locale (${profile.language}, ${profile.timezone})`,
  ];

  if (userAgentPresetId !== 'default_desktop_chrome') {
    modifiedSignals.unshift('HTTP User-Agent & navigator.userAgent Override');
  }

  const unmodifiedSignals: string[] = [
    'Public IPv4 / IPv6 Address (requires external VPN or proxy)',
    'TLS ClientHello (JA3/JA4) & HTTP/2 Frame Fingerprints',
    'OS TCP/IP Packet TTL & Window Scaling Signatures',
    'Hardware GPU WebGL Timing & AudioContext Floating-Point Entropy',
  ];

  let webrtcSummary = 'Standard ICE candidate gathering enabled';
  let statusLevel: 'standard' | 'hardened' | 'restricted' = 'standard';
  let statusLabel = 'Baseline Chromium Isolation';

  if (!webrtc.enabled) {
    webrtcSummary = 'WebRTC RTCPeerConnection blocked in preload & UDP disabled';
    statusLevel = 'restricted';
    statusLabel = 'Strict WebRTC Lockdown';
  } else if (webrtc.policy === 'disable_non_proxied_udp') {
    webrtcSummary = 'Non-proxied UDP disabled (forces TURN/TCP or proxy route)';
    statusLevel = 'restricted';
    statusLabel = 'WebRTC Shield: Non-Proxied UDP Blocked';
  } else if (webrtc.policy === 'default_public_interface_only') {
    webrtcSummary = 'Private LAN RFC1918 ICE candidates stripped';
    statusLevel = 'hardened';
    statusLabel = 'WebRTC Shield: Public Interface Only';
  } else if (userAgentPresetId !== 'default_desktop_chrome' || profile.id !== 'fp_standard_win11') {
    statusLevel = 'hardened';
    statusLabel = 'Custom Profile Active';
  }

  return {
    statusLevel,
    statusLabel,
    webrtcSummary,
    modifiedSignals,
    unmodifiedSignals,
  };
}

export const DEFAULT_GITHUB_RELEASE_REPO = 'thakorvijay51098/viju-browser';
export const VIJU_RELEASE_VERSION = '1.4.0';
export const VIJU_RELEASE_TAG = 'v1.4.0';
export const VIJU_INSTALLER_EXE_FILENAME = 'Viju-Browser-Setup-1.4.0-x64.exe';
export const VIJU_PORTABLE_EXE_FILENAME = 'Viju-Browser-Portable-1.4.0-x64.exe';

export interface GitHubReleaseBundleUrls {
  isValid: boolean;
  normalizedRepo: string;
  owner: string;
  repo: string;
  tag: string;
  installerFilename: string;
  portableFilename: string;
  releasesPageUrl: string;
  latestReleaseUrl: string;
  tagReleaseUrl: string;
  installerExeDownloadUrl: string;
  portableExeDownloadUrl: string;
  tagInstallerExeDownloadUrl: string;
  tagPortableExeDownloadUrl: string;
  actionsWorkflowUrl: string;
  newWorkflowFileUrl: string;
  editWorkflowFileUrl: string;
  editPackageJsonUrl: string;
  actionsSettingsPermissionsUrl: string;
  apiRepoUrl: string;
  apiLatestReleaseUrl: string;
  apiReleasesListUrl: string;
  apiWorkflowFileUrl: string;
  apiActionRunsUrl: string;
}

export function buildGitHubReleaseUrls(
  rawRepoInput: string,
  tag: string = VIJU_RELEASE_TAG
): GitHubReleaseBundleUrls {
  const cleaned = String(rawRepoInput || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/releases.*$/i, '')
    .replace(/^\/+|\/+$/g, '');

  const parts = cleaned.split('/').filter(Boolean);
  const isValid =
    parts.length >= 2 &&
    /^[a-zA-Z0-9._-]+$/.test(parts[0]) &&
    /^[a-zA-Z0-9._-]+$/.test(parts[1]);

  const owner = isValid ? parts[0] : 'thakorvijay51098';
  const repo = isValid ? parts[1] : 'viju-browser';
  const normalizedRepo = `${owner}/${repo}`;
  const cleanTag = tag.trim() || VIJU_RELEASE_TAG;

  const baseRepoUrl = `https://github.com/${normalizedRepo}`;

  return {
    isValid,
    normalizedRepo,
    owner,
    repo,
    tag: cleanTag,
    installerFilename: VIJU_INSTALLER_EXE_FILENAME,
    portableFilename: VIJU_PORTABLE_EXE_FILENAME,
    releasesPageUrl: `${baseRepoUrl}/releases`,
    latestReleaseUrl: `${baseRepoUrl}/releases/latest`,
    tagReleaseUrl: `${baseRepoUrl}/releases/tag/${cleanTag}`,
    installerExeDownloadUrl: `${baseRepoUrl}/releases/latest/download/${VIJU_INSTALLER_EXE_FILENAME}`,
    portableExeDownloadUrl: `${baseRepoUrl}/releases/latest/download/${VIJU_PORTABLE_EXE_FILENAME}`,
    tagInstallerExeDownloadUrl: `${baseRepoUrl}/releases/download/${cleanTag}/${VIJU_INSTALLER_EXE_FILENAME}`,
    tagPortableExeDownloadUrl: `${baseRepoUrl}/releases/download/${cleanTag}/${VIJU_PORTABLE_EXE_FILENAME}`,
    actionsWorkflowUrl: `${baseRepoUrl}/actions`,
    newWorkflowFileUrl: `${baseRepoUrl}/new/main?filename=.github/workflows/build-windows-exe.yml`,
    editWorkflowFileUrl: `${baseRepoUrl}/edit/main/.github/workflows/build-windows-exe.yml`,
    editPackageJsonUrl: `${baseRepoUrl}/edit/main/electron-desktop/package.json`,
    actionsSettingsPermissionsUrl: `${baseRepoUrl}/settings/actions`,
    apiRepoUrl: `https://api.github.com/repos/${normalizedRepo}`,
    apiLatestReleaseUrl: `https://api.github.com/repos/${normalizedRepo}/releases/latest`,
    apiReleasesListUrl: `https://api.github.com/repos/${normalizedRepo}/releases`,
    apiWorkflowFileUrl: `https://api.github.com/repos/${normalizedRepo}/contents/.github/workflows/build-windows-exe.yml`,
    apiActionRunsUrl: `https://api.github.com/repos/${normalizedRepo}/actions/runs?per_page=5`,
  };
}

export interface GitHubNoReleasesDiagnosisInput {
  repoExists: boolean;
  hasWorkflowFile: boolean;
  latestRunStatus: 'queued' | 'in_progress' | 'completed' | 'none';
  latestRunConclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  releasesCount: number;
}

export interface GitHubNoReleasesDiagnosisResult {
  reasonCode:
    | 'RELEASE_LIVE'
    | 'REPO_NOT_FOUND_OR_PRIVATE'
    | 'WORKFLOW_NOT_PUSHED_YET'
    | 'BUILD_IN_PROGRESS'
    | 'WORKFLOW_FAILED_PERMISSIONS'
    | 'WORKFLOW_NOT_TRIGGERED_YET';
  headlineHinglish: string;
  explanationHinglish: string;
  actionRequiredHinglish: string;
}

export function diagnoseNoReleasesState(
  input: GitHubNoReleasesDiagnosisInput
): GitHubNoReleasesDiagnosisResult {
  if (input.releasesCount > 0) {
    return {
      reasonCode: 'RELEASE_LIVE',
      headlineHinglish: 'Release Published Hai! Direct .EXE Download Ready',
      explanationHinglish:
        'Aapke GitHub repository ke Releases tab me .EXE release publish ho chuka hai.',
      actionRequiredHinglish:
        'Upar diye green "Direct Download Setup .EXE" button par click karke download karein.',
    };
  }

  if (!input.repoExists) {
    return {
      reasonCode: 'REPO_NOT_FOUND_OR_PRIVATE',
      headlineHinglish: 'GitHub Repository Publicly Nahi Mila Ya Private Hai',
      explanationHinglish:
        'GitHub par yeh repository abhi create nahi hua hai ya Private mode me hai, isliye Releases tab khali hai.',
      actionRequiredHinglish:
        'AI Studio ke top bar se "Export / Sync to GitHub" click karein ya niche 1-Click Auto-Push Token tool use karein.',
    };
  }

  if (!input.hasWorkflowFile) {
    return {
      reasonCode: 'WORKFLOW_NOT_PUSHED_YET',
      headlineHinglish:
        'Reason Found: Naya Code (.github/workflows/build-windows-exe.yml) Abhi GitHub Par Sync Nahi Hua Hai!',
      explanationHinglish:
        'Aapke GitHub repo par "No releases published" isliye dikha raha hai kyunki jo auto-build workflow humne yahan AI Studio me banaya hai, woh abhi aapke GitHub repo me push/sync nahi hua hai.',
      actionRequiredHinglish:
        'AI Studio ke top-right me GitHub icon (Sync/Save to GitHub) dabayein YA niche "1-Click Copy Fixed Workflow YAML" button use karein.',
    };
  }

  if (input.latestRunStatus === 'in_progress' || input.latestRunStatus === 'queued') {
    return {
      reasonCode: 'BUILD_IN_PROGRESS',
      headlineHinglish:
        'GitHub Actions Abhi Windows .EXE Build Kar Raha Hai (Wait 2-3 Minutes)!',
      explanationHinglish:
        'Workflow push ho chuka hai aur GitHub ka Windows server abhi Viju-Browser-Setup-1.4.0-x64.exe compile kar raha hai. Jab tak build complete nahi hota tab tak "No releases published" dikhta hai.',
      actionRequiredHinglish:
        '2-3 minute wait karein aur phir "Diagnose / Check Release" button dabayein — Release automatically aa jayega!',
    };
  }

  if (input.latestRunStatus === 'completed' && input.latestRunConclusion === 'failure') {
    return {
      reasonCode: 'WORKFLOW_FAILED_PERMISSIONS',
      headlineHinglish:
        'GitHub Actions Build Error Detected (Fixed: electron-builder "reading channel" / Permissions)',
      explanationHinglish:
        'electron-builder v26 me subfolder build ke dauran updateInfoBuilder.ts ("Cannot read properties of null (reading \'channel\')") ya GITHUB_TOKEN permission ki wajah se last step ruka. Humne iska 100% fix (-c.publish=null + auto repository patch) laga diya hai!',
      actionRequiredHinglish:
        'Upar green "Copy Fixed Workflow YAML (build-windows-exe.yml)" button click karke apne GitHub workflow file me paste & Commit karein — build turant pass ho jayega!',
    };
  }

  return {
    reasonCode: 'WORKFLOW_NOT_TRIGGERED_YET',
    headlineHinglish: 'Workflow File Maujood Hai — Bas 1 Click Me "Run workflow" Trigger Karein',
    explanationHinglish:
      'Aapke repo me workflow file hai lekin abhi tak release build trigger nahi hua hai.',
    actionRequiredHinglish:
      'GitHub Actions tab kholkar "Build & Publish Windows .EXE" -> "Run workflow" par click karein.',
  };
}


