import {
  CustomUserAgentItem,
  GeneratedUAProfile,
  RandomUASwitcherConfig,
  UABlacklistRule,
  UABrowserFamily,
  UAGeneratorComboKey,
  UAGeneratorToggles,
  UAOsFamily,
} from '../types/browser';
import { extractHostnameFromUrl } from './fingerprintEngine';

export interface UAGeneratorComboDefinition {
  key: UAGeneratorComboKey;
  label: string;
  browserFamily: UABrowserFamily;
  osFamily: UAOsFamily;
  defaultEnabled: boolean;
  platform: string;
  vendor: string;
  oscpu?: string;
  mobile: boolean;
  userAgents: string[];
}

export const NATIVE_BASELINE_UA_PROFILE: GeneratedUAProfile = {
  id: 'ua-native-baseline',
  comboKey: 'native',
  label: 'Native Chromium Baseline (Switching Bypassed)',
  browserFamily: 'chrome',
  osFamily: 'windows',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  appVersion:
    '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  platform: 'Win32',
  vendor: 'Google Inc.',
  mobile: false,
};

export const UA_GENERATOR_COMBINATIONS: UAGeneratorComboDefinition[] = [
  // === 9 ENABLED BY DEFAULT ===
  {
    key: 'chrome_macos',
    label: 'Chrome on macOS',
    browserFamily: 'chrome',
    osFamily: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.45 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.127 Safari/537.36',
    ],
  },
  {
    key: 'chrome_windows',
    label: 'Chrome on Windows',
    browserFamily: 'chrome',
    osFamily: 'windows',
    defaultEnabled: true,
    platform: 'Win32',
    vendor: 'Google Inc.',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.88 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.98 Safari/537.36',
    ],
  },
  {
    key: 'edge_macos',
    label: 'Edge on macOS',
    browserFamily: 'edge',
    osFamily: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.3124.51',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.3065.82',
    ],
  },
  {
    key: 'edge_windows',
    label: 'Edge on Windows',
    browserFamily: 'edge',
    osFamily: 'windows',
    defaultEnabled: true,
    platform: 'Win32',
    vendor: 'Google Inc.',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.3124.66',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.3065.92',
    ],
  },
  {
    key: 'firefox_macos',
    label: 'Firefox on macOS',
    browserFamily: 'firefox',
    osFamily: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: '',
    oscpu: 'Intel Mac OS X 10.15',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:134.0) Gecko/20100101 Firefox/134.0',
    ],
  },
  {
    key: 'firefox_windows',
    label: 'Firefox on Windows',
    browserFamily: 'firefox',
    osFamily: 'windows',
    defaultEnabled: true,
    platform: 'Win32',
    vendor: '',
    oscpu: 'Windows NT 10.0; Win64; x64',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
    ],
  },
  {
    key: 'opera_macos',
    label: 'Opera on macOS',
    browserFamily: 'opera',
    osFamily: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 OPR/117.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 OPR/116.0.5366.71',
    ],
  },
  {
    key: 'opera_windows',
    label: 'Opera on Windows',
    browserFamily: 'opera',
    osFamily: 'windows',
    defaultEnabled: true,
    platform: 'Win32',
    vendor: 'Google Inc.',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 OPR/117.0.0.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 OPR/116.0.5366.118',
    ],
  },
  {
    key: 'safari_macos',
    label: 'Safari on macOS',
    browserFamily: 'safari',
    osFamily: 'macos',
    defaultEnabled: true,
    platform: 'MacIntel',
    vendor: 'Apple Computer, Inc.',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
    ],
  },

  // === 5 DISABLED BY DEFAULT ===
  {
    key: 'chrome_android',
    label: 'Chrome on Android',
    browserFamily: 'chrome',
    osFamily: 'android',
    defaultEnabled: false,
    platform: 'Linux armv81',
    vendor: 'Google Inc.',
    mobile: true,
    userAgents: [
      'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.45 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.89 Mobile Safari/537.36',
    ],
  },
  {
    key: 'chrome_linux',
    label: 'Chrome on Linux',
    browserFamily: 'chrome',
    osFamily: 'linux',
    defaultEnabled: false,
    platform: 'Linux x86_64',
    vendor: 'Google Inc.',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.35 Safari/537.36',
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.112 Safari/537.36',
    ],
  },
  {
    key: 'firefox_android',
    label: 'Firefox on Android',
    browserFamily: 'firefox',
    osFamily: 'android',
    defaultEnabled: false,
    platform: 'Linux armv81',
    vendor: '',
    oscpu: 'Linux armv81',
    mobile: true,
    userAgents: [
      'Mozilla/5.0 (Android 15; Mobile; rv:135.0) Gecko/135.0 Firefox/135.0',
      'Mozilla/5.0 (Android 14; Mobile; rv:134.0) Gecko/134.0 Firefox/134.0',
    ],
  },
  {
    key: 'firefox_linux',
    label: 'Firefox on Linux',
    browserFamily: 'firefox',
    osFamily: 'linux',
    defaultEnabled: false,
    platform: 'Linux x86_64',
    vendor: '',
    oscpu: 'Linux x86_64',
    mobile: false,
    userAgents: [
      'Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0',
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
    ],
  },
  {
    key: 'safari_iphone',
    label: 'Safari on iPhone',
    browserFamily: 'safari',
    osFamily: 'ios',
    defaultEnabled: false,
    platform: 'iPhone',
    vendor: 'Apple Computer, Inc.',
    mobile: true,
    userAgents: [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
    ],
  },
];

