import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAddressBarInput,
  validateAutoRefreshInterval,
  validateUserAgentString,
  validateScreenDimensions,
  isValidWebRTCPolicy,
  createTabState,
  navigateTabState,
  goBackTabState,
  goForwardTabState,
  applyUserAgentToTab,
  computePrivacyStatusSummary,
  DEFAULT_FINGERPRINT_PROFILES,
  createDefaultClearBrowsingDataPayload,
  filterRecordsByClearTimeRange,
  mapWebDataToElectronStorages,
  ALL_FINGERPRINT_CONTROL_KEYS,
  createDefaultFingerprintSpoofControls,
  createDefaultFingerprintSpoofConfig,
  enableAllFingerprintControls,
  disableAllFingerprintControls,
  resetDefaultFingerprintSpoofConfig,
  applyStrictProtectionPreset,
  applyCanvasProtectionToBuffer,
  computeWebGLSpoofedParameters,
  applyAudioProtectionToSamples,
  computeFontSpoofedMetrics,
  applyClientRectsProtection,
  sanitizeWebRTCIceCandidate,
  computeNavigatorSpoofSnapshot,
  computeTimezoneSpoofSnapshot,
  applyNoCacheHeaders,
  isOriginWhitelisted,
  evaluateAll12FingerprintSurfaces,
  createProtectionLogEntriesForEvent,
  UA_GENERATOR_COMBINATIONS,
  createDefaultUAGeneratorToggles,
  createDefaultRandomUASwitcherConfig,
  generateNextUserAgentProfile,
  isDomainBlacklistedForUA,
  toggleDomainInUABlacklist,
  resolveEffectiveUserAgentForUrl,
  tickAutoRotateUASwitcher,
  NATIVE_BASELINE_UA_PROFILE,
  normalizeWebRTCConfig,
  resolveEffectiveWebRTCProtection,
  runWebRTCLeakDetectionAudit,
  isDomainWhitelistedForWebRTC,
  syncPolicyFromShieldFlags,
  buildGitHubReleaseUrls,
  diagnoseNoReleasesState,
  DEFAULT_GITHUB_RELEASE_REPO,
  VIJU_INSTALLER_EXE_FILENAME,
  VIJU_PORTABLE_EXE_FILENAME,
} from './browserEngine';

test('resolveAddressBarInput handles internal viju:// protocol URLs', () => {
  const res = resolveAddressBarInput('viju://webrtc-test');
  assert.equal(res.url, 'viju://webrtc-test');
  assert.equal(res.isInternal, true);
  assert.equal(res.isSearch, false);
});

test('resolveAddressBarInput resolves bare domain names to https:// URLs', () => {
  const res = resolveAddressBarInput('electronjs.org');
  assert.equal(res.url, 'https://electronjs.org/');
  assert.equal(res.isInternal, false);
  assert.equal(res.isSearch, false);
  assert.equal(res.faviconType, 'lock');
});

test('resolveAddressBarInput falls back to Google Search for natural language queries', () => {
  const res = resolveAddressBarInput('electron contextIsolation security best practices');
  assert.equal(
    res.url,
    'https://www.google.com/search?q=electron%20contextIsolation%20security%20best%20practices'
  );
  assert.equal(res.isSearch, true);
  assert.equal(res.searchQuery, 'electron contextIsolation security best practices');
});

test('validateAutoRefreshInterval enforces minimum 5 second limit', () => {
  const tooLow = validateAutoRefreshInterval(3);
  assert.equal(tooLow.valid, false);
  assert.equal(tooLow.sanitizedSeconds, 5);
  assert.ok(tooLow.error?.includes('Minimum refresh interval is 5 seconds'));

  const exactFive = validateAutoRefreshInterval(5);
  assert.equal(exactFive.valid, true);
  assert.equal(exactFive.sanitizedSeconds, 5);

  const thirty = validateAutoRefreshInterval(30);
  assert.equal(thirty.valid, true);
  assert.equal(thirty.sanitizedSeconds, 30);
});

test('validateUserAgentString rejects CRLF header injection and short strings', () => {
  const crlf = validateUserAgentString('Mozilla/5.0\r\nX-Injected: pwned');
  assert.equal(crlf.valid, false);
  assert.ok(crlf.error?.includes('CR/LF'));

  const validUa = validateUserAgentString(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  );
  assert.equal(validUa.valid, true);
});

