import React, { useState, useEffect } from 'react';
import {
  X,
  Timer,
  Play,
  Pause,
  Square,
  Smartphone,
  Shuffle,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
  Radio,
  Trash2,
  Download,
  Bookmark,
  History,
  Info,
  Plus,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  ActiveSidePanel,
  BookmarkItem,
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
  WebRTCPolicy,
  WhitelistSiteRule,
} from '../types/browser';
import {
  USER_AGENT_PRESETS,
  validateAutoRefreshInterval,
  validateUserAgentString,
} from '../utils/browserEngine';
import { ClearBrowsingDataView } from './ClearBrowsingDataView';
import { FingerprintSpoofingPanel } from './FingerprintSpoofingPanel';
import { ActiveUserAgentPopup } from './UserAgentSwitcherView';
import { WebRTCShieldView } from './WebRTCShieldView';

interface SidePanelDrawerProps {
  activePanel: ActiveSidePanel;
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
  downloads: DownloadItem[];
  bookmarks: BookmarkItem[];
  history: HistoryEntry[];
  formDataEntries: FormAutofillEntry[];
  savedPasswords: SavedPasswordEntry[];
  onClose: () => void;
  onAutoRefreshCommand: (
    tabId: string,
    command: 'start' | 'pause' | 'resume' | 'stop',
    intervalSeconds?: number
  ) => void;
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
  onClearBrowserData: (payload: ClearBrowsingDataPayload) => {
    success: boolean;
    message: string;
    details: string[];
  };
  onAddSampleFormEntry: () => void;
  onTriggerDownload: (filename: string, url: string, sizeBytes: number) => void;
  onDownloadAction: (
    downloadId: string,
    action: 'pause' | 'resume' | 'cancel' | 'remove'
  ) => void;
  onClearCompletedDownloads: () => void;
  onNavigate: (url: string) => void;
  onDeleteBookmark: (id: string) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearAllHistory: () => void;
}