export const DEFAULT_CUSTOM_USER_AGENTS: CustomUserAgentItem[] = [
  {
    id: 'cua-1',
    label: 'Hardened Windows 11 Chrome 134',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.90 Safari/537.36',
    browserFamily: 'chrome',
    osFamily: 'windows',
    appVersion:
      '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.90 Safari/537.36',
    platform: 'Win32',
    vendor: 'Google Inc.',
  },
  {
    id: 'cua-2',
    label: 'macOS Sequoia Safari 18.3',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
    browserFamily: 'safari',
    osFamily: 'macos',
    appVersion:
      '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
    platform: 'MacIntel',
    vendor: 'Apple Computer, Inc.',
  },
  {
    id: 'cua-3',
    label: 'Firefox 135 ESR Workstation',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    browserFamily: 'firefox',
    osFamily: 'windows',
    appVersion: '5.0 (Windows)',
    platform: 'Win32',
    vendor: '',
  },
];

export const DEFAULT_UA_BLACKLIST_RULES: UABlacklistRule[] = [
  {
    id: 'uabl-1',
    domain: 'accounts.google.com',
    enabled: true,
    note: 'Preserve native browser UA during OAuth security key challenges.',
    createdAt: '2026-11-03',
  },
  {
    id: 'uabl-2',
    domain: 'intranet.corp.local',
    enabled: true,
    note: 'Internal corporate SSO portal exception.',
    createdAt: '2026-11-03',
  },
];