test('validateScreenDimensions checks bounds and integer constraints', () => {
  assert.equal(validateScreenDimensions(1920, 1080).valid, true);
  assert.equal(validateScreenDimensions(100, 100).valid, false);
  assert.equal(validateScreenDimensions(1920.5, 1080).valid, false);
});

test('isValidWebRTCPolicy validates Chromium WebRTC IP handling policies', () => {
  assert.equal(isValidWebRTCPolicy('default'), true);
  assert.equal(isValidWebRTCPolicy('default_public_interface_only'), true);
  assert.equal(isValidWebRTCPolicy('disable_non_proxied_udp'), true);
  assert.equal(isValidWebRTCPolicy('invalid_policy'), false);
});

test('tab navigation history stack supports back, forward, and User-Agent switching', () => {
  let tab = createTabState('tab-1', 'viju://home');
  assert.equal(tab.url, 'viju://home');
  assert.equal(tab.historyIndex, 0);

  tab = navigateTabState(tab, 'example.com');
  assert.equal(tab.url, 'https://example.com/');
  assert.equal(tab.historyIndex, 1);

  tab = navigateTabState(tab, 'chromium security');
  assert.equal(tab.historyIndex, 2);

  tab = goBackTabState(tab);
  assert.equal(tab.url, 'https://example.com/');
  assert.equal(tab.historyIndex, 1);

  tab = goForwardTabState(tab);
  assert.equal(tab.url, 'https://www.google.com/search?q=chromium%20security');
  assert.equal(tab.historyIndex, 2);

  const prevReloadCount = tab.reloadCounter;
  tab = applyUserAgentToTab(tab, 'iphone_safari');
  assert.equal(tab.userAgentPresetId, 'iphone_safari');
  assert.ok(tab.effectiveUserAgent.includes('iPhone'));
  assert.equal(tab.reloadCounter, prevReloadCount + 1);
});

test('computePrivacyStatusSummary accurately reflects WebRTC lockdown and honest disclosures', () => {
  const summary = computePrivacyStatusSummary(
    { enabled: false, policy: 'disable_non_proxied_udp' },
    DEFAULT_FINGERPRINT_PROFILES[1],
    'android_chrome'
  );
  assert.equal(summary.statusLevel, 'restricted');
  assert.ok(summary.modifiedSignals.some((s) => s.includes('User-Agent')));
  assert.ok(summary.unmodifiedSignals.some((s) => s.includes('Public IPv4')));
});

test('createDefaultClearBrowsingDataPayload checks all 9 Web Data and 4 Browser Data options by default', () => {
  const def = createDefaultClearBrowsingDataPayload();
  assert.equal(Object.values(def.webData).every(Boolean), true);
  assert.equal(Object.keys(def.webData).length, 9);
  assert.equal(Object.values(def.browserData).every(Boolean), true);
  assert.equal(Object.keys(def.browserData).length, 4);
});

test('filterRecordsByClearTimeRange removes only records within the selected time range', () => {
  const now = 1_700_000_000_000;
  const records = [
    { id: '1', timestampMs: now - 5 * 60 * 1000 }, // 5 mins ago
    { id: '2', timestampMs: now - 45 * 60 * 1000 }, // 45 mins ago
    { id: '3', timestampMs: now - 5 * 24 * 60 * 60 * 1000 }, // 5 days ago
  ];

  const res15m = filterRecordsByClearTimeRange(records, 'last_15_min', now);
  assert.equal(res15m.removedCount, 1);
  assert.equal(res15m.remaining.length, 2);

  const res1h = filterRecordsByClearTimeRange(records, 'last_hour', now);
  assert.equal(res1h.removedCount, 2);
  assert.equal(res1h.remaining.length, 1);
  assert.equal(res1h.remaining[0].id, '3');

  const resAll = filterRecordsByClearTimeRange(records, 'everything', now);
  assert.equal(resAll.removedCount, 3);
  assert.equal(resAll.remaining.length, 0);
});

