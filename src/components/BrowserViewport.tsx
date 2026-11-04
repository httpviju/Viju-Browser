import React, { useState } from 'react';
import {
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Timer,
  Smartphone,
  Fingerprint,
  Radio,
  Trash2,
  Download,
  Code2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Globe,
  Lock,
  Settings,
} from 'lucide-react';
import {
  ActiveSidePanel,
  CacheStorageMetrics,
  ClearBrowsingDataPayload,
  DownloadItem,
  FingerprintControlKey,
  FingerprintProfile,
  FingerprintProtectionLogEntry,
  FingerprintSpoofConfig,
  FormAutofillEntry,
  HistoryEntry,
  RandomUASwitcherConfig,
  SavedPasswordEntry,
  TabItem,
  UABrowserFamily,
  UAOsFamily,
  UserAgentPresetId,
  WebRTCConfig,
  WhitelistSiteRule,
} from '../types/browser';
import {
  ALL_FINGERPRINT_CONTROL_KEYS,
  buildGitHubReleaseUrls,
  computePrivacyStatusSummary,
  DEFAULT_GITHUB_RELEASE_REPO,
  formatSeedHex,
  resolveEffectiveUserAgentForUrl,
  VIJU_INSTALLER_EXE_FILENAME,
  VIJU_PORTABLE_EXE_FILENAME,
} from '../utils/browserEngine';
import { ElectronSourceWorkbench } from './ElectronSourceWorkbench';
import { ClearBrowsingDataView } from './ClearBrowsingDataView';
import { FingerprintSpoofingPanel } from './FingerprintSpoofingPanel';
import { UserAgentSwitcherSettingsView } from './UserAgentSwitcherView';
import { WebRTCShieldView } from './WebRTCShieldView';

interface BrowserViewportProps {
  activeTab: TabItem;
  allTabs: TabItem[];
  fingerprintProfiles: FingerprintProfile[];
  activeFingerprintProfile: FingerprintProfile;
  webrtcConfig: WebRTCConfig;
  fingerprintSpoofConfig: FingerprintSpoofConfig;
  uaSwitcherConfig: RandomUASwitcherConfig;
  uaErrorBanner: string | null;
  uaStatusBanner: string | null;
  protectionLogs: FingerprintProtectionLogEntry[];
  cacheMetrics: CacheStorageMetrics;
  history: HistoryEntry[];
  downloads: DownloadItem[];
  formDataEntries: FormAutofillEntry[];
  savedPasswords: SavedPasswordEntry[];
  onNavigate: (input: string) => void;
  onOpenPanel: (panel: ActiveSidePanel) => void;
  onApplyUserAgent: (presetId: UserAgentPresetId, customString?: string) => void;
  onGetNewAgent: (preferredBrowser?: UABrowserFamily, preferredOs?: UAOsFamily) => void;
  onTogglePauseUASwitcher: () => void;
  onToggleCurrentDomainUA: (url: string) => void;
  onUpdateUASwitcherConfig: (
    updater: (prev: RandomUASwitcherConfig) => RandomUASwitcherConfig
  ) => void;
  onResetUADefaults: () => void;
  onSelectFingerprintProfile: (profileId: string) => void;
  onCreateOrUpdateFingerprintProfile: (
    profile: FingerprintProfile,
    webglVendor?: string,
    webglRenderer?: string
  ) => void;
  onToggleFingerprintControl: (control: FingerprintControlKey) => void;
  onFingerprintBulkAction: (
    action: 'enable_all' | 'disable_all' | 'reset_defaults' | 'strict_protection'
  ) => void;
  onGenerateCoherentRandomProfile: () => void;
  onAddWhitelistRule: (rule: Omit<WhitelistSiteRule, 'id' | 'addedAt'>) => void;
  onToggleWhitelistRule: (ruleId: string) => void;
  onDeleteWhitelistRule: (ruleId: string) => void;
  onSimulateFingerprintProbe: () => void;
  onClearProtectionLogs: () => void;
  onUpdateWebRTC: (config: WebRTCConfig) => void;
  onAutoRefreshCommand: (
    tabId: string,
    command: 'start' | 'pause' | 'resume' | 'stop',
    intervalSeconds?: number
  ) => void;
  onClearBrowserData: (payload: ClearBrowsingDataPayload) => {
    success: boolean;
    message: string;
    details: string[];
  };
  onAddSampleFormEntry: () => void;
  onTriggerDownload: (filename: string, url: string, sizeBytes: number) => void;
}

