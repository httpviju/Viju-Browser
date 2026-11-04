import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Lock,
  Search,
  Star,
  Timer,
  Smartphone,
  Fingerprint,
  Radio,
  Trash2,
  Download,
  Bookmark,
  Settings,
  Code2,
  Compass,
  ExternalLink,
} from 'lucide-react';
import {
  ActiveSidePanel,
  BookmarkItem,
  DownloadItem,
  FingerprintProfile,
  RandomUASwitcherConfig,
  TabItem,
  WebRTCConfig,
} from '../types/browser';
import { resolveEffectiveUserAgentForUrl } from '../utils/browserEngine';

interface NavigationToolbarProps {
  activeTab: TabItem;
  allTabs: TabItem[];
  bookmarks: BookmarkItem[];
  downloads: DownloadItem[];
  activeFingerprintProfile: FingerprintProfile;
  webrtcConfig: WebRTCConfig;
  uaSwitcherConfig: RandomUASwitcherConfig;
  activePanel: ActiveSidePanel;
  onNavigate: (input: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onHome: () => void;
  onToggleBookmark: () => void;
  onTogglePanel: (panel: ActiveSidePanel) => void;
}

export const NavigationToolbar: React.FC<NavigationToolbarProps> = ({
  activeTab,
  allTabs,
  bookmarks,
  downloads,
  activeFingerprintProfile,
  webrtcConfig,
  uaSwitcherConfig,
  activePanel,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onHome,
  onToggleBookmark,
  onTogglePanel,
}) => {
  const [addressText, setAddressText] = useState(activeTab.url);

  useEffect(() => {
    setAddressText(activeTab.url);
  }, [activeTab.id, activeTab.url]);

  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.historyStack.length - 1;
  const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);

  const runningAutoRefreshTabsCount = allTabs.filter(
    (t) => t.autoRefresh.status === 'running'
  ).length;

