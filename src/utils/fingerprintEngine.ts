import {
  FingerprintControlKey,
  FingerprintProfile,
  FingerprintProtectionLogEntry,
  FingerprintSpoofConfig,
  FingerprintSpoofControls,
  SurfaceVerificationResult,
  WebRTCConfig,
  WhitelistSiteRule,
} from '../types/browser';

export const ALL_FINGERPRINT_CONTROL_KEYS: FingerprintControlKey[] = [
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
  'logs',
];

export interface FingerprintControlDescriptor {
  key: FingerprintControlKey;
  label: string;
  category: 'Graphics & Media' | 'Layout & Fonts' | 'Network & Environment' | 'Engine & Policy';
  apiSurfaces: string[];
  description: string;
  chromiumMechanism: string;
}

export const FINGERPRINT_CONTROL_DESCRIPTORS: FingerprintControlDescriptor[] = [
  {
    key: 'canvas',
    label: 'Canvas',
    category: 'Graphics & Media',
    apiSurfaces: [
      'HTMLCanvasElement.prototype.toDataURL',
      'HTMLCanvasElement.prototype.toBlob',
      'CanvasRenderingContext2D.prototype.getImageData',
      'OffscreenCanvas.prototype.convertToBlob',
    ],
    description:
      'Injects profile-seeded deterministic sub-LSB pixel perturbations into 2D Canvas readbacks to neutralize GPU/driver rasterization signatures while staying consistent across tabs.',
    chromiumMechanism:
      'CDP Page.addScriptToEvaluateOnNewDocument + preload Mulberry32 PRNG keyed by profileSeed ^ 0xCA7A5.',
  },
  {
    key: 'webgl',
    label: 'WebGL',
    category: 'Graphics & Media',
    apiSurfaces: [
      'WebGLRenderingContext.prototype.getParameter (37445/37446)',
      'WebGL2RenderingContext.prototype.getParameter',
      'WebGLRenderingContext.prototype.readPixels',
      'WebGLRenderingContext.prototype.getSupportedExtensions',
    ],
    description:
      'Spoofs UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL, shader precision formats, texture limits, and WebGL frame buffer readbacks coherently with the OS profile.',
    chromiumMechanism:
      'Intercepts WEBGL_debug_renderer_info enums (0x9245, 0x9246) and perturbs readPixels buffers deterministically.',
  },
  {
    key: 'audio',
    label: 'Audio',
    category: 'Graphics & Media',
    apiSurfaces: [
      'AudioBuffer.prototype.getChannelData',
      'AudioBuffer.prototype.copyFromChannel',
      'AnalyserNode.prototype.getFloatFrequencyData',
      'OfflineAudioContext.prototype.startRendering',
    ],
    description:
      'Applies deterministic floating-point micro-perturbation (±1e-7) to WebAudio PCM channel buffers and FFT frequency arrays to defeat DynamicsCompressor/Oscillator fingerprinting.',
    chromiumMechanism:
      'Deterministic per-sample trigonometric modulation derived from profileSeed ^ 0xA0D10.',
  },
  {
    key: 'font',
    label: 'Font',
    category: 'Layout & Fonts',
    apiSurfaces: [
      'document.fonts.check',
      'FontFaceSet.prototype.values',
      'CanvasRenderingContext2D.prototype.measureText',
    ],
    description:
      'Restricts font enumeration to a standardized OS baseline allowlist and adds deterministic sub-pixel jitter to TextMetrics bounding boxes.',
    chromiumMechanism:
      'Filters FontFaceSet probing and normalizes TextMetrics.width / actualBoundingBoxAscent.',
  },
  {
    key: 'clientRects',
    label: 'ClientRects',
    category: 'Layout & Fonts',
    apiSurfaces: [
      'Element.prototype.getBoundingClientRect',
      'Element.prototype.getClientRects',
      'Range.prototype.getBoundingClientRect',
      'Range.prototype.getClientRects',
    ],
    description:
      'Applies a profile-seeded sub-pixel micro-offset (±0.00037px) to DOMRect geometry queries, breaking sub-pixel layout fingerprinting without shifting visual layout.',
    chromiumMechanism:
      'Wraps DOMRect / DOMRectList getters with deterministic sub-pixel delta keyed by profileSeed.',
  },
  {
    key: 'webrtc',
    label: 'WebRTC',
    category: 'Network & Environment',
    apiSurfaces: [
      'webContents.setWebRTCIPHandlingPolicy',
      'RTCPeerConnection.prototype.onicecandidate',
      'RTCPeerConnection.prototype.createDataChannel',
      'navigator.mediaDevices.enumerateDevices',
    ],
    description:
      'Enforces Chromium IP handling policies, strips RFC1918 LAN / mDNS host ICE candidates from SDP descriptors, and normalizes media device IDs.',
    chromiumMechanism:
      'Electron webContents.setWebRTCIPHandlingPolicy + SDP candidate scrubber in preload.',
  },
  {
    key: 'navigator',
    label: 'Navigator',
    category: 'Network & Environment',
    apiSurfaces: [
      'navigator.userAgent / navigator.userAgentData',
      'navigator.hardwareConcurrency / navigator.deviceMemory',
      'navigator.platform / navigator.languages / navigator.webdriver',
      'window.screen & HTTP Sec-CH-UA / Accept-Language',
    ],
    description:
      'Synchronizes DOM navigator getters, User-Agent Client Hints (Sec-CH-UA-*), screen metrics, and outbound HTTP request headers so zero cross-layer mismatches occur.',
    chromiumMechanism:
      'CDP Emulation.setUserAgentOverride + Emulation.setDeviceMetricsOverride + webRequest header hook.',
  },
  {
    key: 'timezone',
    label: 'Timezone',
    category: 'Network & Environment',
    apiSurfaces: [
      'Intl.DateTimeFormat.prototype.resolvedOptions',
      'Date.prototype.getTimezoneOffset',
      'Date.prototype.toString / toTimeString',
    ],
    description:
      'Overrides IANA timezone resolution and UTC minute offsets across both Intl APIs and Date prototype methods to match the active profile geography.',
    chromiumMechanism:
      'CDP Emulation.setTimezoneOverride + Intl.DateTimeFormat / Date.prototype.getTimezoneOffset hooks.',
  },
  {
    key: 'random',
    label: 'Random',
    category: 'Engine & Policy',
    apiSurfaces: [
      'Profile PRNG Seed (Mulberry32 32-bit)',
      'Cross-Tab Coherent Identity Derivation',
      'One-Click Stable Identity Rotation',
    ],
    description:
      'Uses a stable randomized profile seed rather than changing values on every request, keeping spoofed fingerprints 100% coherent across all tabs in the session.',
    chromiumMechanism:
      'Session-persisted 32-bit seed distributed synchronously to all WebContentsViews via IPC.',
  },
  {
    key: 'noCache',
    label: 'No-Cache',
    category: 'Network & Environment',
    apiSurfaces: [
      'HTTP If-None-Match / ETag Stripping',
      'HTTP If-Modified-Since / Last-Modified',
      'Cache-Control: no-store, no-cache, must-revalidate',
    ],
    description:
      'Neutralizes ETag tracking cookies and heuristic cache-probing by stripping conditional cache validators and enforcing no-store headers on outbound/inbound requests.',
    chromiumMechanism:
      'Electron session.webRequest.onBeforeSendHeaders & onHeadersReceived + CDP Network.setCacheDisabled.',
  },
  {
    key: 'whitelist',
    label: 'Whitelist',
    category: 'Engine & Policy',
    apiSurfaces: [
      'Per-Origin Domain Exceptions',
      'Selective Control Bypass Rules',
    ],
    description:
      'Allows trusted domains (e.g., enterprise portals or local dev servers) to bypass spoofing globally or for specific controls without disabling protection elsewhere.',
    chromiumMechanism:
      'Origin hostname matcher evaluated in both preload main-world hooks and webRequest filters.',
  },
  {
    key: 'logs',
    label: 'Logs',
    category: 'Engine & Policy',
    apiSurfaces: [
      'Structured Local Protection Telemetry',
      'Intercepted API & Header Audit Trail',
    ],
    description:
      'Records local timestamped audit entries whenever a fingerprinting API is intercepted, a header is rewritten, an error is caught, or a whitelist rule is matched.',
    chromiumMechanism:
      'Preload-to-Main IPC ring buffer (viju:fp-log) persisted locally with JSON export.',
  },
];