export const BrowserViewport: React.FC<BrowserViewportProps> = ({
  activeTab,
  allTabs,
  fingerprintProfiles,
  activeFingerprintProfile,
  webrtcConfig,
  fingerprintSpoofConfig,
  uaSwitcherConfig,
  uaErrorBanner,
  uaStatusBanner,
  protectionLogs,
  cacheMetrics,
  history,
  downloads,
  formDataEntries,
  savedPasswords,
  onNavigate,
  onOpenPanel,
  onApplyUserAgent,
  onGetNewAgent,
  onTogglePauseUASwitcher,
  onToggleCurrentDomainUA,
  onUpdateUASwitcherConfig,
  onResetUADefaults,
  onSelectFingerprintProfile,
  onCreateOrUpdateFingerprintProfile,
  onToggleFingerprintControl,
  onFingerprintBulkAction,
  onGenerateCoherentRandomProfile,
  onAddWhitelistRule,
  onToggleWhitelistRule,
  onDeleteWhitelistRule,
  onSimulateFingerprintProbe,
  onClearProtectionLogs,
  onUpdateWebRTC,
  onAutoRefreshCommand,
  onClearBrowserData,
  onAddSampleFormEntry,
  onTriggerDownload,
}) => {
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [settingsCategory, setSettingsCategory] = useState<
    'general' | 'ua-switcher' | 'privacy' | 'webrtc' | 'auto-refresh' | 'cache' | 'security'
  >('ua-switcher');

  const resolvedTabUa = resolveEffectiveUserAgentForUrl(activeTab.url, uaSwitcherConfig);

  const privacySummary = computePrivacyStatusSummary(
    webrtcConfig,
    activeFingerprintProfile,
    activeTab.userAgentPresetId
  );

  const enabledFpCount = ALL_FINGERPRINT_CONTROL_KEYS.filter(
    (k) => fingerprintSpoofConfig.controls[k]
  ).length;

  const handleHomeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (homeSearchQuery.trim()) {
      onNavigate(homeSearchQuery);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-[#0B0F19] overflow-hidden min-w-0">
      {/* Live Tab Session Context Strip */}
      <div className="h-7 px-3 bg-[#090D16] border-b border-slate-800/80 flex items-center justify-between gap-4 text-[11px] font-mono text-slate-400 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-blue-400 truncate max-w-[360px]" title={activeTab.effectiveUserAgent}>
            UA: {activeTab.effectiveUserAgent}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums whitespace-nowrap">
            Screen: {activeFingerprintProfile.screenWidth}×{activeFingerprintProfile.screenHeight} (
            {activeFingerprintProfile.colorDepth}-bit)
          </span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">
            WebRTC: {webrtcConfig.enabled ? webrtcConfig.policy : 'Disabled'}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 tabular-nums">
          <span>Reloads: #{activeTab.reloadCounter}</span>
          <span aria-hidden="true">·</span>
          <span>Loaded: {activeTab.lastLoadedAt}</span>
        </div>
      </div>

      {/* Scrollable Page Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* 1. VIJU START PAGE (viju://home) */}
        {activeTab.url === 'viju://home' && (
          <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Hero Omnibox & Quick Status */}
            <div className="p-6 rounded-xl bg-[#0F172A] border border-slate-800 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-blue-400">
                    Viju Browser v1.4.0 · Electron 35 · Chromium 134 Security Hardened
                  </div>
                  <h1 className="text-2xl font-bold text-slate-100 mt-1">
                    Custom Windows Desktop Browser & Privacy Workbench
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                  <a
                    href={
                      buildGitHubReleaseUrls(DEFAULT_GITHUB_RELEASE_REPO)
                        .installerExeDownloadUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      const urls = buildGitHubReleaseUrls(DEFAULT_GITHUB_RELEASE_REPO);
                      onTriggerDownload(
                        VIJU_INSTALLER_EXE_FILENAME,
                        urls.installerExeDownloadUrl,
                        84_500_000
                      );
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Direct Download .EXE (GitHub Releases)</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => onNavigate('viju://electron-source')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Code2 className="w-4 h-4" />
                    <span>GitHub Release Hub & Source</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleHomeSearch} className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-[#090D16] border border-slate-700 focus-within:border-blue-500 rounded-lg px-3.5 py-2.5 gap-2.5">
                  <Search className="w-4 h-4 text-blue-400 shrink-0" />
                  <input
                    type="text"
                    value={homeSearchQuery}
                    onChange={(e) => setHomeSearchQuery(e.target.value)}
                    placeholder="Enter URL (e.g. example.com, browserleaks.com) or search Google..."
                    className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                >
                  Navigate
                </button>
              </form>

              {/* Quick Navigation Shortcuts */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-slate-400 font-medium mr-1">Quick Launch:</span>
                {[
                  { label: 'Example.com', url: 'https://example.com' },
                  { label: 'BrowserLeaks Audit', url: 'https://browserleaks.com/webrtc' },
                  { label: 'Chromium Security', url: 'https://www.chromium.org/Home/chromium-security/' },
                  { label: 'Electron Docs', url: 'https://www.electronjs.org/docs/latest/tutorial/security' },
                  { label: 'Fingerprint Signal Inspector', url: 'viju://fingerprint' },
                  { label: 'WebRTC Policy Tester', url: 'viju://webrtc-test' },
                  { label: 'Browser Settings', url: 'viju://settings' },
                ].map((link) => (
                  <button
                    key={link.url}
                    type="button"
                    onClick={() => onNavigate(link.url)}
                    className="px-3 py-1.5 rounded-lg bg-[#090D16] hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Built-in Security & Automation Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Auto Refresh Plus Card */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">
                      Auto Refresh Plus
                    </span>
                    <Timer className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Independent per-tab countdown timers with a strict 5-second minimum
                    interval, start/pause/stop controls, and persistent local state.
                  </p>
                  <div className="text-xs font-mono tabular-nums text-blue-400 pt-1">
                    Active Tab: {activeTab.autoRefresh.status.toUpperCase()} (
                    {activeTab.autoRefresh.intervalSeconds}s interval)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPanel('auto-refresh')}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                >
                  Configure Auto Refresh Plus
                </button>
              </div>

              {/* Random User-Agent Switcher Card */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">
                      Random User-Agent Switcher
                    </span>
                    <Smartphone className="w-4 h-4 text-sky-400" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    14 Browser/OS generator combinations (9 ON, 5 OFF by default), interval
                    auto-rotation, startup rotation, custom UA rotation, and domain blacklist.
                  </p>
                  <div className="text-[11px] font-mono text-sky-400 truncate pt-1">
                    Active: {uaSwitcherConfig.activeGeneratedProfile.label} · Rotations: #
                    {uaSwitcherConfig.rotationCount}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenPanel('user-agent')}
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                  >
                    Open Popup
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('viju://ua-settings')}
                    className="py-2 px-3 rounded-lg bg-[#090D16] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs transition-colors"
                  >
                    UA Settings
                  </button>
                </div>
              </div>

              {/* Fingerprint Privacy Controls Card */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">
                      Fingerprint Spoofing (12 Controls)
                    </span>
                    <Fingerprint className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Maximum-level protection across Canvas, WebGL, Audio, Font, ClientRects,
                    WebRTC, Navigator, Timezone, Random Seed, No-Cache, Whitelist, and Logs.
                  </p>
                  <div className="text-xs font-mono tabular-nums text-blue-400 pt-1">
                    {enabledFpCount}/12 Active · Seed{' '}
                    {formatSeedHex(fingerprintSpoofConfig.profileSeed)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenPanel('fingerprint')}
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                  >
                    Configure 12 Controls
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('viju://fingerprint')}
                    className="py-2 px-3 rounded-lg bg-[#090D16] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs transition-colors"
                  >
                    Verify Suite
                  </button>
                </div>
              </div>

              {/* WebRTC Control & Shield Card */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">
                      WebRTC Control & Shield
                    </span>
                    <Radio className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Master WebRTC enable/disable switch plus Chromium IP handling policies to
                    strip private LAN ICE candidates or block non-proxied UDP.
                  </p>
                  <div className="text-xs font-mono text-emerald-400 pt-1">
                    {privacySummary.webrtcSummary}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenPanel('webrtc')}
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                  >
                    Configure WebRTC
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('viju://webrtc-test')}
                    className="py-2 px-3 rounded-lg bg-[#090D16] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs transition-colors"
                  >
                    Test Policy
                  </button>
                </div>
              </div>

              {/* Clear Cache & Storage Card */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">
                      Clear Browsing Data
                    </span>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Time-ranged cleanup across 9 Web Data storages and 4 Browser Data
                    categories (Downloads, Form Data, History, Passwords).
                  </p>
                  <div className="text-xs font-mono tabular-nums text-slate-300 pt-1">
                    Cache: {cacheMetrics.cacheMB.toFixed(1)} MB · Cookies:{' '}
                    {cacheMetrics.cookiesCount} · Forms: {formDataEntries.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPanel('clear-cache')}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                >
                  Open Clear Browsing Data Panel
                </button>
              </div>

              {/* Download Manager & Electron Deliverables Card */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">
                      Downloads & Windows .EXE
                    </span>
                    <Download className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Track real-time file downloads with progress bars or view the complete
                    Electron source files and Windows installer build steps.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenPanel('downloads')}
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                  >
                    Downloads
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('viju://electron-source')}
                    className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                  >
                    Electron Source
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. FINGERPRINT SIGNAL INSPECTOR (viju://fingerprint or viju://privacy) */}
        {(activeTab.url === 'viju://fingerprint' || activeTab.url === 'viju://privacy') && (
          <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-blue-400">
                  viju://fingerprint · 12-Surface Maximum-Level Fingerprint Spoofing Engine
                </div>
                <h1 className="text-xl font-bold text-slate-100 mt-1">
                  Fingerprint Spoofing Workbench & Automated Verification Suite
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Configure all 12 protection surfaces (Canvas, WebGL, Audio, Font,
                  ClientRects, WebRTC, Navigator, Timezone, Random Seed, No-Cache,
                  Whitelist, Logs) and verify real-time output changes across all open tabs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenPanel('fingerprint')}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0 self-start"
              >
                Open Side Panel Drawer
              </button>
            </div>

            <FingerprintSpoofingPanel
              layout="full"
              activeTabUrl={activeTab.url}
              openTabsCount={allTabs.length}
              effectiveUserAgent={activeTab.effectiveUserAgent}
              fingerprintProfiles={fingerprintProfiles}
              activeFingerprintProfile={activeFingerprintProfile}
              webrtcConfig={webrtcConfig}
              spoofConfig={fingerprintSpoofConfig}
              protectionLogs={protectionLogs}
              onToggleControl={onToggleFingerprintControl}
              onBulkAction={onFingerprintBulkAction}
              onGenerateCoherentRandomProfile={onGenerateCoherentRandomProfile}
              onSelectFingerprintProfile={onSelectFingerprintProfile}
              onCreateOrUpdateFingerprintProfile={onCreateOrUpdateFingerprintProfile}
              onAddWhitelistRule={onAddWhitelistRule}
              onToggleWhitelistRule={onToggleWhitelistRule}
              onDeleteWhitelistRule={onDeleteWhitelistRule}
              onSimulateFingerprintProbe={onSimulateFingerprintProbe}
              onClearProtectionLogs={onClearProtectionLogs}
            />
          </div>
        )}

        {/* 3. WEBRTC SHIELD & ICE LEAK INSPECTOR (viju://webrtc-test) */}
        {activeTab.url === 'viju://webrtc-test' && (
          <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-blue-400">
                  viju://webrtc-test · Chromium WebRTC IP Handling Policy & WebRTC Shield Audit
                </div>
                <h1 className="text-xl font-bold text-slate-100 mt-1">
                  WebRTC Shield & ICE Candidate Leak Diagnostic Console
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Configure all 7 WebRTC Shield controls (Enable WebRTC Shield, Block Local IP
                  Exposure, Block Public IP Exposure, Block UDP, Force Proxy for WebRTC, Leak
                  Detection, and Whitelist), inspect Shield Status & Last Protection Event, and
                  run live WebRTC leak tests.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenPanel('webrtc')}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0"
              >
                Open Side Panel Drawer
              </button>
            </div>

            <WebRTCShieldView
              layout="full"
              activeTabUrl={activeTab.url}
              webrtcConfig={webrtcConfig}
              onUpdateWebRTC={onUpdateWebRTC}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {/* 4. RANDOM USER-AGENT SWITCHER FULL SETTINGS (viju://ua-settings) */}
        {activeTab.url === 'viju://ua-settings' && (
          <div className="p-6 max-w-6xl mx-auto">
            <UserAgentSwitcherSettingsView
              activeTabUrl={activeTab.url}
              uaConfig={uaSwitcherConfig}
              errorBanner={uaErrorBanner}
              statusBanner={uaStatusBanner}
              onGetNewAgent={onGetNewAgent}
              onTogglePauseSwitcher={onTogglePauseUASwitcher}
              onToggleCurrentDomain={onToggleCurrentDomainUA}
              onUpdateConfig={onUpdateUASwitcherConfig}
              onResetDefaults={onResetUADefaults}
            />
          </div>
        )}

        {/* 5. SETTINGS PAGE (viju://settings) */}
        {activeTab.url === 'viju://settings' && (
          <div className="p-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-3 space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
                Viju Settings
              </div>
              {(
                [
                  { id: 'ua-switcher', label: 'Random User-Agent Switcher' },
                  { id: 'privacy', label: 'Fingerprint Spoofing (12 Controls)' },
                  { id: 'webrtc', label: 'WebRTC Control & Shield' },
                  { id: 'auto-refresh', label: 'Auto Refresh Plus' },
                  { id: 'cache', label: 'Clear Cache & Storage' },
                  { id: 'security', label: 'Electron Security Model' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSettingsCategory(cat.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    settingsCategory === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0F172A] text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="md:col-span-9 p-6 rounded-xl bg-[#0F172A] border border-slate-800 space-y-5">
              {settingsCategory === 'ua-switcher' && (
                <UserAgentSwitcherSettingsView
                  activeTabUrl={activeTab.url}
                  uaConfig={uaSwitcherConfig}
                  errorBanner={uaErrorBanner}
                  statusBanner={uaStatusBanner}
                  onGetNewAgent={onGetNewAgent}
                  onTogglePauseSwitcher={onTogglePauseUASwitcher}
                  onToggleCurrentDomain={onToggleCurrentDomainUA}
                  onUpdateConfig={onUpdateUASwitcherConfig}
                  onResetDefaults={onResetUADefaults}
                />
              )}

              {settingsCategory === 'privacy' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-100">
                    Maximum-Level Fingerprint Spoofing (12 Controls)
                  </h2>
                  <FingerprintSpoofingPanel
                    layout="full"
                    activeTabUrl={activeTab.url}
                    openTabsCount={allTabs.length}
                    effectiveUserAgent={activeTab.effectiveUserAgent}
                    fingerprintProfiles={fingerprintProfiles}
                    activeFingerprintProfile={activeFingerprintProfile}
                    webrtcConfig={webrtcConfig}
                    spoofConfig={fingerprintSpoofConfig}
                    protectionLogs={protectionLogs}
                    onToggleControl={onToggleFingerprintControl}
                    onBulkAction={onFingerprintBulkAction}
                    onGenerateCoherentRandomProfile={onGenerateCoherentRandomProfile}
                    onSelectFingerprintProfile={onSelectFingerprintProfile}
                    onCreateOrUpdateFingerprintProfile={onCreateOrUpdateFingerprintProfile}
                    onAddWhitelistRule={onAddWhitelistRule}
                    onToggleWhitelistRule={onToggleWhitelistRule}
                    onDeleteWhitelistRule={onDeleteWhitelistRule}
                    onSimulateFingerprintProbe={onSimulateFingerprintProbe}
                    onClearProtectionLogs={onClearProtectionLogs}
                  />
                </div>
              )}

              {settingsCategory === 'webrtc' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-100">
                    WebRTC Shield & Integrated WebRTC Control
                  </h2>
                  <WebRTCShieldView
                    layout="full"
                    activeTabUrl={activeTab.url}
                    webrtcConfig={webrtcConfig}
                    onUpdateWebRTC={onUpdateWebRTC}
                    onNavigate={onNavigate}
                  />
                </div>
              )}

              {settingsCategory === 'auto-refresh' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-100">
                    Auto Refresh Plus Multi-Tab Overview
                  </h2>
                  <p className="text-xs text-slate-400">
                    Minimum enforced interval: 5 seconds. Each tab runs an independent timer.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenPanel('auto-refresh')}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                  >
                    Open Auto Refresh Plus Control Drawer
                  </button>
                </div>
              )}

              {settingsCategory === 'cache' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">
                      Clear Browsing Data — Web Data & Browser Data
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Choose a time range and select individual Web Data and Browser Data
                      types to clear from the persistent Electron session.
                    </p>
                  </div>
                  <ClearBrowsingDataView
                    cacheMetrics={cacheMetrics}
                    history={history}
                    downloads={downloads}
                    formDataEntries={formDataEntries}
                    savedPasswords={savedPasswords}
                    onExecuteClearData={onClearBrowserData}
                    onAddSampleFormEntry={onAddSampleFormEntry}
                  />
                </div>
              )}

              {settingsCategory === 'security' && (
                <div className="space-y-3 text-xs text-slate-300">
                  <h2 className="text-lg font-bold text-slate-100">
                    Electron & Chromium Hardening Verification
                  </h2>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>
                      <code>contextIsolation: true</code> enforced on BrowserWindow and all
                      WebContentsViews.
                    </li>
                    <li>
                      <code>nodeIntegration: false</code> and <code>sandbox: true</code>{' '}
                      enabled across all renderers.
                    </li>
                    <li>
                      Strict IPC input validation in <code>ipc-validators.js</code> before any
                      privileged session or network call.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. ELECTRON SOURCE CODE & WINDOWS .EXE WORKBENCH (viju://electron-source) */}
        {activeTab.url === 'viju://electron-source' && (
          <ElectronSourceWorkbench
            onTriggerInstallerDownload={(filename, url, sizeBytes) => {
              const defaultUrls = buildGitHubReleaseUrls(DEFAULT_GITHUB_RELEASE_REPO);
              onTriggerDownload(
                filename || VIJU_INSTALLER_EXE_FILENAME,
                url || defaultUrls.installerExeDownloadUrl,
                sizeBytes || 84_500_000
              );
              onOpenPanel('downloads');
            }}
          />
        )}

        {/* 6. EXTERNAL WEB URL OR GOOGLE SEARCH RESULTS */}
        {!activeTab.url.startsWith('viju://') && (
          <div className="p-6 max-w-5xl mx-auto space-y-5">
            {/* Simulated Google Search Results View */}
            {activeTab.url.includes('google.com/search') ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-sky-400">
                      Google Search Fallback · {activeTab.url}
                    </div>
                    <h1 className="text-lg font-bold text-slate-100 mt-0.5">
                      Search Results for &ldquo;
                      {decodeURIComponent(
                        new URL(activeTab.url).searchParams.get('q') || ''
                      )}
                      &rdquo;
                    </h1>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Accept-Language: {activeFingerprintProfile.language}
                  </span>
                </div>

                {[
                  {
                    title: `${decodeURIComponent(
                      new URL(activeTab.url).searchParams.get('q') || 'Topic'
                    )} — Technical Documentation & Reference`,
                    url: `https://www.chromium.org/search?q=${encodeURIComponent(
                      new URL(activeTab.url).searchParams.get('q') || ''
                    )}`,
                    snippet:
                      'Comprehensive architecture overview, security isolation guidelines, and Chromium implementation details.',
                  },
                  {
                    title: 'Electron Security Best Practices — Context Isolation & Sandbox',
                    url: 'https://www.electronjs.org/docs/latest/tutorial/security',
                    snippet:
                      'Official guidelines on contextIsolation, nodeIntegration, sandbox, preload scripts, and validating IPC messages.',
                  },
                  {
                    title: 'BrowserLeaks — WebRTC IP Leak & Client Signal Audit',
                    url: 'https://browserleaks.com/webrtc',
                    snippet:
                      'Verify whether STUN host and server-reflexive ICE candidates expose local LAN or public IP addresses.',
                  },
                ].map((result, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 space-y-1.5"
                  >
                    <div className="text-xs font-mono text-emerald-400 truncate">
                      {result.url}
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate(result.url)}
                      className="text-base font-semibold text-blue-400 hover:underline text-left"
                    >
                      {result.title}
                    </button>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {result.snippet}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              /* Navigated Website Document View */
              <div className="space-y-5">
                <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-mono text-emerald-400">
                        {activeTab.url}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onTriggerDownload(
                          'site-resource-bundle.zip',
                          `${activeTab.url.replace(/\/$/, '')}/bundle.zip`,
                          18_200_000
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Page Archive (.zip)</span>
                    </button>
                  </div>

                  <h1 className="text-xl font-bold text-slate-100">{activeTab.title}</h1>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Rendered inside Viju Browser isolated WebContents container (
                    <code className="text-blue-300">contextIsolation: true</code>,{' '}
                    <code className="text-blue-300">sandbox: true</code>, partition{' '}
                    <code className="text-blue-300">persist:viju-browser</code>).
                  </p>
                </div>

                {/* Live Environment Signals Seen by the Remote Origin */}
                <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-100">
                      HTTP Headers & DOM Navigator Properties Received by This Origin
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                        resolvedTabUa.isSwitchingActiveOnDomain
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                      }`}
                    >
                      {resolvedTabUa.statusReason}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-[#090D16] border border-slate-800">
                      <div className="text-slate-400">HTTP User-Agent / navigator.userAgent</div>
                      <div className="text-blue-300 mt-1 break-all">
                        {activeTab.effectiveUserAgent}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-2">
                        navigator.platform:{' '}
                        <span className="text-emerald-300">
                          {resolvedTabUa.effectiveProfile.platform}
                        </span>{' '}
                        · vendor:{' '}
                        <span className="text-emerald-300">
                          {resolvedTabUa.effectiveProfile.vendor || '(empty)'}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#090D16] border border-slate-800">
                      <div className="text-slate-400">Viewport & Screen Dimensions</div>
                      <div className="text-emerald-300 mt-1 tabular-nums">
                        {activeFingerprintProfile.screenWidth} ×{' '}
                        {activeFingerprintProfile.screenHeight} ({activeFingerprintProfile.colorDepth}
                        -bit) · {activeFingerprintProfile.hardwareConcurrency} Cores
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
