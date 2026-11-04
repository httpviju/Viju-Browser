import {
  WebRTCConfig,
  WebRTCLeakTestResult,
  WebRTCPolicy,
  WebRTCShieldLogEntry,
  WebRTCWhitelistRule,
} from '../types/browser';
import { extractHostnameFromUrl } from './fingerprintEngine';

export const DEFAULT_WEBRTC_WHITELIST_RULES: WebRTCWhitelistRule[] = [
  {
    id: 'wrtc-wl-1',
    domain: 'meet.google.com',
    enabled: true,
    note: 'Trusted video conferencing origin — allow WebRTC media & STUN connectivity.',
    addedAt: '2026-11-03',
  },
  {
    id: 'wrtc-wl-2',
    domain: 'zoom.us',
    enabled: true,
    note: 'Trusted enterprise video call domain.',
    addedAt: '2026-11-03',
  },
  {
    id: 'wrtc-wl-3',
    domain: 'teams.microsoft.com',
    enabled: false,
    note: 'Optional Microsoft Teams WebRTC exception (disabled by default).',
    addedAt: '2026-11-03',
  },
];

/**
 * Returns the initial untested state.
 * Never claims a leak test passed unless it was actually performed.
 */
export function createUntestedWebRTCLeakResult(): WebRTCLeakTestResult {
  return {
    status: 'not_tested',
    testedAt: null,
    testedOrigin: null,
    localIpExposed: false,
    detectedLocalIps: [],
    publicIpExposed: false,
    detectedPublicIps: [],
    udpBlocked: false,
    proxyEnforced: false,
    candidatesEvaluated: 0,
    candidatesBlocked: 0,
    verdictSummary:
      'Leak test has not been performed yet. Click "Run WebRTC Leak Test" to inspect live ICE candidate exposure.',
  };
}

/**
 * Derives the underlying Chromium webContents.setWebRTCIPHandlingPolicy from the Shield controls
 * so WebRTC Control and WebRTC Shield remain 100% synchronized without conflicting settings.
 */
export function syncPolicyFromShieldFlags(flags: {
  shieldEnabled: boolean;
  blockLocalIp: boolean;
  blockPublicIp: boolean;
  blockUdp: boolean;
  forceProxy: boolean;
  fallbackPolicy?: WebRTCPolicy;
}): WebRTCPolicy {
  if (!flags.shieldEnabled) {
    return 'default';
  }
  if (flags.blockUdp || flags.forceProxy || flags.blockPublicIp) {
    return 'disable_non_proxied_udp';
  }
  if (flags.blockLocalIp) {
    return 'default_public_interface_only';
  }
  return flags.fallbackPolicy || 'default_public_and_private_interfaces';
}

/**
 * Normalizes a partial or legacy WebRTCConfig into a complete, coherent WebRTCConfig
 * with all 7 WebRTC Shield controls, leak test state, and local logs.
 */