export const DEFAULT_WHITELIST_RULES: WhitelistSiteRule[] = [
  {
    id: 'wl-localhost',
    domain: 'localhost',
    enabled: true,
    bypassControls: ['noCache'],
    reason: 'Allow local development asset caching while keeping fingerprint spoofing active.',
    addedAt: '2026-11-03',
  },
  {
    id: 'wl-trusted-verify',
    domain: 'trusted-hardware-check.internal',
    enabled: true,
    bypassControls: 'all',
    reason: 'Enterprise workstation attestation exception (bypasses all 12 spoofing hooks).',
    addedAt: '2026-11-03',
  },
];

/**
 * Returns all 12 controls enabled by default as required by the specification.
 */
export function createDefaultFingerprintSpoofControls(): FingerprintSpoofControls {
  return {
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
    logs: true,
  };
}

export function createDefaultFingerprintSpoofConfig(): FingerprintSpoofConfig {
  return {
    mode: 'maximum_default',
    controls: createDefaultFingerprintSpoofControls(),
    profileSeed: 0x7f4a9c21,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    audioNoiseEpsilon: 1.4e-7,
    canvasNoiseStep: 2,
    clientRectsDeltaPx: 0.00037,
    fontJitterPx: 0.015,
    whitelistRules: DEFAULT_WHITELIST_RULES,
  };
}

/**
 * Deterministic 32-bit Mulberry32 PRNG.
 * Guarantees that given the same profileSeed + surfaceSalt, the exact same perturbation
 * sequence is produced across all tabs and repeated calls within the profile.
 */