  const activeDownloadsCount = downloads.filter(
    (d) => d.status === 'progressing'
  ).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate(addressText);
  };

  const getProtocolLabel = (url: string) => {
    if (url.startsWith('viju://')) return 'VIJU CORE';
    if (url.startsWith('https://www.google.com/search')) return 'GOOGLE SEARCH';
    if (url.startsWith('https://')) return 'HTTPS';
    return 'WEB';
  };

  const resolvedUa = resolveEffectiveUserAgentForUrl(activeTab.url, uaSwitcherConfig);
  const getUaShortLabel = () => {
    if (!uaSwitcherConfig.enabledGlobally) return 'Global OFF';
    if (!resolvedUa.isSwitchingActiveOnDomain) return 'Bypassed';
    const b = uaSwitcherConfig.activeGeneratedProfile.browserFamily || 'chrome';
    const os = uaSwitcherConfig.activeGeneratedProfile.osFamily || 'windows';
    const bLabel = b.charAt(0).toUpperCase() + b.slice(1);
    const osLabel =
      os === 'macos'
        ? 'Mac'
        : os === 'windows'
        ? 'Win'
        : os === 'ios'
        ? 'iOS'
        : os === 'android'
        ? 'Android'
        : 'Linux';
    return `${bLabel}/${osLabel}`;
  };

  return (
    <div className="bg-[#0F172A] border-b border-slate-800 select-none">
      {/* Main Navigation Row */}
      <div className="h-12 px-3 flex items-center gap-2">
        {/* Back / Forward / Reload / Home */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Go Back"
            disabled={!canGoBack}
            onClick={onBack}
            className={`p-2 rounded-lg transition-colors ${
              canGoBack
                ? 'text-slate-200 hover:bg-slate-800 active:bg-slate-700'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Back (Alt+Left)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            aria-label="Go Forward"
            disabled={!canGoForward}
            onClick={onForward}
            className={`p-2 rounded-lg transition-colors ${
              canGoForward
                ? 'text-slate-200 hover:bg-slate-800 active:bg-slate-700'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Forward (Alt+Right)"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            aria-label="Reload Page"
            onClick={onReload}
            className="p-2 rounded-lg text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
            title="Reload Current Tab (Ctrl+R)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            aria-label="Home Page"
            onClick={onHome}
            className="p-2 rounded-lg text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
            title="Viju Start Page (viju://home)"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Address Bar / Omnibox */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-w-0 overflow-hidden flex items-center bg-[#090D16] border border-slate-700/80 focus-within:border-blue-500 rounded-lg h-9 px-2.5 gap-2 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-xs font-mono text-blue-400 shrink-0 pr-1.5 border-r border-slate-800">
            {activeTab.url.startsWith('viju://') ? (
              <Compass className="w-3.5 h-3.5 text-blue-400" />
            ) : activeTab.url.includes('google.com/search') ? (
              <Search className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="text-[11px] font-semibold tracking-tight">
              {getProtocolLabel(activeTab.url)}
            </span>
          </div>

          <input
            type="text"
            aria-label="Address bar — enter URL or Google search query"
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Enter URL (e.g. example.com, viju://webrtc-test) or search Google..."
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
          />

          <button
            type="submit"
            aria-label="Navigate or Search"
            className="px-2 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/90 hover:bg-blue-600 rounded transition-colors shrink-0"
          >
            Go
          </button>

          <button
            type="button"
            aria-label={isBookmarked ? 'Remove Bookmark' : 'Bookmark This Page'}
            onClick={onToggleBookmark}
            className={`p-1 rounded hover:bg-slate-800 transition-colors shrink-0 ${
              isBookmarked ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            title={isBookmarked ? 'Remove from Bookmarks' : 'Add to Bookmarks'}
          >
            <Star className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        </form>

        {/* Built-in Browser Feature Controls */}
        <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => onTogglePanel('auto-refresh')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'auto-refresh'
                ? 'bg-blue-600 text-white border-blue-500'
                : runningAutoRefreshTabsCount > 0
                ? 'bg-blue-950/60 text-blue-300 border-blue-500/40 hover:bg-blue-900/50'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
            title="Auto Refresh Plus (Minimum 5s interval, multi-tab support)"
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Auto Refresh</span>
            {runningAutoRefreshTabsCount > 0 && (
              <span className="font-mono tabular-nums text-[11px] opacity-90">
                ({runningAutoRefreshTabsCount})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTogglePanel('user-agent')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'user-agent'
                ? 'bg-blue-600 text-white border-blue-500'
                : !resolvedUa.isSwitchingActiveOnDomain
                ? 'bg-amber-950/60 text-amber-300 border-amber-500/40 hover:bg-amber-900/50'
                : 'bg-sky-950/60 text-sky-300 border-sky-500/40 hover:bg-sky-900/50'
            }`}
            title="Active User-Agent Switcher Popup"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>UA: {getUaShortLabel()}</span>
          </button>

          <button
            type="button"
            onClick={() => onTogglePanel('fingerprint')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'fingerprint'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
            title="Fingerprint Privacy Controls (Screen & Navigator Signals)"
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Fingerprint</span>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {activeFingerprintProfile.screenWidth}×{activeFingerprintProfile.screenHeight}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTogglePanel('webrtc')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'webrtc'
                ? 'bg-blue-600 text-white border-blue-500'
                : !webrtcConfig.enabled
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/50'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
            title="WebRTC Control & WebRTC Shield Network Policies"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>WebRTC</span>
          </button>

          <button
            type="button"
            onClick={() => onTogglePanel('clear-cache')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'clear-cache'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
            title="Clear Cache, Cookies, History, and Local Storage"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Clear Cache</span>
          </button>

          <button
            type="button"
            aria-label="Download Manager"
            onClick={() => onTogglePanel('downloads')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'downloads'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
            title="Download Manager"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Downloads</span>
            <span className="font-mono tabular-nums text-[11px]">
              ({activeDownloadsCount > 0 ? `${activeDownloadsCount} active` : downloads.length})
            </span>
          </button>

          <button
            type="button"
            aria-label="Bookmarks and History"
            onClick={() => onTogglePanel('bookmarks-history')}
            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
              activePanel === 'bookmarks-history'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
            title="Bookmarks & Browsing History"
          >
            <Bookmark className="w-4 h-4" />
          </button>

          <button
            type="button"
            aria-label="Browser Settings"
            onClick={() => onNavigate('viju://settings')}
            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
              activeTab.url === 'viju://settings'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
            title="Viju Browser Settings (viju://settings)"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('viju://electron-source')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              activeTab.url === 'viju://electron-source'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30'
            }`}
            title="View Complete Electron Source Code & Windows .EXE Build Instructions"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Electron .EXE Code</span>
          </button>
        </div>
      </div>

      {/* Bookmarks & Quick Tools Bar */}
      <div className="h-8 px-3 bg-[#0B0F19]/90 border-t border-slate-800/80 flex items-center justify-between gap-4 overflow-x-auto text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-medium text-slate-500 pr-1 shrink-0">
            Bookmarks:
          </span>
          {bookmarks.map((bm) => (
            <button
              key={bm.id}
              type="button"
              onClick={() => onNavigate(bm.url)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors whitespace-nowrap shrink-0 ${
                activeTab.url === bm.url
                  ? 'bg-blue-600/20 text-blue-300 font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ExternalLink className="w-3 h-3 text-slate-500" />
              <span>{bm.title}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => onNavigate('viju://ua-settings')}
            className="hover:text-blue-400 transition-colors whitespace-nowrap"
          >
            UA Switcher Settings
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onNavigate('viju://fingerprint')}
            className="hover:text-blue-400 transition-colors whitespace-nowrap"
          >
            Signal Inspector
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onNavigate('viju://webrtc-test')}
            className="hover:text-blue-400 transition-colors whitespace-nowrap"
          >
            WebRTC Leak Audit
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onNavigate('viju://settings')}
            className="hover:text-blue-400 transition-colors whitespace-nowrap"
          >
            All Settings
          </button>
        </div>
      </div>
    </div>
  );
};