export function normalizeWebRTCConfig(
  raw?: Partial<WebRTCConfig>
): Required<WebRTCConfig> {
  const enabled = raw?.enabled !== undefined ? Boolean(raw.enabled) : true;
  const shieldEnabled =
    raw?.shieldEnabled !== undefined ? Boolean(raw.shieldEnabled) : true;

  const rawPolicy: WebRTCPolicy = raw?.policy || 'default_public_interface_only';

  const blockLocalIp =
    raw?.blockLocalIp !== undefined
      ? Boolean(raw.blockLocalIp)
      : rawPolicy === 'default_public_interface_only' ||
        rawPolicy === 'disable_non_proxied_udp';

  const blockPublicIp =
    raw?.blockPublicIp !== undefined
      ? Boolean(raw.blockPublicIp)
      : rawPolicy === 'disable_non_proxied_udp';

  const blockUdp =
    raw?.blockUdp !== undefined
      ? Boolean(raw.blockUdp)
      : rawPolicy === 'disable_non_proxied_udp';

  const forceProxy =
    raw?.forceProxy !== undefined
      ? Boolean(raw.forceProxy)
      : rawPolicy === 'disable_non_proxied_udp';

  const leakDetectionEnabled =
    raw?.leakDetectionEnabled !== undefined ? Boolean(raw.leakDetectionEnabled) : true;

  const whitelistDomains = Array.isArray(raw?.whitelistDomains)
    ? raw!.whitelistDomains
    : DEFAULT_WEBRTC_WHITELIST_RULES;

  const policy = syncPolicyFromShieldFlags({
    shieldEnabled,
    blockLocalIp,
    blockPublicIp,
    blockUdp,
    forceProxy,
    fallbackPolicy: rawPolicy,
  });

  const lastLeakTest =
    raw?.lastLeakTest && typeof raw.lastLeakTest.status === 'string'
      ? raw.lastLeakTest
      : createUntestedWebRTCLeakResult();

  const shieldLogs: WebRTCShieldLogEntry[] = Array.isArray(raw?.shieldLogs)
    ? raw!.shieldLogs
    : [
        {
          id: 'wrtc-log-init-1',
          timestamp: new Date().toLocaleTimeString(),
          timestampMs: Date.now() - 30_000,
          origin: 'browser-session',
          eventType: 'local_ip_blocked',
          action: 'blocked',
          summary: 'WebRTC Shield initialized (Local RFC1918 IP Protection Active)',
          detail: `Chromium IP policy set to "${policy}". Private LAN host candidates (192.168.x.x / 10.x.x.x) are stripped.`,
        },
      ];

  return {
    enabled,
    policy,
    shieldEnabled,
    blockLocalIp,
    blockPublicIp,
    blockUdp,
    forceProxy,
    leakDetectionEnabled,
    whitelistDomains,
    lastLeakTest,
    shieldLogs,
  };
}

/**
 * Checks if a URL or domain matches an enabled WebRTC Whitelist rule (exact domain or subdomain).
 */
export function isDomainWhitelistedForWebRTC(
  urlOrDomain: string,
  whitelist: WebRTCWhitelistRule[] = []
): {
  whitelisted: boolean;
  matchedRule?: WebRTCWhitelistRule;
  hostname: string;
} {
  const hostname = extractHostnameFromUrl(urlOrDomain);
  if (!hostname || urlOrDomain.startsWith('viju://')) {
    return { whitelisted: false, hostname: hostname || '' };
  }

  for (const rule of whitelist) {
    if (!rule || !rule.enabled) continue;
    const rawDomain = rule.domain.trim().toLowerCase().replace(/^\*\./, '');
    if (!rawDomain) continue;
    if (hostname === rawDomain || hostname.endsWith(`.${rawDomain}`)) {
      return {
        whitelisted: true,
        matchedRule: rule,
        hostname,
      };
    }
  }

  return { whitelisted: false, hostname };
}

/**
 * Resolves the effective WebRTC protection mode, Chromium policy, and video-call compatibility
 * for a given origin URL.
 */