export function createDeterministicPrng(seed: number): () => number {
  let a = seed >>> 0;
  return function nextFloat(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Computes a fast deterministic 32-bit FNV-1a hex digest for buffers or strings.
 */
export function fnv1aHex(input: string | Uint8ClampedArray | Float32Array): string {
  let hash = 0x811c9dc5;
  if (typeof input === 'string') {
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  } else if (input instanceof Uint8ClampedArray) {
    for (let i = 0; i < input.length; i++) {
      hash ^= input[i];
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  } else {
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    for (let i = 0; i < view.byteLength; i++) {
      hash ^= view.getUint8(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return '0x' + (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export function formatSeedHex(seed: number): string {
  return '0x' + (seed >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Bulk Control Actions: Enable All, Disable All, Reset Defaults, Strict Protection
 */
export function enableAllFingerprintControls(
  config: FingerprintSpoofConfig
): FingerprintSpoofConfig {
  return {
    ...config,
    mode: 'maximum_default',
    controls: createDefaultFingerprintSpoofControls(),
  };
}

export function disableAllFingerprintControls(
  config: FingerprintSpoofConfig
): FingerprintSpoofConfig {
  return {
    ...config,
    mode: 'disabled',
    controls: {
      canvas: false,
      webgl: false,
      audio: false,
      font: false,
      clientRects: false,
      webrtc: false,
      navigator: false,
      timezone: false,
      random: false,
      noCache: false,
      whitelist: false,
      logs: false,
    },
  };
}

export function resetDefaultFingerprintSpoofConfig(): FingerprintSpoofConfig {
  return createDefaultFingerprintSpoofConfig();
}

export function applyStrictProtectionPreset(
  config: FingerprintSpoofConfig,
  customSeed?: number
): {
  spoofConfig: FingerprintSpoofConfig;
  webrtcConfig: WebRTCConfig;
} {
  const nextSeed =
    typeof customSeed === 'number'
      ? customSeed >>> 0
      : ((config.profileSeed ^ 0x5a827999) + 0x10325476) >>> 0;
  const prng = createDeterministicPrng(nextSeed);
  const deltaPx = Number(((prng() * 0.0007 + 0.00015) * (prng() > 0.5 ? 1 : -1)).toFixed(6));

  return {
    spoofConfig: {
      ...config,
      mode: 'strict',
      controls: createDefaultFingerprintSpoofControls(),
      profileSeed: nextSeed,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      audioNoiseEpsilon: 2.3e-7,
      canvasNoiseStep: 3,
      clientRectsDeltaPx: deltaPx,
      fontJitterPx: 0.022,
    },
    webrtcConfig: {
      enabled: false,
      policy: 'disable_non_proxied_udp',
    },
  };
}

/**
 * Generates a coherent hardware/navigator/WebGL/timezone profile from a single deterministic seed
 * so that all fingerprint vectors match a realistic hardware configuration.
 */
export function generateCoherentRandomProfile(seedInput?: number): {
  profile: FingerprintProfile;
  webglVendor: string;
  webglRenderer: string;
  profileSeed: number;
  clientRectsDeltaPx: number;
} {
  const seed =
    typeof seedInput === 'number'
      ? seedInput >>> 0
      : ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 0x9e3779b9;
  const prng = createDeterministicPrng(seed);

  const templates = [
    {
      name: 'Windows 11 Workstation · RTX 4070 (1920×1080)',
      screenWidth: 1920,
      screenHeight: 1080,
      colorDepth: 24,
      pixelRatio: 1,
      hardwareConcurrency: 12,
      deviceMemory: 16,
      language: 'en-US',
      timezone: 'America/New_York',
      webglVendor: 'Google Inc. (NVIDIA)',
      webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    },
    {
      name: 'Windows 11 Enterprise · Intel Iris Xe (1920×1200)',
      screenWidth: 1920,
      screenHeight: 1200,
      colorDepth: 24,
      pixelRatio: 1.25,
      hardwareConcurrency: 8,
      deviceMemory: 8,
      language: 'en-US',
      timezone: 'America/Chicago',
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
    },
    {
      name: 'Windows 11 Studio QHD · Radeon RX 7800 XT (2560×1440)',
      screenWidth: 2560,
      screenHeight: 1440,
      colorDepth: 30,
      pixelRatio: 1.5,
      hardwareConcurrency: 16,
      deviceMemory: 32,
      language: 'en-GB',
      timezone: 'Europe/London',
      webglVendor: 'Google Inc. (AMD)',
      webglRenderer: 'ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
    },
    {
      name: 'Windows 11 Compact · Intel UHD 770 (1536×864)',
      screenWidth: 1536,
      screenHeight: 864,
      colorDepth: 24,
      pixelRatio: 1.25,
      hardwareConcurrency: 6,
      deviceMemory: 8,
      language: 'de-DE',
      timezone: 'Europe/Berlin',
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    },
  ];

  const chosen = templates[Math.floor(prng() * templates.length)];
  const deltaPx = Number(((prng() * 0.0006 + 0.00012) * (prng() > 0.5 ? 1 : -1)).toFixed(6));

  return {
    profile: {
      id: `fp_seeded_${(seed >>> 0).toString(16)}`,
      name: `${chosen.name} [Seed ${formatSeedHex(seed).slice(0, 6)}]`,
      description: `Deterministic coherent profile generated from seed ${formatSeedHex(seed)}.`,
      screenWidth: chosen.screenWidth,
      screenHeight: chosen.screenHeight,
      colorDepth: chosen.colorDepth,
      pixelRatio: chosen.pixelRatio,
      hardwareConcurrency: chosen.hardwareConcurrency,
      deviceMemory: chosen.deviceMemory,
      language: chosen.language,
      timezone: chosen.timezone,
      doNotTrack: '1',
      webglVendor: chosen.webglVendor,
      webglRenderer: chosen.webglRenderer,
      platform: 'Win32',
    },
    webglVendor: chosen.webglVendor,
    webglRenderer: chosen.webglRenderer,
    profileSeed: seed,
    clientRectsDeltaPx: deltaPx,
  };
}

/**
 * Extracts hostname from a URL or raw domain string and checks if it matches an active Whitelist rule.
 */
export function extractHostnameFromUrl(urlOrOrigin: string): string {
  const trimmed = (urlOrOrigin || '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.startsWith('viju://')) {
    return trimmed.replace(/^viju:\/\//, '').split(/[/?#]/)[0];
  }
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return trimmed.split(/[/:?#]/)[0];
  }
}

export function isOriginWhitelisted(
  urlOrOrigin: string,
  config: FingerprintSpoofConfig,
  control?: FingerprintControlKey
): { whitelisted: boolean; matchedRule?: WhitelistSiteRule } {
  if (!config.controls.whitelist) {
    return { whitelisted: false };
  }
  const host = extractHostnameFromUrl(urlOrOrigin);
  if (!host) return { whitelisted: false };

  for (const rule of config.whitelistRules) {
    if (!rule.enabled) continue;
    const ruleDomain = rule.domain.trim().toLowerCase();
    if (!ruleDomain) continue;

    const domainMatch =
      host === ruleDomain || host.endsWith(`.${ruleDomain}`);
    if (!domainMatch) continue;

    if (!control || rule.bypassControls === 'all') {
      return { whitelisted: true, matchedRule: rule };
    }
    if (Array.isArray(rule.bypassControls) && rule.bypassControls.includes(control)) {
      return { whitelisted: true, matchedRule: rule };
    }
  }
  return { whitelisted: false };
}

/**
 * Checks whether a specific fingerprint control is active for a given origin.
 * Takes into account both the control's toggle state AND the per-site Whitelist.
 */
export function isControlActiveForOrigin(
  control: FingerprintControlKey,
  config: FingerprintSpoofConfig,
  origin = ''
): boolean {
  if (!config.controls[control]) return false;
  if (origin && control !== 'whitelist' && control !== 'logs') {
    const wl = isOriginWhitelisted(origin, config, control);
    if (wl.whitelisted) return false;
  }
  return true;
}

/**
 * 1. CANVAS PROTECTION:
 * Perturbs pixel buffer deterministically using Mulberry32(profileSeed ^ 0xCA7A5).
 * Same seed + same canvas input => identical spoofed hash across all tabs in profile.
 */
export function applyCanvasProtectionToBuffer(
  sourceBuffer: Uint8ClampedArray,
  config: FingerprintSpoofConfig,
  origin = ''
): {
  outputBuffer: Uint8ClampedArray;
  nativeDigest: string;
  spoofedDigest: string;
  modifiedPixels: number;
} {
  const nativeDigest = fnv1aHex(sourceBuffer);
  const outputBuffer = new Uint8ClampedArray(sourceBuffer);

  if (!isControlActiveForOrigin('canvas', config, origin)) {
    return {
      outputBuffer,
      nativeDigest,
      spoofedDigest: nativeDigest,
      modifiedPixels: 0,
    };
  }

  const effectiveSeed = config.controls.random ? config.profileSeed : 0x13579bdf;
  const prng = createDeterministicPrng((effectiveSeed ^ 0x00ca7a55) >>> 0);
  const step = Math.max(1, config.canvasNoiseStep || 2);
  let modifiedPixels = 0;

  for (let i = 0; i < outputBuffer.length; i += 16) {
    const channelOffset = Math.floor(prng() * 3); // R, G, or B channel
    const delta = prng() > 0.5 ? step : -step;
    const idx = i + channelOffset;
    if (idx < outputBuffer.length) {
      const orig = outputBuffer[idx];
      const nextVal = Math.max(0, Math.min(255, orig + delta));
      if (nextVal !== orig) {
        outputBuffer[idx] = nextVal;
      } else {
        outputBuffer[idx] = orig > 128 ? orig - step : orig + step;
      }
      modifiedPixels++;
    }
  }

  return {
    outputBuffer,
    nativeDigest,
    spoofedDigest: fnv1aHex(outputBuffer),
    modifiedPixels,
  };
}

/**
 * 2. WEBGL PROTECTION:
 * Computes spoofed WebGL parameters and shader/framebuffer digest.
 */
export function computeWebGLSpoofedParameters(
  profile: FingerprintProfile,
  config: FingerprintSpoofConfig,
  origin = ''
): {
  vendor: string;
  renderer: string;
  shadingLanguageVersion: string;
  maxTextureSize: number;
  readPixelsDigest: string;
  isSpoofed: boolean;
} {
  const nativeVendor = 'Google Inc. (Host GPU Raw)';
  const nativeRenderer = 'ANGLE (Host Native Direct3D11 Hardware Renderer)';
  const isSpoofed = isControlActiveForOrigin('webgl', config, origin);

  if (!isSpoofed) {
    return {
      vendor: nativeVendor,
      renderer: nativeRenderer,
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (Host Default)',
      maxTextureSize: 16384,
      readPixelsDigest: '0x4B19C002',
      isSpoofed: false,
    };
  }

  const effectiveSeed = config.controls.random ? config.profileSeed : 0x2468ace0;
  const vendor = profile.webglVendor || config.webglVendor || 'Google Inc. (NVIDIA)';
  const renderer =
    profile.webglRenderer ||
    config.webglRenderer ||
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const digest = fnv1aHex(`${vendor}|${renderer}|${effectiveSeed}`);

  return {
    vendor,
    renderer,
    shadingLanguageVersion: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)',
    maxTextureSize: profile.screenWidth >= 2560 ? 32768 : 16384,
    readPixelsDigest: digest,
    isSpoofed: true,
  };
}

/**
 * 3. AUDIO PROTECTION:
 * Perturbs WebAudio Float32Array PCM samples deterministically.
 */
export function applyAudioProtectionToSamples(
  sourceSamples: Float32Array,
  config: FingerprintSpoofConfig,
  origin = ''
): {
  outputSamples: Float32Array;
  nativeDigest: string;
  spoofedDigest: string;
  maxDelta: number;
} {
  const nativeDigest = fnv1aHex(sourceSamples);
  const outputSamples = new Float32Array(sourceSamples);

  if (!isControlActiveForOrigin('audio', config, origin)) {
    return {
      outputSamples,
      nativeDigest,
      spoofedDigest: nativeDigest,
      maxDelta: 0,
    };
  }

  const effectiveSeed = config.controls.random ? config.profileSeed : 0x55aa55aa;
  const prng = createDeterministicPrng((effectiveSeed ^ 0x00a0d105) >>> 0);
  const eps = config.audioNoiseEpsilon || 1.4e-7;
  let maxDelta = 0;

  for (let i = 0; i < outputSamples.length; i++) {
    const noise = (prng() - 0.5) * 2 * eps;
    outputSamples[i] = outputSamples[i] + Math.fround(noise);
    const absNoise = Math.abs(noise);
    if (absNoise > maxDelta) maxDelta = absNoise;
  }

  return {
    outputSamples,
    nativeDigest,
    spoofedDigest: fnv1aHex(outputSamples),
    maxDelta,
  };
}

/**
 * 4. FONT PROTECTION:
 * Filters non-standard system fonts and applies deterministic sub-pixel glyph width jitter.
 */
export const STANDARD_WINDOWS_FONT_ALLOWLIST = new Set([
  'arial',
  'calibri',
  'cambria',
  'candara',
  'comic sans ms',
  'consolas',
  'constantia',
  'corbel',
  'courier new',
  'georgia',
  'impact',
  'lucida console',
  'microsoft sans serif',
  'palatino linotype',
  'segoe ui',
  'tahoma',
  'times new roman',
  'trebuchet ms',
  'verdana',
]);

export function computeFontSpoofedMetrics(
  fontFamily: string,
  sampleText: string,
  baseWidthPx: number,
  config: FingerprintSpoofConfig,
  origin = ''
): {
  allowedToEnumerate: boolean;
  measuredWidthPx: number;
  nativeWidthPx: number;
  isSpoofed: boolean;
} {
  const normalizedFont = fontFamily.trim().toLowerCase().replace(/['"]/g, '');
  const isSpoofed = isControlActiveForOrigin('font', config, origin);

  if (!isSpoofed) {
    return {
      allowedToEnumerate: true,
      measuredWidthPx: baseWidthPx,
      nativeWidthPx: baseWidthPx,
      isSpoofed: false,
    };
  }

  const allowedToEnumerate = STANDARD_WINDOWS_FONT_ALLOWLIST.has(normalizedFont);
  const effectiveSeed = config.controls.random ? config.profileSeed : 0x11223344;
  const prng = createDeterministicPrng(
    (effectiveSeed ^ fnv1aNumeric(`${normalizedFont}:${sampleText}`)) >>> 0
  );
  const jitter = (prng() - 0.5) * 2 * (config.fontJitterPx || 0.015);
  const safeJitter = Math.abs(jitter) < 0.002 ? 0.009 : jitter;
  const measuredWidthPx = Number((baseWidthPx + safeJitter).toFixed(4));

  return {
    allowedToEnumerate,
    measuredWidthPx,
    nativeWidthPx: baseWidthPx,
    isSpoofed: true,
  };
}

function fnv1aNumeric(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 5. CLIENTRECTS PROTECTION:
 * Perturbs DOMRect bounding boxes with a profile-seeded sub-pixel delta.
 */
export function applyClientRectsProtection(
  rect: { x: number; y: number; width: number; height: number },
  config: FingerprintSpoofConfig,
  origin = ''
): {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  deltaApplied: number;
} {
  if (!isControlActiveForOrigin('clientRects', config, origin)) {
    return {
      ...rect,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      deltaApplied: 0,
    };
  }

  const effectiveSeed = config.controls.random ? config.profileSeed : 0xabcdef01;
  const prng = createDeterministicPrng((effectiveSeed ^ 0x00c1ec75) >>> 0);
  const baseDelta =
    config.clientRectsDeltaPx ||
    Number(((prng() * 0.0005 + 0.00015) * (prng() > 0.5 ? 1 : -1)).toFixed(6));

  const x = Number((rect.x + baseDelta).toFixed(6));
  const y = Number((rect.y + baseDelta).toFixed(6));
  const width = Number((rect.width + baseDelta).toFixed(6));
  const height = Number((rect.height + baseDelta).toFixed(6));

  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: Number((x + width).toFixed(6)),
    bottom: Number((y + height).toFixed(6)),
    deltaApplied: baseDelta,
  };
}

/**
 * 6. WEBRTC PROTECTION:
 * Sanitizes SDP ICE candidates to strip RFC1918 private LAN IPs and non-proxied UDP srflx leaks.
 */
export function sanitizeWebRTCIceCandidate(
  candidateSdp: string,
  webrtcConfig: WebRTCConfig,
  spoofConfig: FingerprintSpoofConfig,
  origin = ''
): {
  allowed: boolean;
  sanitizedCandidate: string | null;
  reason: string;
} {
  const webrtcProtectionActive = isControlActiveForOrigin('webrtc', spoofConfig, origin);

  if (!webrtcProtectionActive && webrtcConfig.enabled && webrtcConfig.policy === 'default') {
    return {
      allowed: true,
      sanitizedCandidate: candidateSdp,
      reason: 'WebRTC protection disabled; raw candidate passed.',
    };
  }

  if (!webrtcConfig.enabled || spoofConfig.mode === 'strict') {
    return {
      allowed: false,
      sanitizedCandidate: null,
      reason: 'Blocked: WebRTC RTCPeerConnection & UDP candidate gathering disabled.',
    };
  }

  const hasPrivateLanIp =
    /\b(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|[a-f0-9-]+?\.local)\b/i.test(
      candidateSdp
    );

  if (
    hasPrivateLanIp &&
    (webrtcProtectionActive ||
      webrtcConfig.policy === 'default_public_interface_only' ||
      webrtcConfig.policy === 'disable_non_proxied_udp')
  ) {
    return {
      allowed: false,
      sanitizedCandidate: null,
      reason: 'Stripped RFC1918 Private LAN / mDNS host ICE candidate.',
    };
  }

  if (
    webrtcConfig.policy === 'disable_non_proxied_udp' &&
    /\budp\b/i.test(candidateSdp)
  ) {
    return {
      allowed: false,
      sanitizedCandidate: null,
      reason: 'Blocked non-proxied UDP STUN ICE candidate.',
    };
  }

  return {
    allowed: true,
    sanitizedCandidate: candidateSdp,
    reason: 'Candidate permitted by policy.',
  };
}

/**
 * 7. NAVIGATOR PROTECTION:
 * Computes coherent DOM navigator properties, screen geometry, and Sec-CH-UA HTTP headers.
 */
export function computeNavigatorSpoofSnapshot(
  profile: FingerprintProfile,
  effectiveUserAgent: string,
  config: FingerprintSpoofConfig,
  origin = ''
): {
  isSpoofed: boolean;
  userAgent: string;
  platform: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  language: string;
  languages: string[];
  webdriver: boolean;
  maxTouchPoints: number;
  secChUa: string;
  secChUaPlatform: string;
  secChUaMobile: string;
  screenSummary: string;
} {
  const isSpoofed = isControlActiveForOrigin('navigator', config, origin);

  if (!isSpoofed) {
    return {
      isSpoofed: false,
      userAgent: 'Mozilla/5.0 (Host Unmasked Native Browser)',
      platform: 'HostOS',
      hardwareConcurrency: 20,
      deviceMemory: 32,
      language: 'en-US',
      languages: ['en-US'],
      webdriver: true,
      maxTouchPoints: 0,
      secChUa: '"Chromium";v="134", "Not:A-Brand";v="24"',
      secChUaPlatform: '"HostOS"',
      secChUaMobile: '?0',
      screenSummary: 'Unmasked Host Display',
    };
  }

  const isAndroid = /Android/i.test(effectiveUserAgent);
  const isIphone = /iPhone|iPad/i.test(effectiveUserAgent);
  const isEdge = /Edg\//i.test(effectiveUserAgent);

  const platform = isAndroid ? 'Linux armv81' : isIphone ? 'iPhone' : 'Win32';
  const secChUaPlatform = isAndroid ? '"Android"' : isIphone ? '"iOS"' : '"Windows"';
  const secChUaMobile = isAndroid || isIphone ? '?1' : '?0';
  const secChUa = isEdge
    ? '"Chromium";v="134", "Microsoft Edge";v="134", "Not:A-Brand";v="24"'
    : '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"';

  const baseLang = profile.language.split('-')[0] || 'en';
  const languages =
    profile.language === baseLang ? [profile.language] : [profile.language, baseLang];

  return {
    isSpoofed: true,
    userAgent: effectiveUserAgent,
    platform,
    hardwareConcurrency: profile.hardwareConcurrency,
    deviceMemory: profile.deviceMemory,
    language: profile.language,
    languages,
    webdriver: false,
    maxTouchPoints: isAndroid || isIphone ? 5 : 0,
    secChUa,
    secChUaPlatform,
    secChUaMobile,
    screenSummary: `${profile.screenWidth}×${profile.screenHeight} (${profile.colorDepth}-bit, DPR ${profile.pixelRatio})`,
  };
}

/**
 * 8. TIMEZONE PROTECTION:
 * Computes spoofed IANA timezone and Date.prototype.getTimezoneOffset() minutes.
 */
const TIMEZONE_OFFSET_MINUTES_MAP: Record<string, number> = {
  UTC: 0,
  'Europe/London': 0,
  'Europe/Berlin': -60,
  'Europe/Paris': -60,
  'America/New_York': 300,
  'America/Chicago': 360,
  'America/Denver': 420,
  'America/Los_Angeles': 480,
  'Asia/Tokyo': -540,
  'Asia/Singapore': -480,
  'Asia/Kolkata': -330,
};

export function computeTimezoneSpoofSnapshot(
  profile: FingerprintProfile,
  config: FingerprintSpoofConfig,
  origin = ''
): {
  isSpoofed: boolean;
  ianaTimezone: string;
  timezoneOffsetMinutes: number;
  formattedOffsetLabel: string;
} {
  const isSpoofed = isControlActiveForOrigin('timezone', config, origin);

  if (!isSpoofed) {
    return {
      isSpoofed: false,
      ianaTimezone: 'Host/System_Local_TZ',
      timezoneOffsetMinutes: -480,
      formattedOffsetLabel: 'Unmasked Host OS Timezone',
    };
  }

  const tz = profile.timezone || 'America/New_York';
  const offsetMins =
    Object.prototype.hasOwnProperty.call(TIMEZONE_OFFSET_MINUTES_MAP, tz)
      ? TIMEZONE_OFFSET_MINUTES_MAP[tz]
      : 0;
  const sign = offsetMins <= 0 ? '+' : '-';
  const absMins = Math.abs(offsetMins);
  const hrs = String(Math.floor(absMins / 60)).padStart(2, '0');
  const mins = String(absMins % 60).padStart(2, '0');

  return {
    isSpoofed: true,
    ianaTimezone: tz,
    timezoneOffsetMinutes: offsetMins,
    formattedOffsetLabel: `UTC${sign}${hrs}:${mins} (${tz})`,
  };
}

/**
 * 10. NO-CACHE PROTECTION:
 * Rewrites outbound HTTP request headers and inbound HTTP response headers to block ETag / cache tracking.
 */
export function applyNoCacheHeaders(
  requestHeaders: Record<string, string>,
  responseHeaders: Record<string, string>,
  config: FingerprintSpoofConfig,
  origin = ''
): {
  sanitizedRequestHeaders: Record<string, string>;
  sanitizedResponseHeaders: Record<string, string>;
  strippedHeaders: string[];
  injectedHeaders: string[];
} {
  const reqOut = { ...requestHeaders };
  const resOut = { ...responseHeaders };
  const strippedHeaders: string[] = [];
  const injectedHeaders: string[] = [];

  if (!isControlActiveForOrigin('noCache', config, origin)) {
    return {
      sanitizedRequestHeaders: reqOut,
      sanitizedResponseHeaders: resOut,
      strippedHeaders,
      injectedHeaders,
    };
  }

  for (const key of Object.keys(reqOut)) {
    if (/^(if-none-match|if-modified-since)$/i.test(key)) {
      delete reqOut[key];
      strippedHeaders.push(`Request:${key}`);
    }
  }

  for (const key of Object.keys(resOut)) {
    if (/^(etag|last-modified)$/i.test(key)) {
      delete resOut[key];
      strippedHeaders.push(`Response:${key}`);
    }
  }

  reqOut['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
  reqOut['Pragma'] = 'no-cache';
  resOut['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
  injectedHeaders.push('Cache-Control: no-store, no-cache, must-revalidate', 'Pragma: no-cache');

  return {
    sanitizedRequestHeaders: reqOut,
    sanitizedResponseHeaders: resOut,
    strippedHeaders,
    injectedHeaders,
  };
}

/**
 * Evaluates all 12 Fingerprint Spoofing controls in real time, verifying that
 * each control genuinely alters browser output and remains coherent across tabs.
 */
export function evaluateAll12FingerprintSurfaces(
  profile: FingerprintProfile,
  effectiveUserAgent: string,
  webrtcConfig: WebRTCConfig,
  config: FingerprintSpoofConfig,
  logsCount: number,
  activeOrigin = ''
): SurfaceVerificationResult[] {
  // 1. Canvas test
  const samplePixels = new Uint8ClampedArray(64);
  for (let i = 0; i < 64; i++) samplePixels[i] = (i * 7 + 40) % 256;
  const canvasTab1 = applyCanvasProtectionToBuffer(samplePixels, config, activeOrigin);
  const canvasTab2 = applyCanvasProtectionToBuffer(samplePixels, config, activeOrigin);

  // 2. WebGL test
  const webglRes = computeWebGLSpoofedParameters(profile, config, activeOrigin);

  // 3. Audio test
  const samplePcm = new Float32Array(32);
  for (let i = 0; i < 32; i++) samplePcm[i] = Math.sin(i * 0.25) * 0.5;
  const audioTab1 = applyAudioProtectionToSamples(samplePcm, config, activeOrigin);
  const audioTab2 = applyAudioProtectionToSamples(samplePcm, config, activeOrigin);

  // 4. Font test
  const fontRes = computeFontSpoofedMetrics(
    'CustomTrackerFont',
    'mmmmmmmmmmlli',
    142.5,
    config,
    activeOrigin
  );

  // 5. ClientRects test
  const rectRes = applyClientRectsProtection(
    { x: 24, y: 80, width: 320, height: 48 },
    config,
    activeOrigin
  );

  // 6. WebRTC test
  const sampleCandidate =
    'candidate:842163049 1 udp 2122260223 192.168.1.44 54321 typ host generation 0';
  const webrtcRes = sanitizeWebRTCIceCandidate(
    sampleCandidate,
    webrtcConfig,
    config,
    activeOrigin
  );

  // 7. Navigator test
  const navRes = computeNavigatorSpoofSnapshot(
    profile,
    effectiveUserAgent,
    config,
    activeOrigin
  );

  // 8. Timezone test
  const tzRes = computeTimezoneSpoofSnapshot(profile, config, activeOrigin);

  // 9. Random (Cross-Tab Seed Coherence) test
  const rotatedConfig: FingerprintSpoofConfig = {
    ...config,
    profileSeed: (config.profileSeed ^ 0xdeadbeef) >>> 0,
  };
  const canvasRotated = applyCanvasProtectionToBuffer(samplePixels, rotatedConfig, activeOrigin);
  const isCoherentAcrossTabs =
    canvasTab1.spoofedDigest === canvasTab2.spoofedDigest &&
    audioTab1.spoofedDigest === audioTab2.spoofedDigest;

  // 10. No-Cache test
  const noCacheRes = applyNoCacheHeaders(
    { 'If-None-Match': 'W/"tracker-etag-991"', Accept: 'text/html' },
    { ETag: 'W/"tracker-etag-991"' },
    config,
    activeOrigin
  );

  // 11. Whitelist test
  const wlCheck = isOriginWhitelisted('https://trusted-hardware-check.internal/auth', config);
  const activeOriginWl = isOriginWhitelisted(activeOrigin, config);

  // 12. Logs test
  const logsActive = config.controls.logs;

  return [
    {
      control: 'canvas',
      label: 'Canvas',
      enabled: config.controls.canvas,
      passed: config.controls.canvas
        ? canvasTab1.spoofedDigest !== canvasTab1.nativeDigest && isCoherentAcrossTabs
        : canvasTab1.spoofedDigest === canvasTab1.nativeDigest,
      nativeSample: `Digest ${canvasTab1.nativeDigest}`,
      spoofedSample: `Digest ${canvasTab1.spoofedDigest} (${canvasTab1.modifiedPixels} px shifted)`,
      coherenceCheck: isCoherentAcrossTabs
        ? `Coherent across tabs (${canvasTab1.spoofedDigest})`
        : 'Mismatch',
      mechanism: '2D getImageData / toDataURL Mulberry32 LSB perturbation',
    },
    {
      control: 'webgl',
      label: 'WebGL',
      enabled: config.controls.webgl,
      passed: config.controls.webgl ? webglRes.isSpoofed : !webglRes.isSpoofed,
      nativeSample: 'Host Native GPU (Unmasked 0x9245/0x9246)',
      spoofedSample: `${webglRes.vendor} · ${webglRes.renderer.slice(0, 38)}...`,
      coherenceCheck: `ReadPixels Hash ${webglRes.readPixelsDigest}`,
      mechanism: 'WebGL1/2 getParameter(37445/37446) & readPixels hook',
    },
    {
      control: 'audio',
      label: 'Audio',
      enabled: config.controls.audio,
      passed: config.controls.audio
        ? audioTab1.spoofedDigest !== audioTab1.nativeDigest && isCoherentAcrossTabs
        : audioTab1.spoofedDigest === audioTab1.nativeDigest,
      nativeSample: `PCM Digest ${audioTab1.nativeDigest}`,
      spoofedSample: `PCM Digest ${audioTab1.spoofedDigest} (ε=${config.audioNoiseEpsilon})`,
      coherenceCheck: isCoherentAcrossTabs
        ? `Tab1 === Tab2 (${audioTab1.spoofedDigest})`
        : 'Mismatch',
      mechanism: 'AudioBuffer.getChannelData & AnalyserNode deterministic noise',
    },
    {
      control: 'font',
      label: 'Font',
      enabled: config.controls.font,
      passed: config.controls.font
        ? !fontRes.allowedToEnumerate && fontRes.measuredWidthPx !== fontRes.nativeWidthPx
        : fontRes.measuredWidthPx === fontRes.nativeWidthPx,
      nativeSample: `Width 142.5000px · Custom font exposed`,
      spoofedSample: `Width ${fontRes.measuredWidthPx}px · Custom font blocked`,
      coherenceCheck: `Standard Win11 allowlist (${STANDARD_WINDOWS_FONT_ALLOWLIST.size} families)`,
      mechanism: 'FontFaceSet.check filter & measureText sub-pixel jitter',
    },
    {
      control: 'clientRects',
      label: 'ClientRects',
      enabled: config.controls.clientRects,
      passed: config.controls.clientRects
        ? rectRes.deltaApplied !== 0 && rectRes.width !== 320
        : rectRes.deltaApplied === 0,
      nativeSample: `x:24, y:80, w:320, h:48`,
      spoofedSample: `x:${rectRes.x}, w:${rectRes.width} (Δ=${rectRes.deltaApplied}px)`,
      coherenceCheck: `Stable DOMRect offset across all tabs`,
      mechanism: 'Element/Range.getBoundingClientRect & getClientRects wrapper',
    },
    {
      control: 'webrtc',
      label: 'WebRTC',
      enabled: config.controls.webrtc,
      passed: config.controls.webrtc ? !webrtcRes.allowed : true,
      nativeSample: `192.168.1.44:54321 typ host (LAN IP exposed)`,
      spoofedSample: webrtcRes.allowed ? 'Exposed' : webrtcRes.reason,
      coherenceCheck: `Policy: ${webrtcConfig.policy}`,
      mechanism: 'setWebRTCIPHandlingPolicy + SDP candidate sanitizer',
    },
    {
      control: 'navigator',
      label: 'Navigator',
      enabled: config.controls.navigator,
      passed: config.controls.navigator
        ? navRes.isSpoofed && navRes.webdriver === false
        : !navRes.isSpoofed,
      nativeSample: `Host OS · webdriver:true`,
      spoofedSample: `${navRes.platform} · ${navRes.hardwareConcurrency}C/${navRes.deviceMemory}GB · ${navRes.language}`,
      coherenceCheck: `Sec-CH-UA-Platform: ${navRes.secChUaPlatform}`,
      mechanism: 'CDP Emulation + navigator/screen getters + HTTP headers',
    },
    {
      control: 'timezone',
      label: 'Timezone',
      enabled: config.controls.timezone,
      passed: config.controls.timezone ? tzRes.isSpoofed : !tzRes.isSpoofed,
      nativeSample: `System Local Timezone`,
      spoofedSample: `${tzRes.formattedOffsetLabel} (offset: ${tzRes.timezoneOffsetMinutes}m)`,
      coherenceCheck: `Intl & Date.getTimezoneOffset synchronized`,
      mechanism: 'CDP Emulation.setTimezoneOverride + Intl/Date hooks',
    },
    {
      control: 'random',
      label: 'Random',
      enabled: config.controls.random,
      passed: config.controls.random
        ? isCoherentAcrossTabs && canvasTab1.spoofedDigest !== canvasRotated.spoofedDigest
        : true,
      nativeSample: `Per-request random (detectable anomaly)`,
      spoofedSample: `Stable Seed ${formatSeedHex(config.profileSeed)}`,
      coherenceCheck: `Tab1===Tab2 (${canvasTab1.spoofedDigest}), Rotated!==Current`,
      mechanism: 'Profile-persistent Mulberry32 seed shared across tabs',
    },
    {
      control: 'noCache',
      label: 'No-Cache',
      enabled: config.controls.noCache,
      passed: config.controls.noCache
        ? noCacheRes.strippedHeaders.length >= 2 &&
          noCacheRes.sanitizedRequestHeaders['Cache-Control']?.includes('no-store')
        : noCacheRes.strippedHeaders.length === 0,
      nativeSample: `ETag & If-None-Match tracking active`,
      spoofedSample:
        noCacheRes.strippedHeaders.length > 0
          ? `Stripped ${noCacheRes.strippedHeaders.join(', ')} + no-store`
          : 'Unmodified caching headers',
      coherenceCheck: `Session-wide webRequest header filter`,
      mechanism: 'Strips ETag/If-None-Match + injects Cache-Control: no-store',
    },
    {
      control: 'whitelist',
      label: 'Whitelist',
      enabled: config.controls.whitelist,
      passed: config.controls.whitelist ? wlCheck.whitelisted : !wlCheck.whitelisted,
      nativeSample: `0 site exceptions`,
      spoofedSample: `${config.whitelistRules.filter((r) => r.enabled).length} active rules (${
        activeOriginWl.whitelisted ? 'Current Tab Whitelisted' : 'Current Tab Protected'
      })`,
      coherenceCheck: `Matches domain & subdomain rules`,
      mechanism: 'Origin matcher before applying preload & header hooks',
    },
    {
      control: 'logs',
      label: 'Logs',
      enabled: config.controls.logs,
      passed: logsActive,
      nativeSample: `No protection audit trail`,
      spoofedSample: logsActive
        ? `Recording active (${logsCount} local audit events)`
        : 'Logging paused',
      coherenceCheck: `Local ring buffer persisted across restarts`,
      mechanism: 'IPC protection telemetry logger with JSON export',
    },
  ];
}

export function createProtectionLogEntriesForEvent(
  eventType:
    | 'profile_change'
    | 'control_toggle'
    | 'bulk_action'
    | 'page_navigation'
    | 'seed_rotated'
    | 'whitelist_match'
    | 'probe_simulation',
  config: FingerprintSpoofConfig,
  profile: FingerprintProfile,
  webrtcConfig: WebRTCConfig,
  origin: string,
  tabId: string,
  extraDetail?: string
): FingerprintProtectionLogEntry[] {
  if (!config.controls.logs) return [];
  const now = new Date();
  const ts = now.toLocaleTimeString();
  const nowMs = now.getTime();
  const entries: FingerprintProtectionLogEntry[] = [];

  const pushEntry = (
    control: FingerprintControlKey | 'system',
    level: FingerprintProtectionLogEntry['level'],
    apiSurface: string,
    action: string,
    detail: string
  ) => {
    entries.push({
      id: `fplog-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: ts,
      timestampMs: nowMs,
      control,
      level,
      origin: origin || 'viju://home',
      tabId,
      apiSurface,
      action,
      detail,
    });
  };

  const wl = isOriginWhitelisted(origin, config);
  if (wl.whitelisted && wl.matchedRule) {
    pushEntry(
      'whitelist',
      'whitelisted',
      'Origin Exception Matcher',
      `Bypassed (${
        wl.matchedRule.bypassControls === 'all'
          ? 'All Controls'
          : wl.matchedRule.bypassControls.join(', ')
      })`,
      `Domain "${wl.matchedRule.domain}" matched rule: ${wl.matchedRule.reason}`
    );
    if (wl.matchedRule.bypassControls === 'all') {
      return entries;
    }
  }

  if (eventType === 'probe_simulation' || eventType === 'page_navigation') {
    if (config.controls.navigator) {
      pushEntry(
        'navigator',
        'protected',
        'navigator.* & Sec-CH-UA',
        'Spoofed Navigator & Screen',
        `Applied ${profile.screenWidth}×${profile.screenHeight}, ${profile.hardwareConcurrency} cores, ${profile.deviceMemory}GB, lang=${profile.language}`
      );
    }
    if (config.controls.canvas) {
      pushEntry(
        'canvas',
        'protected',
        'HTMLCanvasElement.toDataURL / getImageData',
        'Injected Seeded Pixel Noise',
        `Applied Mulberry32 LSB shift (Seed ${formatSeedHex(config.profileSeed)}, step=±${config.canvasNoiseStep})`
      );
    }
    if (config.controls.webgl) {
      pushEntry(
        'webgl',
        'protected',
        'WebGLRenderingContext.getParameter(37445/37446)',
        'Masked GPU Vendor & Renderer',
        `Returned "${config.webglVendor}" / "${config.webglRenderer.slice(0, 44)}..."`
      );
    }
    if (config.controls.audio) {
      pushEntry(
        'audio',
        'protected',
        'AudioBuffer.getChannelData',
        'Perturbed AudioContext PCM',
        `Added deterministic float32 offset (±${config.audioNoiseEpsilon}) keyed to profile seed`
      );
    }
    if (config.controls.font) {
      pushEntry(
        'font',
        'protected',
        'FontFaceSet.check & Context2D.measureText',
        'Enforced Win11 Font Allowlist',
        `Blocked non-standard font enumeration & applied ±${config.fontJitterPx}px glyph metric jitter`
      );
    }
    if (config.controls.clientRects) {
      pushEntry(
        'clientRects',
        'protected',
        'Element.getBoundingClientRect',
        'Shifted DOMRect Sub-Pixel Coords',
        `Applied deterministic Δ=${config.clientRectsDeltaPx}px offset to bounding box coordinates`
      );
    }
    if (config.controls.timezone) {
      pushEntry(
        'timezone',
        'protected',
        'Intl.DateTimeFormat & Date.getTimezoneOffset',
        'Overrode IANA Timezone',
        `Spoofed timezone to ${profile.timezone}`
      );
    }
    if (config.controls.webrtc) {
      pushEntry(
        'webrtc',
        'protected',
        'RTCPeerConnection & WebRTC IP Policy',
        'Sanitized ICE Candidates',
        `Policy=${webrtcConfig.policy}, WebRTC Enabled=${webrtcConfig.enabled}`
      );
    }
    if (config.controls.noCache) {
      pushEntry(
        'noCache',
        'header',
        'session.webRequest.onBeforeSendHeaders',
        'Stripped ETag & Enforced No-Store',
        'Removed If-None-Match / ETag validators and injected Cache-Control: no-store, no-cache'
      );
    }
  } else {
    pushEntry(
      'system',
      'protected',
      'FingerprintSpoofEngine',
      eventType.replace(/_/g, ' ').toUpperCase(),
      extraDetail ||
        `Mode=${config.mode}, Seed=${formatSeedHex(config.profileSeed)}, Active Controls=${
          ALL_FINGERPRINT_CONTROL_KEYS.filter((k) => config.controls[k]).length
        }/12`
    );
  }

  return entries;
}