export const SidePanelDrawer: React.FC<SidePanelDrawerProps> = ({
  activePanel,
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
  downloads,
  bookmarks,
  history,
  formDataEntries,
  savedPasswords,
  onClose,
  onAutoRefreshCommand,
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
  onClearBrowserData,
  onAddSampleFormEntry,
  onTriggerDownload,
  onDownloadAction,
  onClearCompletedDownloads,
  onNavigate,
  onDeleteBookmark,
  onDeleteHistoryItem,
  onClearAllHistory,
}) => {
  // Auto Refresh state
  const [intervalInput, setIntervalInput] = useState<string>(
    String(activeTab.autoRefresh.intervalSeconds || 15)
  );
  const [intervalError, setIntervalError] = useState<string | null>(null);

  // User-Agent state
  const [selectedUaPreset, setSelectedUaPreset] = useState<UserAgentPresetId>(
    activeTab.userAgentPresetId
  );
  const [customUaInput, setCustomUaInput] = useState<string>(
    activeTab.customUserAgent
  );
  const [uaStatusMessage, setUaStatusMessage] = useState<string | null>(null);
  const [uaError, setUaError] = useState<string | null>(null);

  // Fingerprint custom editor state
  const [fpWidth, setFpWidth] = useState<number>(activeFingerprintProfile.screenWidth);
  const [fpHeight, setFpHeight] = useState<number>(activeFingerprintProfile.screenHeight);
  const [fpCores, setFpCores] = useState<number>(activeFingerprintProfile.hardwareConcurrency);
  const [fpMemory, setFpMemory] = useState<number>(activeFingerprintProfile.deviceMemory);
  const [fpLang, setFpLang] = useState<string>(activeFingerprintProfile.language);
  const [fpTimezone, setFpTimezone] = useState<string>(activeFingerprintProfile.timezone);
  const [fpColorDepth, setFpColorDepth] = useState<number>(activeFingerprintProfile.colorDepth);
  const [fpFeedback, setFpFeedback] = useState<string | null>(null);

  // Bookmarks / History sub-tab
  const [libraryTab, setLibraryTab] = useState<'bookmarks' | 'history'>('bookmarks');
  const [librarySearch, setLibrarySearch] = useState('');

  useEffect(() => {
    setIntervalInput(String(activeTab.autoRefresh.intervalSeconds || 15));
    setIntervalError(null);
    setSelectedUaPreset(activeTab.userAgentPresetId);
    setCustomUaInput(activeTab.customUserAgent);
  }, [activeTab.id, activeTab.userAgentPresetId, activeTab.customUserAgent]);

  useEffect(() => {
    setFpWidth(activeFingerprintProfile.screenWidth);
    setFpHeight(activeFingerprintProfile.screenHeight);
    setFpCores(activeFingerprintProfile.hardwareConcurrency);
    setFpMemory(activeFingerprintProfile.deviceMemory);
    setFpLang(activeFingerprintProfile.language);
    setFpTimezone(activeFingerprintProfile.timezone);
    setFpColorDepth(activeFingerprintProfile.colorDepth);
  }, [activeFingerprintProfile]);

  if (activePanel === 'none') return null;

  const handleStartAutoRefresh = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const num = Number(intervalInput);
    const check = validateAutoRefreshInterval(num);
    if (!check.valid) {
      setIntervalError(check.error || 'Minimum interval is 5 seconds.');
      return;
    }
    setIntervalError(null);
    onAutoRefreshCommand(activeTab.id, 'start', check.sanitizedSeconds);
  };

  const handleRandomizeUserAgent = () => {
    const pool = USER_AGENT_PRESETS;
    const otherPresets = pool.filter((p) => p.id !== selectedUaPreset);
    const randomPick =
      otherPresets[Math.floor(Math.random() * otherPresets.length)] || pool[0];
    setSelectedUaPreset(randomPick.id);
    setCustomUaInput(randomPick.userAgent);
    setUaError(null);
    onApplyUserAgent(randomPick.id, randomPick.userAgent);
    setUaStatusMessage(`Applied ${randomPick.name} and reloaded active tab.`);
  };

  const handleApplyUa = () => {
    if (selectedUaPreset === 'custom') {
      const check = validateUserAgentString(customUaInput);
      if (!check.valid) {
        setUaError(check.error || 'Invalid custom User-Agent string.');
        setUaStatusMessage(null);
        return;
      }
      setUaError(null);
      onApplyUserAgent('custom', check.sanitized);
      setUaStatusMessage('Applied custom User-Agent to active tab and triggered reload.');
    } else {
      const preset = USER_AGENT_PRESETS.find((p) => p.id === selectedUaPreset);
      setUaError(null);
      onApplyUserAgent(selectedUaPreset, preset?.userAgent);
      setUaStatusMessage(
        `Switched active tab to ${preset?.name || selectedUaPreset} and reloaded.`
      );
    }
  };

  const handleSaveCustomFingerprint = (e: React.FormEvent) => {
    e.preventDefault();
    const dimCheck = validateScreenDimensions(Number(fpWidth), Number(fpHeight));
    if (!dimCheck.valid) {
      setFpFeedback(dimCheck.error || 'Invalid screen dimensions.');
      return;
    }
    const updatedProfile: FingerprintProfile = {
      id: 'fp_custom_user',
      name: `Custom Profile (${fpWidth}×${fpHeight})`,
      description: 'User-configured screen and navigator signal profile.',
      screenWidth: Number(fpWidth),
      screenHeight: Number(fpHeight),
      colorDepth: Number(fpColorDepth),
      pixelRatio: 1,
      hardwareConcurrency: Number(fpCores),
      deviceMemory: Number(fpMemory),
      language: fpLang,
      timezone: fpTimezone,
      doNotTrack: '1',
    };
    onCreateOrUpdateFingerprintProfile(updatedProfile);
    setFpFeedback('Applied custom fingerprint profile to browser session.');
  };

  const getPanelHeaderTitle = () => {
    switch (activePanel) {
      case 'auto-refresh':
        return 'Auto Refresh Plus';
      case 'user-agent':
        return 'Random User-Agent Switcher';
      case 'fingerprint':
        return 'Fingerprint Privacy Controls';
      case 'webrtc':
        return 'WebRTC Control & Shield';
      case 'clear-cache':
        return 'Clear Browsing Data';
      case 'downloads':
        return 'Download Manager';
      case 'bookmarks-history':
        return 'Bookmarks & Browsing History';
      default:
        return 'Browser Control Panel';
    }
  };

  return (
    <aside
      aria-label={getPanelHeaderTitle()}
      className="w-full sm:w-[440px] bg-[#0F172A] border-l border-slate-800 flex flex-col h-full shrink-0 select-none z-20"
    >
      {/* Drawer Header */}
      <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between bg-[#0B0F19]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-100">
            {getPanelHeaderTitle()}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close side panel"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
        {/* 1. AUTO REFRESH PLUS */}
        {activePanel === 'auto-refresh' && (
          <>
            <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Target Active Tab</span>
                <span className="font-mono text-[11px] text-blue-400 truncate max-w-[200px]">
                  {activeTab.title}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-center">
                <div className="p-2 rounded bg-slate-900/90">
                  <div className="text-[11px] text-slate-400">Status</div>
                  <div className="font-mono font-semibold text-slate-100 uppercase mt-0.5">
                    {activeTab.autoRefresh.status}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-900/90">
                  <div className="text-[11px] text-slate-400">Countdown</div>
                  <div className="font-mono tabular-nums font-semibold text-blue-400 text-sm mt-0.5">
                    {activeTab.autoRefresh.remainingSeconds}s
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-900/90">
                  <div className="text-[11px] text-slate-400">Refreshes</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-100 text-sm mt-0.5">
                    {activeTab.autoRefresh.refreshCount}
                  </div>
                </div>
              </div>

              <form onSubmit={handleStartAutoRefresh} noValidate className="space-y-3 pt-2">
                <div>
                  <label
                    htmlFor="auto-refresh-seconds"
                    className="block text-xs font-medium text-slate-200 mb-1.5"
                  >
                    Refresh Interval in Seconds (Minimum 5s)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="auto-refresh-seconds"
                      type="number"
                      min={1}
                      max={86400}
                      value={intervalInput}
                      onChange={(e) => {
                        setIntervalInput(e.target.value);
                        setIntervalError(null);
                      }}
                      className="flex-1 bg-[#111827] border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-100 focus:outline-none"
                    />
                    <span className="text-slate-400 font-mono">sec</span>
                  </div>
                </div>

                {/* Quick Interval Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[5, 10, 15, 30, 60, 300].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setIntervalInput(String(sec));
                        setIntervalError(null);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-mono tabular-nums border transition-colors ${
                        Number(intervalInput) === sec
                          ? 'bg-blue-600/25 border-blue-500 text-blue-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>

                {intervalError && (
                  <div
                    role="alert"
                    className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 flex items-start gap-2 text-xs"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{intervalError}</span>
                  </div>
                )}

                {/* Start / Pause / Stop Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="submit"
                    aria-label="Start Auto Refresh on Active Tab"
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Pause or Resume Auto Refresh on Active Tab"
                    disabled={activeTab.autoRefresh.status === 'stopped'}
                    onClick={() =>
                      onAutoRefreshCommand(
                        activeTab.id,
                        activeTab.autoRefresh.status === 'paused' ? 'resume' : 'pause'
                      )
                    }
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-medium transition-colors ${
                      activeTab.autoRefresh.status === 'stopped'
                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-amber-600/20 border-amber-500/40 text-amber-300 hover:bg-amber-600/30'
                    }`}
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>
                      {activeTab.autoRefresh.status === 'paused' ? 'Resume' : 'Pause'}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label="Stop Auto Refresh on Active Tab"
                    disabled={activeTab.autoRefresh.status === 'stopped'}
                    onClick={() => onAutoRefreshCommand(activeTab.id, 'stop')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-medium transition-colors ${
                      activeTab.autoRefresh.status === 'stopped'
                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-red-600/20 border-red-500/40 text-red-300 hover:bg-red-600/30'
                    }`}
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Multi-Tab Independent Refresh Monitor */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-200">
                Multi-Tab Independent Timers ({allTabs.length} Open Tabs)
              </h3>
              <div className="space-y-2">
                {allTabs.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {t.title}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                        Status: {t.autoRefresh.status.toUpperCase()} · Interval:{' '}
                        {t.autoRefresh.intervalSeconds}s · Left:{' '}
                        {t.autoRefresh.remainingSeconds}s · Cycles:{' '}
                        {t.autoRefresh.refreshCount}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.autoRefresh.status === 'stopped' ? (
                        <button
                          type="button"
                          aria-label={`Start auto refresh for ${t.title}`}
                          onClick={() =>
                            onAutoRefreshCommand(
                              t.id,
                              'start',
                              Math.max(5, t.autoRefresh.intervalSeconds)
                            )
                          }
                          className="px-2 py-1 rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-[11px]"
                        >
                          Start Tab
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Stop auto refresh for ${t.title}`}
                          onClick={() => onAutoRefreshCommand(t.id, 'stop')}
                          className="px-2 py-1 rounded bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 text-[11px]"
                        >
                          Stop Tab
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 2. RANDOM USER-AGENT SWITCHER (Compact Active User-Agent Popup) */}
        {activePanel === 'user-agent' && (
          <ActiveUserAgentPopup
            activeTabUrl={activeTab.url}
            uaConfig={uaSwitcherConfig}
            errorBanner={uaErrorBanner}
            statusBanner={uaStatusBanner}
            onGetNewAgent={onGetNewAgent}
            onTogglePauseSwitcher={onTogglePauseUASwitcher}
            onToggleCurrentDomain={onToggleCurrentDomainUA}
            onUpdateConfig={onUpdateUASwitcherConfig}
            onResetDefaults={onResetUADefaults}
            onOpenSettingsPage={() => onNavigate('viju://ua-settings')}
          />
        )}

        {/* 3. FINGERPRINT PRIVACY CONTROLS (Maximum-Level 12-Surface Spoofing) */}
        {activePanel === 'fingerprint' && (
          <FingerprintSpoofingPanel
            layout="drawer"
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
        )}

        {/* 4. WEBRTC CONTROL & WEBRTC SHIELD */}
        {activePanel === 'webrtc' && (
          <WebRTCShieldView
            layout="drawer"
            activeTabUrl={activeTab.url}
            webrtcConfig={webrtcConfig}
            onUpdateWebRTC={onUpdateWebRTC}
            onNavigate={onNavigate}
          />
        )}

        {/* 5. CLEAR CACHE / CLEAR BROWSING DATA */}
        {activePanel === 'clear-cache' && (
          <ClearBrowsingDataView
            cacheMetrics={cacheMetrics}
            history={history}
            downloads={downloads}
            formDataEntries={formDataEntries}
            savedPasswords={savedPasswords}
            onExecuteClearData={onClearBrowserData}
            onAddSampleFormEntry={onAddSampleFormEntry}
          />
        )}

        {/* 6. DOWNLOAD MANAGER */}
        {activePanel === 'downloads' && (
          <>
            <div className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">
                  Test File Downloads
                </span>
                <button
                  type="button"
                  onClick={onClearCompletedDownloads}
                  className="text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  Clear Completed
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onTriggerDownload(
                      'Viju-Browser-Setup-1.4.0-x64.exe',
                      'https://releases.vijubrowser.dev/win64/Viju-Browser-Setup-1.4.0-x64.exe',
                      84_500_000
                    )
                  }
                  className="flex items-center justify-between px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors"
                >
                  <span className="font-mono text-blue-300 truncate">
                    Viju-Browser-Setup-1.4.0-x64.exe
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                    84.5 MB
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onTriggerDownload(
                      'chromium-security-architecture.pdf',
                      'https://www.chromium.org/Home/chromium-security/architecture.pdf',
                      12_400_000
                    )
                  }
                  className="flex items-center justify-between px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-colors"
                >
                  <span className="font-mono text-blue-300 truncate">
                    chromium-security-architecture.pdf
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                    12.4 MB
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {downloads.length === 0 ? (
                <div className="p-6 text-center text-slate-500 border border-slate-800/80 rounded-lg">
                  No downloads in queue. Trigger a sample download above or click a file
                  link on any page.
                </div>
              ) : (
                downloads.map((dl) => {
                  const pct =
                    dl.totalBytes > 0
                      ? Math.min(100, Math.round((dl.receivedBytes / dl.totalBytes) * 100))
                      : 0;
                  const recvMB = (dl.receivedBytes / 1_000_000).toFixed(1);
                  const totalMB = (dl.totalBytes / 1_000_000).toFixed(1);

                  return (
                    <div
                      key={dl.id}
                      className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium text-slate-100 truncate">
                          {dl.filename}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-blue-400 shrink-0">
                          {pct}%
                        </span>
                      </div>

                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            dl.status === 'completed'
                              ? 'bg-emerald-500'
                              : dl.status === 'paused'
                              ? 'bg-amber-500'
                              : dl.status === 'cancelled'
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                        <span>
                          {recvMB} MB / {totalMB} MB · {dl.status.toUpperCase()}
                        </span>
                        {dl.status === 'progressing' && (
                          <span>{(dl.speedKbps / 1024).toFixed(1)} MB/s</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        {dl.status === 'progressing' && (
                          <button
                            type="button"
                            onClick={() => onDownloadAction(dl.id, 'pause')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                          >
                            Pause
                          </button>
                        )}
                        {dl.status === 'paused' && (
                          <button
                            type="button"
                            onClick={() => onDownloadAction(dl.id, 'resume')}
                            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px]"
                          >
                            Resume
                          </button>
                        )}
                        {(dl.status === 'progressing' || dl.status === 'paused') && (
                          <button
                            type="button"
                            onClick={() => onDownloadAction(dl.id, 'cancel')}
                            className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900/60 text-red-300 text-[11px]"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDownloadAction(dl.id, 'remove')}
                          className="ml-auto px-2 py-1 rounded text-slate-400 hover:text-slate-200 text-[11px]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* 7. BOOKMARKS & HISTORY */}
        {activePanel === 'bookmarks-history' && (
          <>
            <div className="flex items-center gap-1 p-1 bg-[#0B0F19] border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setLibraryTab('bookmarks')}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                  libraryTab === 'bookmarks'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bookmarks ({bookmarks.length})
              </button>
              <button
                type="button"
                onClick={() => setLibraryTab('history')}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                  libraryTab === 'history'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                History ({history.length})
              </button>
            </div>

            <input
              type="text"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder={`Filter ${libraryTab}...`}
              className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
            />

            {libraryTab === 'bookmarks' ? (
              <div className="space-y-2">
                {bookmarks
                  .filter(
                    (b) =>
                      b.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
                      b.url.toLowerCase().includes(librarySearch.toLowerCase())
                  )
                  .map((bm) => (
                    <div
                      key={bm.id}
                      className="p-2.5 rounded-lg bg-[#0B0F19] border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onNavigate(bm.url)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="font-medium text-slate-100 truncate">
                          {bm.title}
                        </div>
                        <div className="text-[11px] font-mono text-blue-400 truncate">
                          {bm.url}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete bookmark ${bm.title}`}
                        onClick={() => onDeleteBookmark(bm.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="space-y-2">
                {history.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={onClearAllHistory}
                      className="text-[11px] text-red-400 hover:text-red-300"
                    >
                      Clear All History
                    </button>
                  </div>
                )}
                {history
                  .filter(
                    (h) =>
                      h.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
                      h.url.toLowerCase().includes(librarySearch.toLowerCase())
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-[#0B0F19] border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onNavigate(item.url)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="font-medium text-slate-100 truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {item.url} · {item.visitedAt}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete history entry ${item.title}`}
                        onClick={() => onDeleteHistoryItem(item.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