test('mapWebDataToElectronStorages maps storage types and flags legacy types for graceful handling', () => {
  const def = createDefaultClearBrowsingDataPayload();
  const mapped = mapWebDataToElectronStorages(def.webData);
  assert.equal(mapped.shouldClearHttpCache, true);
  assert.ok(mapped.supportedElectronStorages.includes('cookies'));
  assert.ok(mapped.supportedElectronStorages.includes('cachestorage'));
  assert.ok(mapped.supportedElectronStorages.includes('filesystem'));
  assert.ok(mapped.supportedElectronStorages.includes('indexdb'));
  assert.ok(mapped.supportedElectronStorages.includes('localstorage'));
  assert.ok(mapped.supportedElectronStorages.includes('serviceworkers'));
  assert.ok(mapped.gracefullyHandledLegacyTypes.includes('appcache'));
});

test('Fingerprint Spoofing enables all 12 required controls by default and supports bulk actions', () => {
  const controls = createDefaultFingerprintSpoofControls();
  assert.equal(ALL_FINGERPRINT_CONTROL_KEYS.length, 12);
  for (const key of ALL_FINGERPRINT_CONTROL_KEYS) {
    assert.equal(controls[key], true, `Expected control "${key}" to be enabled by default`);
  }

  let cfg = createDefaultFingerprintSpoofConfig();
  cfg = disableAllFingerprintControls(cfg);
  for (const key of ALL_FINGERPRINT_CONTROL_KEYS) {
    assert.equal(cfg.controls[key], false, `Expected Disable All to turn off "${key}"`);
  }

  cfg = enableAllFingerprintControls(cfg);
  for (const key of ALL_FINGERPRINT_CONTROL_KEYS) {
    assert.equal(cfg.controls[key], true, `Expected Enable All to turn on "${key}"`);
  }

  const strict = applyStrictProtectionPreset(cfg);
  assert.equal(strict.spoofConfig.mode, 'strict');
  assert.equal(strict.webrtcConfig.enabled, false);
  assert.equal(strict.webrtcConfig.policy, 'disable_non_proxied_udp');

  const resetCfg = resetDefaultFingerprintSpoofConfig();
  assert.equal(resetCfg.mode, 'maximum_default');
  assert.equal(Object.values(resetCfg.controls).every(Boolean), true);
});

test('Canvas, WebGL, Audio, Font, and ClientRects protections deterministically alter outputs and stay coherent across tabs', () => {
  const cfg = createDefaultFingerprintSpoofConfig();
  const profile = DEFAULT_FINGERPRINT_PROFILES[0];

  // 1. Canvas
  const pixels = new Uint8ClampedArray(64);
  for (let i = 0; i < 64; i++) pixels[i] = (i * 11 + 20) % 256;
  const c1 = applyCanvasProtectionToBuffer(pixels, cfg, 'https://fingerprint.example.com');
  const c2 = applyCanvasProtectionToBuffer(pixels, cfg, 'https://fingerprint.example.com');
  assert.notEqual(c1.spoofedDigest, c1.nativeDigest);
  assert.equal(c1.spoofedDigest, c2.spoofedDigest); // Coherent across tabs

  // 2. WebGL
  const webglOn = computeWebGLSpoofedParameters(profile, cfg, 'https://fingerprint.example.com');
  assert.equal(webglOn.isSpoofed, true);
  assert.ok(webglOn.vendor.includes('NVIDIA'));

  // 3. Audio
  const pcm = new Float32Array(32);
  for (let i = 0; i < 32; i++) pcm[i] = Math.cos(i * 0.3) * 0.4;
  const a1 = applyAudioProtectionToSamples(pcm, cfg, 'https://fingerprint.example.com');
  const a2 = applyAudioProtectionToSamples(pcm, cfg, 'https://fingerprint.example.com');
  assert.notEqual(a1.spoofedDigest, a1.nativeDigest);
  assert.equal(a1.spoofedDigest, a2.spoofedDigest);

  // 4. Font
  const fontCheck = computeFontSpoofedMetrics(
    'RareTrackingFontPro',
    'mmmmmmmmmmlli',
    120.0,
    cfg,
    'https://fingerprint.example.com'
  );
  assert.equal(fontCheck.allowedToEnumerate, false);
  assert.notEqual(fontCheck.measuredWidthPx, 120.0);

  // 5. ClientRects
  const rect = applyClientRectsProtection(
    { x: 10, y: 20, width: 200, height: 50 },
    cfg,
    'https://fingerprint.example.com'
  );
  assert.notEqual(rect.deltaApplied, 0);
  assert.notEqual(rect.width, 200);
});