export function deriveAppVersionFromUA(ua: string, browserFamily: UABrowserFamily): string {
  if (browserFamily === 'firefox') {
    if (/Windows/i.test(ua)) return '5.0 (Windows)';
    if (/Macintosh/i.test(ua)) return '5.0 (Macintosh)';
    if (/Android/i.test(ua)) return '5.0 (Android 15)';
    return '5.0 (X11)';
  }
  return ua.replace(/^Mozilla\//i, '');
}

export function inferBrowserAndOsFromUAString(ua: string): {
  browserFamily: UABrowserFamily;
  osFamily: UAOsFamily;
  platform: string;
  vendor: string;
} {
  const browserFamily: UABrowserFamily = /OPR\/|Opera/i.test(ua)
    ? 'opera'
    : /Edg\//i.test(ua)
    ? 'edge'
    : /Firefox\//i.test(ua)
    ? 'firefox'
    : /Safari\//i.test(ua) && !/Chrome\/|Chromium\//i.test(ua)
    ? 'safari'
    : 'chrome';

  const osFamily: UAOsFamily = /Android/i.test(ua)
    ? 'android'
    : /iPhone|iPad|iPod/i.test(ua)
    ? 'ios'
    : /Macintosh|Mac OS X/i.test(ua)
    ? 'macos'
    : /Linux/i.test(ua)
    ? 'linux'
    : 'windows';

  const platform =
    osFamily === 'macos'
      ? 'MacIntel'
      : osFamily === 'android'
      ? 'Linux armv81'
      : osFamily === 'linux'
      ? 'Linux x86_64'
      : osFamily === 'ios'
      ? 'iPhone'
      : 'Win32';

  const vendor =
    browserFamily === 'firefox'
      ? ''
      : browserFamily === 'safari'
      ? 'Apple Computer, Inc.'
      : 'Google Inc.';

  return { browserFamily, osFamily, platform, vendor };
}

/**
 * Returns the 14 Generator Settings toggles with exact required default states:
 * 9 enabled by default, 5 disabled by default.
 */
export function createDefaultUAGeneratorToggles(): UAGeneratorToggles {
  const toggles = {} as UAGeneratorToggles;
  for (const def of UA_GENERATOR_COMBINATIONS) {
    toggles[def.key] = def.defaultEnabled;
  }
  return toggles;
}

export function buildGeneratedProfileFromDefinition(
  def: UAGeneratorComboDefinition,
  variantIndex = 0
): GeneratedUAProfile {
  const ua = def.userAgents[variantIndex % def.userAgents.length];
  return {
    id: `gen-${def.key}-${variantIndex}`,
    comboKey: def.key,
    label: def.label,
    browserFamily: def.browserFamily,
    osFamily: def.osFamily,
    userAgent: ua,
    appVersion: deriveAppVersionFromUA(ua, def.browserFamily),
    platform: def.platform,
    vendor: def.vendor,
    oscpu: def.oscpu,
    mobile: def.mobile,
  };
}

export function createDefaultRandomUASwitcherConfig(
  performStartupRotation = false
): RandomUASwitcherConfig {
  const generatorToggles = createDefaultUAGeneratorToggles();
  const initialCombo =
    UA_GENERATOR_COMBINATIONS.find((c) => c.key === 'chrome_windows') ||
    UA_GENERATOR_COMBINATIONS[0];
  const initialProfile = buildGeneratedProfileFromDefinition(initialCombo, 0);

  const baseConfig: RandomUASwitcherConfig = {
    enabledGlobally: true,
    paused: false,
    autoRotateEnabled: false,
    autoRotateIntervalSeconds: 60,
    remainingSeconds: 60,
    rotateOnStartup: true,
    jsProtectionEnabled: true,
    syncWithOs: true,
    selectedBrowserFamily: initialProfile.browserFamily,
    selectedOsFamily: initialProfile.osFamily,
    useCustomAgentsMode: false,
    customAgentsList: DEFAULT_CUSTOM_USER_AGENTS,
    activeCustomAgentId: DEFAULT_CUSTOM_USER_AGENTS[0].id,
    generatorToggles,
    blacklistDomains: DEFAULT_UA_BLACKLIST_RULES,
    activeGeneratedProfile: initialProfile,
    rotationCount: 0,
    lastRotatedAt: null,
  };

  if (performStartupRotation && baseConfig.rotateOnStartup) {
    const rotated = generateNextUserAgentProfile(baseConfig);
    if (rotated.ok && rotated.profile) {
      return {
        ...baseConfig,
        activeGeneratedProfile: rotated.profile,
        selectedBrowserFamily: rotated.profile.browserFamily,
        selectedOsFamily: rotated.profile.osFamily,
        rotationCount: 1,
        lastRotatedAt: new Date().toLocaleTimeString(),
      };
    }
  }

  return baseConfig;
}

/**
 * Generates a new User-Agent profile from the enabled Generator Settings combinations
 * (or from the user's Custom User-Agent list when custom mode is enabled).
 * Never selects a disabled combination.
 */
export function generateNextUserAgentProfile(
  config: RandomUASwitcherConfig,
  options?: {
    preferredBrowser?: UABrowserFamily;
    preferredOs?: UAOsFamily;
    deterministicIndex?: number;
  }
): {
  ok: boolean;
  profile?: GeneratedUAProfile;
  error?: string;
} {
  const currentUa = config.activeGeneratedProfile.userAgent;

  // 1. Custom User-Agent mode
  if (config.useCustomAgentsMode) {
    if (config.customAgentsList.length === 0) {
      return {
        ok: false,
        error: 'Custom User-Agent mode is enabled, but the custom User-Agent list is empty.',
      };
    }
    const candidates =
      config.customAgentsList.length > 1
        ? config.customAgentsList.filter((c) => c.userAgent !== currentUa)
        : config.customAgentsList;
    const pool = candidates.length > 0 ? candidates : config.customAgentsList;
    const pickIdx =
      typeof options?.deterministicIndex === 'number'
        ? options.deterministicIndex % pool.length
        : Math.floor(Math.random() * pool.length);
    const chosen = pool[pickIdx];
    return {
      ok: true,
      profile: {
        id: chosen.id,
        comboKey: 'custom',
        label: `Custom: ${chosen.label}`,
        browserFamily: chosen.browserFamily,
        osFamily: chosen.osFamily,
        userAgent: chosen.userAgent,
        appVersion: chosen.appVersion,
        platform: chosen.platform,
        vendor: chosen.vendor,
        mobile: chosen.osFamily === 'android' || chosen.osFamily === 'ios',
      },
    };
  }

  // 2. Standard Generator Mode: strictly filter to enabled combinations only
  const enabledCombos = UA_GENERATOR_COMBINATIONS.filter(
    (c) => config.generatorToggles[c.key] === true
  );

  if (enabledCombos.length === 0) {
    return {
      ok: false,
      error:
        'No Browser/OS combinations are enabled in Generator Settings. Enable at least one combination.',
    };
  }

  let filteredCombos = enabledCombos;

  if (options?.preferredBrowser && options?.preferredOs) {
    const exactMatch = enabledCombos.filter(
      (c) =>
        c.browserFamily === options.preferredBrowser &&
        c.osFamily === options.preferredOs
    );
    if (exactMatch.length === 0) {
      return {
        ok: false,
        error: `${options.preferredBrowser.toUpperCase()} on ${options.preferredOs.toUpperCase()} is either disabled in Generator Settings or not a supported combination.`,
      };
    }
    filteredCombos = exactMatch;
  } else if (options?.preferredBrowser) {
    const browserMatches = enabledCombos.filter(
      (c) =>
        c.browserFamily === options.preferredBrowser &&
        (!config.syncWithOs || c.osFamily === config.selectedOsFamily)
    );
    const fallbackBrowserMatches = enabledCombos.filter(
      (c) => c.browserFamily === options.preferredBrowser
    );
    if (browserMatches.length > 0) {
      filteredCombos = browserMatches;
    } else if (fallbackBrowserMatches.length > 0) {
      filteredCombos = fallbackBrowserMatches;
    } else {
      return {
        ok: false,
        error: `No enabled Generator profiles found for ${options.preferredBrowser.toUpperCase()}. Enable it in Generator Settings first.`,
      };
    }
  } else if (options?.preferredOs) {
    const osMatches = enabledCombos.filter((c) => c.osFamily === options.preferredOs);
    if (osMatches.length > 0) {
      filteredCombos = osMatches;
    } else {
      return {
        ok: false,
        error: `No enabled Generator profiles found for ${options.preferredOs.toUpperCase()}. Enable ${options.preferredOs.toUpperCase()} profiles in Generator Settings first.`,
      };
    }
  } else if (config.syncWithOs) {
    const syncedMatches = enabledCombos.filter(
      (c) => c.osFamily === config.selectedOsFamily
    );
    if (syncedMatches.length > 0) {
      filteredCombos = syncedMatches;
    }
  }

  // Expand all candidate profiles across the filtered combinations
  const allCandidateProfiles: GeneratedUAProfile[] = [];
  for (const combo of filteredCombos) {
    for (let i = 0; i < combo.userAgents.length; i++) {
      allCandidateProfiles.push(buildGeneratedProfileFromDefinition(combo, i));
    }
  }

  // Exclude the currently active UA string so "Get New Agent" always changes the active UA
  const distinctCandidates = allCandidateProfiles.filter(
    (p) => p.userAgent !== currentUa
  );
  const finalPool =
    distinctCandidates.length > 0 ? distinctCandidates : allCandidateProfiles;

  const pickIdx =
    typeof options?.deterministicIndex === 'number'
      ? options.deterministicIndex % finalPool.length
      : Math.floor(Math.random() * finalPool.length);

  return {
    ok: true,
    profile: finalPool[pickIdx],
  };
}

/**
 * Checks if a URL or domain matches an active Blacklist rule (supports exact domain & subdomains).
 */
export function isDomainBlacklistedForUA(
  urlOrDomain: string,
  blacklist: UABlacklistRule[]
): {
  blacklisted: boolean;
  matchedRule?: UABlacklistRule;
  hostname: string;
} {
  const hostname = extractHostnameFromUrl(urlOrDomain);
  if (!hostname) {
    return { blacklisted: false, hostname: '' };
  }

  for (const rule of blacklist) {
    if (!rule.enabled) continue;
    const ruleDomain = rule.domain.trim().toLowerCase();
    if (!ruleDomain) continue;

    if (hostname === ruleDomain || hostname.endsWith(`.${ruleDomain}`)) {
      return {
        blacklisted: true,
        matchedRule: rule,
        hostname,
      };
    }
  }

  return { blacklisted: false, hostname };
}

/**
 * Toggles User-Agent switching for a specific domain by adding/removing or enabling/disabling
 * its entry in the Blacklist.
 */
export function toggleDomainInUABlacklist(
  urlOrDomain: string,
  blacklist: UABlacklistRule[]
): {
  nextBlacklist: UABlacklistRule[];
  isSwitchingEnabledOnDomain: boolean;
  hostname: string;
} {
  const hostname = extractHostnameFromUrl(urlOrDomain) || 'home';
  const check = isDomainBlacklistedForUA(hostname, blacklist);

  if (check.blacklisted && check.matchedRule) {
    // Domain was blacklisted -> remove or disable the matching rule to enable switching on this domain
    const nextBlacklist = blacklist.filter((r) => r.id !== check.matchedRule!.id);
    return {
      nextBlacklist,
      isSwitchingEnabledOnDomain: true,
      hostname,
    };
  }

  // Domain was enabled -> add a blacklist rule to disable switching on this domain
  const newRule: UABlacklistRule = {
    id: `uabl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    domain: hostname,
    enabled: true,
    note: 'Disabled via Active User-Agent Popup domain switch',
    createdAt: new Date().toISOString().slice(0, 10),
  };

  return {
    nextBlacklist: [newRule, ...blacklist],
    isSwitchingEnabledOnDomain: false,
    hostname,
  };
}

/**
 * Resolves the effective User-Agent profile for a given tab URL, respecting:
 * 1. Global Switcher enablement (`enabledGlobally`)
 * 2. Per-domain Blacklist rules (exact & subdomain matching)
 * 3. Active Generated or Custom User-Agent profile
 */
export function resolveEffectiveUserAgentForUrl(
  url: string,
  config: RandomUASwitcherConfig
): {
  effectiveProfile: GeneratedUAProfile;
  isSwitchingActiveOnDomain: boolean;
  statusReason: string;
} {
  if (!config.enabledGlobally) {
    return {
      effectiveProfile: NATIVE_BASELINE_UA_PROFILE,
      isSwitchingActiveOnDomain: false,
      statusReason: 'Global User-Agent Switcher is disabled',
    };
  }

  const bl = isDomainBlacklistedForUA(url, config.blacklistDomains);
  if (bl.blacklisted && bl.matchedRule) {
    return {
      effectiveProfile: NATIVE_BASELINE_UA_PROFILE,
      isSwitchingActiveOnDomain: false,
      statusReason: `Bypassed on ${bl.hostname} (matches blacklist rule "${bl.matchedRule.domain}")`,
    };
  }

  return {
    effectiveProfile: config.activeGeneratedProfile,
    isSwitchingActiveOnDomain: true,
    statusReason: config.paused
      ? `Active (${config.activeGeneratedProfile.label} — Auto-Rotation Paused)`
      : `Active (${config.activeGeneratedProfile.label})`,
  };
}

/**
 * Advances the automatic User-Agent rotation timer by 1 second.
 * When `paused` is true, stops automatic rotation without disabling the active profile.
 */
export function tickAutoRotateUASwitcher(config: RandomUASwitcherConfig): {
  nextConfig: RandomUASwitcherConfig;
  didRotate: boolean;
} {
  if (!config.enabledGlobally || !config.autoRotateEnabled || config.paused) {
    return { nextConfig: config, didRotate: false };
  }

  const nextRemaining = config.remainingSeconds - 1;
  if (nextRemaining > 0) {
    return {
      nextConfig: {
        ...config,
        remainingSeconds: nextRemaining,
      },
      didRotate: false,
    };
  }

  const generated = generateNextUserAgentProfile(config);
  const safeInterval = Math.max(5, config.autoRotateIntervalSeconds || 60);

  if (!generated.ok || !generated.profile) {
    return {
      nextConfig: {
        ...config,
        remainingSeconds: safeInterval,
      },
      didRotate: false,
    };
  }

  return {
    nextConfig: {
      ...config,
      activeGeneratedProfile: generated.profile,
      selectedBrowserFamily: generated.profile.browserFamily,
      selectedOsFamily: generated.profile.osFamily,
      remainingSeconds: safeInterval,
      rotationCount: config.rotationCount + 1,
      lastRotatedAt: new Date().toLocaleTimeString(),
    },
    didRotate: true,
  };
}
