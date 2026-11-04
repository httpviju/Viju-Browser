export type WebRTCPolicy =
  | 'default'
  | 'default_public_and_private_interfaces'
  | 'default_public_interface_only'
  | 'disable_non_proxied_udp';

export interface WebRTCWhitelistRule {
  id: string;
  domain: string;
  enabled: boolean;
  note: string;
  addedAt: string;
}

export interface WebRTCShieldLogEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  origin: string;
  eventType:
    | 'local_ip_blocked'
    | 'public_ip_blocked'
    | 'udp_blocked'
    | 'proxy_enforced'
    | 'leak_test_executed'
    | 'whitelist_bypassed'
    | 'shield_config_changed'
    | 'webrtc_disabled';
  action: 'blocked' | 'allowed' | 'tested' | 'updated';
  summary: string;
  detail: string;
}

export type WebRTCLeakTestStatus =
  | 'not_tested'
  | 'running'
  | 'passed_no_leak'
  | 'leak_detected'
  | 'webrtc_blocked'
  | 'whitelisted_trusted';

export interface WebRTCLeakTestResult {
  status: WebRTCLeakTestStatus;
  testedAt: string | null;
  testedOrigin: string | null;
  localIpExposed: boolean;
  detectedLocalIps: string[];
  publicIpExposed: boolean;
  detectedPublicIps: string[];
  udpBlocked: boolean;
  proxyEnforced: boolean;
  candidatesEvaluated: number;
  candidatesBlocked: number;
  verdictSummary: string;
}

export interface WebRTCConfig {
  /** Master WebRTC Control toggle (enables/disables RTCPeerConnection globally) */
  enabled: boolean;
  /** Underlying Chromium webContents.setWebRTCIPHandlingPolicy value */
  policy: WebRTCPolicy;
  /** Master WebRTC Shield protection toggle */
  shieldEnabled?: boolean;
  /** Prevent RFC1918/mDNS local IP exposure through WebRTC host candidates */
  blockLocalIp?: boolean;
  /** Restrict public IP exposure through STUN server-reflexive candidates */
  blockPublicIp?: boolean;
  /** Restrict WebRTC UDP connections */
  blockUdp?: boolean;
  /** Prevent WebRTC from bypassing configured proxy settings */
  forceProxy?: boolean;
  /** Detect and report exposed IP addresses during WebRTC activity */
  leakDetectionEnabled?: boolean;
  /** Trusted domains where WebRTC is allowed to operate for video/voice calls */
  whitelistDomains?: WebRTCWhitelistRule[];
  /** Last performed WebRTC leak test result (starts as not_tested) */
  lastLeakTest?: WebRTCLeakTestResult;
  /** Local WebRTC Shield protection event logs */
  shieldLogs?: WebRTCShieldLogEntry[];
}

export type UserAgentPresetId =
  | 'default_desktop_chrome'
  | 'android_chrome'
  | 'iphone_safari'
  | 'windows_edge'
  | 'custom';

export interface UserAgentPreset {
  id: UserAgentPresetId;
  name: string;
  platformLabel: string;
  userAgent: string;
  platform: string;
  mobile: boolean;
}

export type UABrowserFamily = 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera';
export type UAOsFamily = 'linux' | 'windows' | 'macos' | 'android' | 'ios';

export type UAGeneratorComboKey =
  | 'chrome_macos'
  | 'chrome_windows'
  | 'edge_macos'
  | 'edge_windows'
  | 'firefox_macos'
  | 'firefox_windows'
  | 'opera_macos'
  | 'opera_windows'
  | 'safari_macos'
  | 'chrome_android'
  | 'chrome_linux'
  | 'firefox_android'
  | 'firefox_linux'
  | 'safari_iphone';

export type UAGeneratorToggles = Record<UAGeneratorComboKey, boolean>;

export interface CustomUserAgentItem {
  id: string;
  label: string;
  userAgent: string;
  browserFamily: UABrowserFamily;
  osFamily: UAOsFamily;
  appVersion: string;
  platform: string;
  vendor: string;
}

export interface UABlacklistRule {
  id: string;
  domain: string;
  enabled: boolean;
  note: string;
  createdAt: string;
}

export interface GeneratedUAProfile {
  id: string;
  comboKey: UAGeneratorComboKey | 'custom' | 'native';
  label: string;
  browserFamily: UABrowserFamily;
  osFamily: UAOsFamily;
  userAgent: string;
  appVersion: string;
  platform: string;
  vendor: string;
  oscpu?: string;
  mobile: boolean;
}

export interface RandomUASwitcherConfig {
  enabledGlobally: boolean;
  paused: boolean;
  autoRotateEnabled: boolean;
  autoRotateIntervalSeconds: number;
  remainingSeconds: number;
  rotateOnStartup: boolean;
  jsProtectionEnabled: boolean;
  syncWithOs: boolean;
  selectedBrowserFamily: UABrowserFamily;
  selectedOsFamily: UAOsFamily;
  useCustomAgentsMode: boolean;
  customAgentsList: CustomUserAgentItem[];
  activeCustomAgentId: string | null;
  generatorToggles: UAGeneratorToggles;
  blacklistDomains: UABlacklistRule[];
  activeGeneratedProfile: GeneratedUAProfile;
  rotationCount: number;
  lastRotatedAt: string | null;
}