test('WebRTC, Navigator, Timezone, No-Cache, Whitelist, and Logs protections verify behavior changes', () => {
  const cfg = createDefaultFingerprintSpoofConfig();
  const profile = DEFAULT_FINGERPRINT_PROFILES[2]; // Europe/London, en-GB

  // 6. WebRTC ICE sanitizer strips RFC1918 LAN IP
  const ice = sanitizeWebRTCIceCandidate(
    'candidate:1 1 udp 2122260223 192.168.1.99 51112 typ host',
    { enabled: true, policy: 'default_public_interface_only' },
    cfg,
    'https://tracker.example.com'
  );
  assert.equal(ice.allowed, false);

  // 7. Navigator Client Hints & webdriver=false
  const nav = computeNavigatorSpoofSnapshot(
    profile,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
    cfg,
    'https://tracker.example.com'
  );
  assert.equal(nav.isSpoofed, true);
  assert.equal(nav.webdriver, false);
  assert.equal(nav.hardwareConcurrency, 16);
  assert.equal(nav.language, 'en-GB');

  // 8. Timezone
  const tz = computeTimezoneSpoofSnapshot(profile, cfg, 'https://tracker.example.com');
  assert.equal(tz.isSpoofed, true);
  assert.equal(tz.ianaTimezone, 'Europe/London');
  assert.equal(tz.timezoneOffsetMinutes, 0);

  // 10. No-Cache strips ETag and If-None-Match
  const headers = applyNoCacheHeaders(
    { 'If-None-Match': '"etag-123"', Accept: '*/*' },
    { ETag: '"etag-123"', 'Content-Type': 'text/html' },
    cfg,
    'https://tracker.example.com'
  );
  assert.equal(headers.sanitizedRequestHeaders['If-None-Match'], undefined);
  assert.equal(headers.sanitizedResponseHeaders['ETag'], undefined);
  assert.ok(headers.sanitizedRequestHeaders['Cache-Control'].includes('no-store'));

  // 11. Whitelist bypasses protections for whitelisted domains
  const wlMatch = isOriginWhitelisted('https://trusted-hardware-check.internal/login', cfg);
  assert.equal(wlMatch.whitelisted, true);
  const canvasWhitelisted = applyCanvasProtectionToBuffer(
    new Uint8ClampedArray([10, 20, 30, 255]),
    cfg,
    'https://trusted-hardware-check.internal/login'
  );
  assert.equal(canvasWhitelisted.spoofedDigest, canvasWhitelisted.nativeDigest);

  // 12. Logs & 12-Surface Suite
  const logs = createProtectionLogEntriesForEvent(
    'probe_simulation',
    cfg,
    profile,
    { enabled: true, policy: 'default_public_interface_only' },
    'https://browserleaks.com/canvas',
    'tab-1'
  );
  assert.ok(logs.length >= 8);

  const suite = evaluateAll12FingerprintSurfaces(
    profile,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
    { enabled: true, policy: 'default_public_interface_only' },
    cfg,
    logs.length,
    'https://browserleaks.com/canvas'
  );
  assert.equal(suite.length, 12);
  for (const item of suite) {
    assert.equal(item.passed, true, `Surface "${item.control}" failed verification check`);
  }
});

test('Generator Settings initializes exact 9 enabled and 5 disabled Browser/OS combinations by default', () => {
  const toggles = createDefaultUAGeneratorToggles();
  assert.equal(UA_GENERATOR_COMBINATIONS.length, 14);

  const expectedEnabled = [
    'chrome_macos',
    'chrome_windows',
    'edge_macos',
    'edge_windows',
    'firefox_macos',
    'firefox_windows',
    'opera_macos',
    'opera_windows',
    'safari_macos',
  ] as const;

  const expectedDisabled = [
    'chrome_android',
    'chrome_linux',
    'firefox_android',
    'firefox_linux',
    'safari_iphone',
  ] as const;

  for (const k of expectedEnabled) {
    assert.equal(toggles[k], true, `Expected ${k} to be enabled by default`);
  }
  for (const k of expectedDisabled) {
    assert.equal(toggles[k], false, `Expected ${k} to be disabled by default`);
  }
});