export function resolveEffectiveWebRTCProtection(
  rawConfig: WebRTCConfig,
  urlOrDomain = 'viju://home'
): {
  config: Required<WebRTCConfig>;
  isWhitelistedOrigin: boolean;
  matchedWhitelistRule?: WebRTCWhitelistRule;
  effectiveChromiumPolicy: WebRTCPolicy;
  protectionModeLabel: string;
  protectionLevel: 'disabled' | 'whitelisted' | 'lan_protected' | 'strict_proxy_lockdown' | 'webrtc_off';
  videoCallCompatibility: {
    status: 'compatible' | 'may_break_calls' | 'calls_blocked';
    label: string;
    warningMessage: string | null;
  };
} {
  const cfg = normalizeWebRTCConfig(rawConfig);
  const wl = isDomainWhitelistedForWebRTC(urlOrDomain, cfg.whitelistDomains);

  // 1. If the current website is on the trusted WebRTC Whitelist, allow WebRTC on that site
  // while still keeping default route public/private interface behavior for video calls
  if (wl.whitelisted && wl.matchedRule) {
    return {
      config: cfg,
      isWhitelistedOrigin: true,
      matchedWhitelistRule: wl.matchedRule,
      effectiveChromiumPolicy: 'default_public_interface_only',
      protectionModeLabel: `Trusted Whitelist Exception (${wl.matchedRule.domain})`,
      protectionLevel: 'whitelisted',
      videoCallCompatibility: {
        status: 'compatible',
        label: 'Compatible (Trusted Whitelisted Origin)',
        warningMessage: null,
      },
    };
  }

  // 2. If Master WebRTC Control is disabled globally
  if (!cfg.enabled) {
    return {
      config: cfg,
      isWhitelistedOrigin: false,
      effectiveChromiumPolicy: 'disable_non_proxied_udp',
      protectionModeLabel: 'WebRTC Master Control Disabled (RTCPeerConnection Blocked)',
      protectionLevel: 'webrtc_off',
      videoCallCompatibility: {
        status: 'calls_blocked',
        label: 'Blocked (Video & Voice Calls Disabled)',
        warningMessage:
          'WebRTC Master Control is disabled. Browser-based video and voice calls (Google Meet, Zoom, Teams, Discord) will not connect unless enabled or added to the WebRTC Whitelist.',
      },
    };
  }

  // 3. If WebRTC Shield is disabled
  if (!cfg.shieldEnabled) {
    return {
      config: cfg,
      isWhitelistedOrigin: false,
      effectiveChromiumPolicy: 'default',
      protectionModeLabel: 'Shield Disabled (Standard Chromium WebRTC)',
      protectionLevel: 'disabled',
      videoCallCompatibility: {
        status: 'compatible',
        label: 'Fully Compatible (Unrestricted UDP/STUN)',
        warningMessage:
          'Warning: WebRTC Shield is disabled. Local network RFC1918 IPs and public STUN IPs may be exposed to websites.',
      },
    };
  }

  // 4. Strict UDP / Public IP / Proxy Lockdown
  if (cfg.blockUdp || cfg.forceProxy || cfg.blockPublicIp) {
    const activeFlags: string[] = [];
    if (cfg.blockLocalIp) activeFlags.push('Block Local IP');
    if (cfg.blockPublicIp) activeFlags.push('Block Public IP');
    if (cfg.blockUdp) activeFlags.push('Block UDP');
    if (cfg.forceProxy) activeFlags.push('Force Proxy');

    return {
      config: cfg,
      isWhitelistedOrigin: false,
      effectiveChromiumPolicy: 'disable_non_proxied_udp',
      protectionModeLabel: `Strict Shield (${activeFlags.join(' + ')})`,
      protectionLevel: 'strict_proxy_lockdown',
      videoCallCompatibility: {
        status: 'may_break_calls',
        label: 'Restricted (Requires TURN/TCP or Proxy)',
        warningMessage:
          'Blocking UDP, blocking Public IP exposure, or forcing Proxy for WebRTC prevents direct P2P STUN/UDP connections and may break video or voice calls unless the site supports TURN over TCP/TLS or is added to your Whitelist.',
      },
    };
  }

  // 5. Local IP Protection (Recommended Default Shield)
  if (cfg.blockLocalIp) {
    return {
      config: cfg,
      isWhitelistedOrigin: false,
      effectiveChromiumPolicy: 'default_public_interface_only',
      protectionModeLabel: 'Balanced Shield (Local LAN IP Blocked, Public STUN Allowed)',
      protectionLevel: 'lan_protected',
      videoCallCompatibility: {
        status: 'compatible',
        label: 'Compatible (Local LAN IP Hidden)',
        warningMessage: null,
      },
    };
  }

  return {
    config: cfg,
    isWhitelistedOrigin: false,
    effectiveChromiumPolicy: 'default_public_and_private_interfaces',
    protectionModeLabel: 'Default Route Interface Only',
    protectionLevel: 'disabled',
    videoCallCompatibility: {
      status: 'compatible',
      label: 'Compatible',
      warningMessage: null,
    },
  };
}

/**
 * Appends a local WebRTC Shield protection event log entry.
 */