export type FingerprintControlKey =
  | 'canvas'
  | 'webgl'
  | 'audio'
  | 'font'
  | 'clientRects'
  | 'webrtc'
  | 'navigator'
  | 'timezone'
  | 'random'
  | 'noCache'
  | 'whitelist'
  | 'logs';

export interface FingerprintSpoofControls {
  canvas: boolean;
  webgl: boolean;
  audio: boolean;
  font: boolean;
  clientRects: boolean;
  webrtc: boolean;
  navigator: boolean;
  timezone: boolean;
  random: boolean;
  noCache: boolean;
  whitelist: boolean;
  logs: boolean;
}

export interface WhitelistSiteRule {
  id: string;
  domain: string;
  enabled: boolean;
  bypassControls: FingerprintControlKey[] | 'all';
  reason: string;
  addedAt: string;
}

export interface FingerprintProtectionLogEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  control: FingerprintControlKey | 'system';
  level: 'protected' | 'whitelisted' | 'header' | 'warning' | 'error';
  origin: string;
  tabId: string;
  apiSurface: string;
  action: string;
  detail: string;
}

export interface FingerprintSpoofConfig {
  mode: 'maximum_default' | 'strict' | 'custom' | 'disabled';
  controls: FingerprintSpoofControls;
  profileSeed: number;
  webglVendor: string;
  webglRenderer: string;
  audioNoiseEpsilon: number;
  canvasNoiseStep: number;
  clientRectsDeltaPx: number;
  fontJitterPx: number;
  whitelistRules: WhitelistSiteRule[];
}

export interface SurfaceVerificationResult {
  control: FingerprintControlKey;
  label: string;
  enabled: boolean;
  passed: boolean;
  nativeSample: string;
  spoofedSample: string;
  coherenceCheck: string;
  mechanism: string;
}

export interface FingerprintProfile {
  id: string;
  name: string;
  description: string;
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  pixelRatio: number;
  hardwareConcurrency: number;
  deviceMemory: number;
  language: string;
  timezone: string;
  doNotTrack: '1' | 'unspecified';
  webglVendor?: string;
  webglRenderer?: string;
  platform?: string;
}

export interface AutoRefreshState {
  intervalSeconds: number;
  status: 'stopped' | 'running' | 'paused';
  remainingSeconds: number;
  refreshCount: number;
  lastRefreshedAt: string | null;
}

export interface TabItem {
  id: string;
  title: string;
  url: string;
  faviconType: 'viju' | 'lock' | 'search' | 'globe' | 'shield' | 'code';
  isLoading: boolean;
  historyStack: string[];
  historyIndex: number;
  userAgentPresetId: UserAgentPresetId;
  customUserAgent: string;
  effectiveUserAgent: string;
  fingerprintProfileId: string;
  autoRefresh: AutoRefreshState;
  lastLoadedAt: string;
  reloadCounter: number;
}

export interface ClosedTabRecord {
  tab: TabItem;
  closedAt: string;
}

export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  category: string;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: string;
  timestampMs: number;
  tabId: string;
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  status: 'progressing' | 'paused' | 'completed' | 'cancelled' | 'failed';
  startedAt: string;
  timestampMs: number;
  speedKbps: number;
}

export interface FormAutofillEntry {
  id: string;
  fieldName: string;
  value: string;
  origin: string;
  savedAt: string;
  timestampMs: number;
}

export interface SavedPasswordEntry {
  id: string;
  origin: string;
  username: string;
  savedAt: string;
  timestampMs: number;
}

export type ClearTimeRange =
  | 'last_15_min'
  | 'last_hour'
  | 'last_day'
  | 'last_week'
  | 'last_month'
  | 'everything';

export interface WebDataClearOptions {
  appCache: boolean;
  cache: boolean;
  cacheStorage: boolean;
  cookies: boolean;
  fileSystems: boolean;
  indexedDB: boolean;
  localStorage: boolean;
  serviceWorkers: boolean;
  webSQL: boolean;
}

export interface BrowserDataClearOptions {
  downloads: boolean;
  formData: boolean;
  history: boolean;
  passwords: boolean;
}

export interface ClearBrowsingDataPayload {
  timeRange: ClearTimeRange;
  webData: WebDataClearOptions;
  browserData: BrowserDataClearOptions;
}

export interface CacheStorageMetrics {
  appCacheKB: number;
  cacheMB: number;
  cacheStorageMB: number;
  cookiesCount: number;
  fileSystemsKB: number;
  indexedDBKB: number;
  localStorageKB: number;
  serviceWorkersCount: number;
  webSQLKB: number;
  lastClearedAt: string | null;
}

export type ActiveSidePanel =
  | 'none'
  | 'auto-refresh'
  | 'user-agent'
  | 'fingerprint'
  | 'webrtc'
  | 'clear-cache'
  | 'downloads'
  | 'bookmarks-history'
  | 'electron-source';

export interface ElectronSourceFile {
  filename: string;
  path: string;
  language: 'json' | 'javascript' | 'html' | 'css' | 'markdown' | 'yaml';
  description: string;
  securityNotes: string[];
  content: string;
}