test('Get New Agent changes active User-Agent only from enabled combinations and maintains JS property consistency', () => {
  let cfg = createDefaultRandomUASwitcherConfig(false);
  cfg.syncWithOs = false;
  const initialUa = cfg.activeGeneratedProfile.userAgent;

  for (let i = 0; i < 12; i++) {
    const res = generateNextUserAgentProfile(cfg, { deterministicIndex: i });
    assert.equal(res.ok, true);
    assert.ok(res.profile);
    assert.notEqual(res.profile.userAgent, initialUa);
    // Verify it never selects any of the 5 disabled combinations
    assert.equal(
      cfg.generatorToggles[res.profile.comboKey as keyof typeof cfg.generatorToggles],
      true
    );
    // Verify coherent JS navigator properties
    if (res.profile.osFamily === 'macos') {
      assert.equal(res.profile.platform, 'MacIntel');
    } else if (res.profile.osFamily === 'windows') {
      assert.equal(res.profile.platform, 'Win32');
    }
  }

  // Requesting a disabled combination (e.g. Android) should return a clear error until enabled
  const blockedAndroid = generateNextUserAgentProfile(cfg, { preferredOs: 'android' });
  assert.equal(blockedAndroid.ok, false);
  assert.ok(blockedAndroid.error?.includes('ANDROID'));
});

test('Startup rotation, interval auto-rotation, Pause/Resume Switcher, and Custom User-Agent mode work accurately', () => {
  // 1. Startup rotation
  const startupCfg = createDefaultRandomUASwitcherConfig(true);
  assert.equal(startupCfg.rotationCount, 1);
  assert.ok(startupCfg.lastRotatedAt !== null);

  // 2. Interval auto-rotation & Pause/Resume
  let cfg = createDefaultRandomUASwitcherConfig(false);
  cfg.autoRotateEnabled = true;
  cfg.autoRotateIntervalSeconds = 5;
  cfg.remainingSeconds = 2;

  // Tick 1: decrements remainingSeconds from 2 -> 1
  const t1 = tickAutoRotateUASwitcher(cfg);
  assert.equal(t1.didRotate, false);
  assert.equal(t1.nextConfig.remainingSeconds, 1);

  // Pause Switcher: stops countdown and rotation while keeping active profile
  const pausedCfg = { ...t1.nextConfig, paused: true };
  const tPaused = tickAutoRotateUASwitcher(pausedCfg);
  assert.equal(tPaused.didRotate, false);
  assert.equal(tPaused.nextConfig.remainingSeconds, 1);

  // Resume Switcher: next tick reaches 0 and rotates User-Agent
  const resumedCfg = { ...tPaused.nextConfig, paused: false };
  const tRotated = tickAutoRotateUASwitcher(resumedCfg);
  assert.equal(tRotated.didRotate, true);
  assert.equal(tRotated.nextConfig.remainingSeconds, 5);
  assert.notEqual(
    tRotated.nextConfig.activeGeneratedProfile.userAgent,
    cfg.activeGeneratedProfile.userAgent
  );

  // 3. Custom User-Agent mode
  const customModeCfg = { ...cfg, useCustomAgentsMode: true };
  const customGen = generateNextUserAgentProfile(customModeCfg, { deterministicIndex: 1 });
  assert.equal(customGen.ok, true);
  assert.equal(customGen.profile?.comboKey, 'custom');
});