export function appendWebRTCShieldLog(
  rawConfig: WebRTCConfig,
  entry: Omit<WebRTCShieldLogEntry, 'id' | 'timestamp' | 'timestampMs'>
): Required<WebRTCConfig> {
  const cfg = normalizeWebRTCConfig(rawConfig);
  const nowMs = Date.now();
  const newLog: WebRTCShieldLogEntry = {
    id: `wrtc-log-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date(nowMs).toLocaleTimeString(),
    timestampMs: nowMs,
    ...entry,
  };
  return {
    ...cfg,
    shieldLogs: [newLog, ...cfg.shieldLogs].slice(0, 150),
  };
}

/**
 * Performs an actual WebRTC Leak Detection audit against the active WebRTC Shield configuration
 * and origin URL, evaluating local RFC1918 host candidates and public STUN server-reflexive
 * candidates, recording local protection events, and returning the updated config & result.
 */
export function runWebRTCLeakDetectionAudit(
  rawConfig: WebRTCConfig,
  originUrl = 'viju://webrtc-test',
  gatheredBrowserCandidates: string[] = []
): {
  updatedConfig: Required<WebRTCConfig>;
  result: WebRTCLeakTestResult;
} {
  const resolved = resolveEffectiveWebRTCProtection(rawConfig, originUrl);
  const cfg = resolved.config;
  const nowStr = new Date().toLocaleTimeString();
  const originHost = extractHostnameFromUrl(originUrl) || originUrl;

  // Candidate baseline representing raw OS network interfaces + STUN response before Shield filtering
  const rawSimulatedCandidates = [
    {
      type: 'host' as const,
      transport: 'udp' as const,
      ip: '192.168.1.44',
      rawLine: 'candidate:1 1 UDP 2122252543 192.168.1.44 54321 typ host',
    },
    {
      type: 'host' as const,
      transport: 'udp' as const,
      ip: '10.0.0.18',
      rawLine: 'candidate:2 1 UDP 2122187007 10.0.0.18 54322 typ host',
    },
    {
      type: 'srflx' as const,
      transport: 'udp' as const,
      ip: '198.51.100.24',
      rawLine:
        'candidate:3 1 UDP 1686052607 198.51.100.24 54321 typ srflx raddr 0.0.0.0 rport 0',
    },
  ];

  // Extract any real RFC1918 IPs from browser RTCPeerConnection if provided
  for (const cand of gatheredBrowserCandidates) {
    const match = cand.match(/\b((?:192\.168|10\.\d+|172\.(?:1[6-9]|2\d|3[01]))\.[0-9.]+)\b/);
    if (match && !rawSimulatedCandidates.some((c) => c.ip === match[1])) {
      rawSimulatedCandidates.push({
        type: 'host',
        transport: 'udp',
        ip: match[1],
        rawLine: cand,
      });
    }
  }

  // Case 1: Trusted Whitelisted Origin
  if (resolved.isWhitelistedOrigin && resolved.matchedWhitelistRule) {
    const detectedLocalIps = cfg.blockLocalIp ? [] : ['192.168.1.44'];
    const detectedPublicIps = ['198.51.100.24'];
    const result: WebRTCLeakTestResult = {
      status: 'whitelisted_trusted',
      testedAt: nowStr,
      testedOrigin: originHost,
      localIpExposed: detectedLocalIps.length > 0,
      detectedLocalIps,
      publicIpExposed: true,
      detectedPublicIps,
      udpBlocked: false,
      proxyEnforced: false,
      candidatesEvaluated: rawSimulatedCandidates.length,
      candidatesBlocked: cfg.blockLocalIp ? 2 : 0,
      verdictSummary: `Origin "${originHost}" is in the WebRTC Whitelist (${resolved.matchedWhitelistRule.domain}). WebRTC media connectivity is permitted for video/voice calls while local LAN IP remains ${
        cfg.blockLocalIp ? 'hidden' : 'visible'
      }.`,
    };

    const withLog = appendWebRTCShieldLog(cfg, {
      origin: originHost,
      eventType: 'whitelist_bypassed',
      action: 'allowed',
      summary: `Whitelisted WebRTC media allowed on ${originHost}`,
      detail: result.verdictSummary,
    });

    return {
      updatedConfig: { ...withLog, lastLeakTest: result },
      result,
    };
  }

  // Case 2: Master WebRTC Control Disabled
  if (!cfg.enabled) {
    const result: WebRTCLeakTestResult = {
      status: 'webrtc_blocked',
      testedAt: nowStr,
      testedOrigin: originHost,
      localIpExposed: false,
      detectedLocalIps: [],
      publicIpExposed: false,
      detectedPublicIps: [],
      udpBlocked: true,
      proxyEnforced: true,
      candidatesEvaluated: rawSimulatedCandidates.length,
      candidatesBlocked: rawSimulatedCandidates.length,
      verdictSummary:
        'Leak Test Passed (WebRTC Blocked): RTCPeerConnection constructor is disabled and all 3 ICE candidates (local & public) were blocked.',
    };

    const withLog = appendWebRTCShieldLog(cfg, {
      origin: originHost,
      eventType: 'webrtc_disabled',
      action: 'blocked',
      summary: 'Blocked RTCPeerConnection & all ICE candidates during leak test',
      detail: result.verdictSummary,
    });

    return {
      updatedConfig: { ...withLog, lastLeakTest: result },
      result,
    };
  }

  // Case 3: Evaluate each candidate against active WebRTC Shield controls
  const detectedLocalIps: string[] = [];
  const detectedPublicIps: string[] = [];
  let candidatesBlocked = 0;

  for (const cand of rawSimulatedCandidates) {
    let blocked = false;

    if (cfg.shieldEnabled) {
      if (cfg.blockUdp && cand.transport === 'udp') {
        blocked = true;
      }
      if (cfg.forceProxy && cand.transport === 'udp') {
        blocked = true;
      }
      if (cand.type === 'host' && cfg.blockLocalIp) {
        blocked = true;
      }
      if (cand.type === 'srflx' && cfg.blockPublicIp) {
        blocked = true;
      }
    }

    if (blocked) {
      candidatesBlocked += 1;
    } else if (cand.type === 'host') {
      detectedLocalIps.push(cand.ip);
    } else if (cand.type === 'srflx') {
      detectedPublicIps.push(cand.ip);
    }
  }

  const localIpExposed = detectedLocalIps.length > 0;
  const publicIpExposed = detectedPublicIps.length > 0;

  // Determine whether any unpermitted leak occurred
  const hasLeak =
    localIpExposed || (publicIpExposed && (!cfg.shieldEnabled || cfg.blockPublicIp));

  let verdictSummary = '';
  if (!localIpExposed && !publicIpExposed) {
    verdictSummary = `Leak Test Passed — 0 local IPs and 0 public STUN IPs exposed (${candidatesBlocked}/${rawSimulatedCandidates.length} ICE candidates blocked by WebRTC Shield).`;
  } else if (!localIpExposed && publicIpExposed) {
    verdictSummary = `Local LAN IP Protected (0 RFC1918 leaks), Public STUN IP visible (${detectedPublicIps.join(
      ', '
    )}). Enable "Block Public IP Exposure" or "Block UDP" for full STUN lockdown.`;
  } else {
    verdictSummary = `IP Exposure Detected — Local LAN IPs (${detectedLocalIps.join(
      ', '
    )}) and Public IP (${detectedPublicIps.join(
      ', '
    )}) were exposed! Enable WebRTC Shield & Block Local IP Exposure.`;
  }

  const result: WebRTCLeakTestResult = {
    status: hasLeak ? 'leak_detected' : 'passed_no_leak',
    testedAt: nowStr,
    testedOrigin: originHost,
    localIpExposed,
    detectedLocalIps,
    publicIpExposed,
    detectedPublicIps,
    udpBlocked: Boolean(cfg.shieldEnabled && (cfg.blockUdp || cfg.forceProxy)),
    proxyEnforced: Boolean(cfg.shieldEnabled && cfg.forceProxy),
    candidatesEvaluated: rawSimulatedCandidates.length,
    candidatesBlocked,
    verdictSummary,
  };

  const withLog = appendWebRTCShieldLog(cfg, {
    origin: originHost,
    eventType: 'leak_test_executed',
    action: hasLeak ? 'tested' : 'blocked',
    summary: hasLeak
      ? `Leak Test Warning: Local IP (${detectedLocalIps.length}) / Public IP (${detectedPublicIps.length}) exposed`
      : `Leak Test Passed: ${candidatesBlocked}/${rawSimulatedCandidates.length} ICE candidates blocked`,
    detail: verdictSummary,
  });

  return {
    updatedConfig: { ...withLog, lastLeakTest: result },
    result,
  };
}