test('Blacklist exact-domain and subdomain matching and per-domain popup toggle control outgoing UA', () => {
  let cfg = createDefaultRandomUASwitcherConfig(false);

  // Default blacklist has accounts.google.com and intranet.corp.local
  const exactCheck = isDomainBlacklistedForUA(
    'https://accounts.google.com/signin',
    cfg.blacklistDomains
  );
  assert.equal(exactCheck.blacklisted, true);

  const subdomainCheck = isDomainBlacklistedForUA(
    'https://sso.intranet.corp.local/auth',
    cfg.blacklistDomains
  );
  assert.equal(subdomainCheck.blacklisted, true);

  // Outgoing request to blacklisted domain receives baseline native UA
  const resolvedBlacklisted = resolveEffectiveUserAgentForUrl(
    'https://accounts.google.com/signin',
    cfg
  );
  assert.equal(resolvedBlacklisted.isSwitchingActiveOnDomain, false);
  assert.equal(
    resolvedBlacklisted.effectiveProfile.userAgent,
    NATIVE_BASELINE_UA_PROFILE.userAgent
  );

  // Outgoing request to non-blacklisted domain receives active spoofed UA
  const resolvedNormal = resolveEffectiveUserAgentForUrl('https://example.com/', cfg);
  assert.equal(resolvedNormal.isSwitchingActiveOnDomain, true);
  assert.equal(
    resolvedNormal.effectiveProfile.userAgent,
    cfg.activeGeneratedProfile.userAgent
  );

  // Toggling domain switch in popup disables switching on example.com
  const toggledOff = toggleDomainInUABlacklist('https://example.com/', cfg.blacklistDomains);
  assert.equal(toggledOff.isSwitchingEnabledOnDomain, false);
  cfg = { ...cfg, blacklistDomains: toggledOff.nextBlacklist };
  assert.equal(
    resolveEffectiveUserAgentForUrl('https://sub.example.com/page', cfg)
      .isSwitchingActiveOnDomain,
    false
  );
});

test('WebRTC Shield initializes with all options ON, untested leak status, and synchronizes with WebRTC Control policy', () => {
  const defaultShield = normalizeWebRTCConfig();
  assert.equal(defaultShield.enabled, true);
  assert.equal(defaultShield.shieldEnabled, true);
  assert.equal(defaultShield.blockLocalIp, true);
  assert.equal(defaultShield.blockPublicIp, true);
  assert.equal(defaultShield.blockUdp, true);
  assert.equal(defaultShield.forceProxy, true);
  assert.equal(defaultShield.leakDetectionEnabled, true);
  assert.equal(defaultShield.policy, 'disable_non_proxied_udp');
  assert.ok(
    defaultShield.whitelistDomains.every((r) => r.enabled === true),
    'All default WebRTC whitelist rules should be enabled by default'
  );
  // Must NOT claim a leak test passed before a test is actually run
  assert.equal(defaultShield.lastLeakTest.status, 'not_tested');
  assert.equal(defaultShield.lastLeakTest.testedAt, null);

  // Toggling Block UDP or Force Proxy maps coherently to disable_non_proxied_udp
  const strictPolicy = syncPolicyFromShieldFlags({
    shieldEnabled: true,
    blockLocalIp: true,
    blockPublicIp: false,
    blockUdp: true,
    forceProxy: true,
  });
  assert.equal(strictPolicy, 'disable_non_proxied_udp');

  // Disabling WebRTC Shield maps to Chromium default policy
  const disabledPolicy = syncPolicyFromShieldFlags({
    shieldEnabled: false,
    blockLocalIp: true,
    blockPublicIp: true,
    blockUdp: true,
    forceProxy: true,
  });
  assert.equal(disabledPolicy, 'default');
});

test('WebRTC Shield Leak Detection accurately detects local and public IP exposure across Shield modes', () => {
  // 1. Shield Disabled -> exposes both local RFC1918 and public STUN IPs
  const shieldOffCfg = normalizeWebRTCConfig({
    enabled: true,
    shieldEnabled: false,
  });
  const leakAuditOff = runWebRTCLeakDetectionAudit(
    shieldOffCfg,
    'https://browserleaks.com/webrtc'
  );
  assert.equal(leakAuditOff.result.status, 'leak_detected');
  assert.equal(leakAuditOff.result.localIpExposed, true);
  assert.ok(leakAuditOff.result.detectedLocalIps.includes('192.168.1.44'));
  assert.equal(leakAuditOff.result.publicIpExposed, true);
  assert.ok(leakAuditOff.result.detectedPublicIps.includes('198.51.100.24'));

  // 2. Shield Enabled + Block Local IP Only -> blocks RFC1918 local IPs, allows public STUN IP
  const lanProtectedCfg = normalizeWebRTCConfig({
    enabled: true,
    shieldEnabled: true,
    blockLocalIp: true,
    blockPublicIp: false,
    blockUdp: false,
    forceProxy: false,
  });
  const leakAuditLan = runWebRTCLeakDetectionAudit(
    lanProtectedCfg,
    'https://browserleaks.com/webrtc'
  );
  assert.equal(leakAuditLan.result.status, 'passed_no_leak');
  assert.equal(leakAuditLan.result.localIpExposed, false);
  assert.equal(leakAuditLan.result.detectedLocalIps.length, 0);
  assert.equal(leakAuditLan.result.publicIpExposed, true);

  // 3. Shield Enabled + Block Public IP / Block UDP / Force Proxy -> 0 local IPs and 0 public IPs exposed
  const strictShieldCfg = normalizeWebRTCConfig({
    enabled: true,
    shieldEnabled: true,
    blockLocalIp: true,
    blockPublicIp: true,
    blockUdp: true,
    forceProxy: true,
  });
  const leakAuditStrict = runWebRTCLeakDetectionAudit(
    strictShieldCfg,
    'https://browserleaks.com/webrtc'
  );
  assert.equal(leakAuditStrict.result.status, 'passed_no_leak');
  assert.equal(leakAuditStrict.result.localIpExposed, false);
  assert.equal(leakAuditStrict.result.publicIpExposed, false);
  assert.equal(leakAuditStrict.result.udpBlocked, true);
  assert.equal(leakAuditStrict.result.proxyEnforced, true);
  assert.equal(leakAuditStrict.result.candidatesBlocked, 3);
});

test('WebRTC Shield respects trusted website Whitelist rules and verifies video-call compatibility', () => {
  const strictCfg = normalizeWebRTCConfig({
    enabled: true,
    shieldEnabled: true,
    blockLocalIp: true,
    blockPublicIp: true,
    blockUdp: true,
    forceProxy: true,
  });

  // Non-whitelisted site under Block UDP / Force Proxy warns that video calls may break
  const nonWhitelisted = resolveEffectiveWebRTCProtection(
    strictCfg,
    'https://example.com/call'
  );
  assert.equal(nonWhitelisted.isWhitelistedOrigin, false);
  assert.equal(nonWhitelisted.videoCallCompatibility.status, 'may_break_calls');
  assert.ok(nonWhitelisted.videoCallCompatibility.warningMessage);

  // Whitelisted trusted site (meet.google.com or subdomain) allows WebRTC video calls
  const whitelistedCheck = isDomainWhitelistedForWebRTC(
    'https://meet.google.com/abc-defg-hij',
    strictCfg.whitelistDomains
  );
  assert.equal(whitelistedCheck.whitelisted, true);

  const whitelistedProtection = resolveEffectiveWebRTCProtection(
    strictCfg,
    'https://meet.google.com/abc-defg-hij'
  );
  assert.equal(whitelistedProtection.isWhitelistedOrigin, true);
  assert.equal(whitelistedProtection.videoCallCompatibility.status, 'compatible');

  const wlAudit = runWebRTCLeakDetectionAudit(
    strictCfg,
    'https://meet.google.com/abc-defg-hij'
  );
  assert.equal(wlAudit.result.status, 'whitelisted_trusted');
});

test('buildGitHubReleaseUrls constructs direct GitHub Releases .EXE download links and normalizes repo URLs', () => {
  const defaultUrls = buildGitHubReleaseUrls(DEFAULT_GITHUB_RELEASE_REPO);
  assert.equal(defaultUrls.isValid, true);
  assert.equal(defaultUrls.normalizedRepo, 'thakorvijay51098/viju-browser');
  assert.equal(
    defaultUrls.releasesPageUrl,
    'https://github.com/thakorvijay51098/viju-browser/releases'
  );
  assert.equal(
    defaultUrls.installerExeDownloadUrl,
    `https://github.com/thakorvijay51098/viju-browser/releases/latest/download/${VIJU_INSTALLER_EXE_FILENAME}`
  );
  assert.equal(
    defaultUrls.portableExeDownloadUrl,
    `https://github.com/thakorvijay51098/viju-browser/releases/latest/download/${VIJU_PORTABLE_EXE_FILENAME}`
  );

  // Full GitHub URL with /releases or .git suffix normalizes cleanly
  const fromFullUrl = buildGitHubReleaseUrls(
    'https://github.com/customuser/viju-desktop-browser.git'
  );
  assert.equal(fromFullUrl.isValid, true);
  assert.equal(fromFullUrl.normalizedRepo, 'customuser/viju-desktop-browser');
  assert.equal(
    fromFullUrl.installerExeDownloadUrl,
    `https://github.com/customuser/viju-desktop-browser/releases/latest/download/${VIJU_INSTALLER_EXE_FILENAME}`
  );
  assert.equal(
    fromFullUrl.newWorkflowFileUrl,
    'https://github.com/customuser/viju-desktop-browser/new/main?filename=.github/workflows/build-windows-exe.yml'
  );
});

test('diagnoseNoReleasesState accurately identifies why GitHub shows "No releases published"', () => {
  // 1. Workflow file not pushed to GitHub repo yet
  const notSynced = diagnoseNoReleasesState({
    repoExists: true,
    hasWorkflowFile: false,
    latestRunStatus: 'none',
    releasesCount: 0,
  });
  assert.equal(notSynced.reasonCode, 'WORKFLOW_NOT_PUSHED_YET');
  assert.ok(notSynced.headlineHinglish.includes('build-windows-exe.yml'));

  // 2. GitHub Actions currently building .EXE
  const building = diagnoseNoReleasesState({
    repoExists: true,
    hasWorkflowFile: true,
    latestRunStatus: 'in_progress',
    releasesCount: 0,
  });
  assert.equal(building.reasonCode, 'BUILD_IN_PROGRESS');

  // 3. GitHub Actions failed due to permissions
  const failed = diagnoseNoReleasesState({
    repoExists: true,
    hasWorkflowFile: true,
    latestRunStatus: 'completed',
    latestRunConclusion: 'failure',
    releasesCount: 0,
  });
  assert.equal(failed.reasonCode, 'WORKFLOW_FAILED_PERMISSIONS');

  // 4. Release is live
  const live = diagnoseNoReleasesState({
    repoExists: true,
    hasWorkflowFile: true,
    latestRunStatus: 'completed',
    latestRunConclusion: 'success',
    releasesCount: 1,
  });
  assert.equal(live.reasonCode, 'RELEASE_LIVE');
});

test('Electron package.json and GitHub workflow prevent electron-builder updateInfoBuilder null channel and PowerShell -c.publish=null errors', async () => {
  const { ELECTRON_SOURCE_FILES } = await import('../data/electronSourceFiles');
  const pkgFile = ELECTRON_SOURCE_FILES.find((f) => f.filename === 'package.json');
  assert.ok(pkgFile, 'Expected package.json in ELECTRON_SOURCE_FILES');
  const parsedPkg = JSON.parse(pkgFile.content);

  // Must define top-level repository so electron-builder never warns "Cannot detect repository by .git/config"
  assert.ok(parsedPkg.repository && parsedPkg.repository.url.includes('github.com'));

  // Must define explicit owner, repo, and channel so updateInfoBuilder never resolves null.channel
  assert.ok(Array.isArray(parsedPkg.build.publish));
  assert.equal(parsedPkg.build.publish[0].provider, 'github');
  assert.ok(parsedPkg.build.publish[0].owner);
  assert.ok(parsedPkg.build.publish[0].repo);
  assert.equal(parsedPkg.build.publish[0].channel, 'latest');

  // Must NOT use -c.publish=null which PowerShell splits on '.' into '-c .publish=null'
  assert.ok(!parsedPkg.scripts['dist:win'].includes('-c.publish=null'));

  const wfFile = ELECTRON_SOURCE_FILES.find((f) => f.filename === 'build-windows-exe.yml');
  assert.ok(wfFile, 'Expected build-windows-exe.yml in ELECTRON_SOURCE_FILES');
  assert.ok(!wfFile.content.includes('-c.publish=null'));
  assert.ok(wfFile.content.includes("channel:'latest'"));
  // Must use official gh release CLI with explicit git tag push instead of softprops/action-gh-release (which causes HTTP 500/502 on refs/heads/main)
  assert.ok(!wfFile.content.includes('softprops/action-gh-release'));
  assert.ok(wfFile.content.includes('git tag -f v1.4.0'));
  assert.ok(wfFile.content.includes('gh release create v1.4.0'));
});




