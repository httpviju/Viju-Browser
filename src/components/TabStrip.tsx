import React from 'react';
import {
  Plus,
  X,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Lock,
  Search,
  Globe,
  Code2,
  Compass,
  Minus,
  Square,
} from 'lucide-react';
import {
  ActiveSidePanel,
  TabItem,
  WebRTCConfig,
} from '../types/browser';

interface TabStripProps {
  tabs: TabItem[];
  activeTabId: string;
  closedTabsCount: number;
  webrtcConfig: WebRTCConfig;
  privacyStatusLabel: string;
  privacyStatusLevel: 'standard' | 'hardened' | 'restricted';
  activePanel: ActiveSidePanel;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: (url?: string) => void;
  onRestoreClosedTab: () => void;
  onTogglePanel: (panel: ActiveSidePanel) => void;
  onNavigate: (url: string) => void;
}

export const TabStrip: React.FC<TabStripProps> = ({
  tabs,
  activeTabId,
  closedTabsCount,
  webrtcConfig,
  privacyStatusLabel,
  privacyStatusLevel,
  onSelectTab,
  onCloseTab,
  onCreateTab,
  onRestoreClosedTab,
  onTogglePanel,
  onNavigate,
}) => {
  const renderFavicon = (type: TabItem['faviconType']) => {
    switch (type) {
      case 'lock':
        return <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'search':
        return <Search className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'shield':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'code':
        return <Code2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'globe':
        return <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
      default:
        return <Compass className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    }
  };

  return (
    <header className="h-10 bg-[#070A12] border-b border-slate-800/90 flex items-center justify-between px-2.5 select-none">
      {/* Left: Brand Lockup & Tab Strip */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
        <button
          type="button"
          onClick={() => onNavigate('viju://home')}
          className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25 transition-colors shrink-0"
          title="Viju Browser Start Page"
        >
          <Compass className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 whitespace-nowrap">
            VIJU BROWSER
          </span>
        </button>

        {/* Scrollable Tabs Container */}
        <div
          role="tablist"
          aria-label="Browser Tabs"
          className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 py-0.5"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isRefreshing = tab.autoRefresh.status === 'running';
            const isPaused = tab.autoRefresh.status === 'paused';

            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab.id)}
                className={`group flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-t-lg border-t border-x text-xs cursor-pointer transition-colors min-w-[148px] max-w-[230px] shrink-0 ${
                  isActive
                    ? 'bg-[#111827] border-blue-500/60 text-slate-100 font-medium'
                    : 'bg-[#0B0F19] border-slate-800/80 text-slate-400 hover:bg-slate-900/90 hover:text-slate-200'
                }`}
              >
                {renderFavicon(tab.faviconType)}

                <span className="truncate flex-1 text-left">
                  {tab.title || 'New Tab'}
                </span>

                {/* Per-Tab Auto Refresh Live Countdown Indicator */}
                {isRefreshing && (
                  <span
                    title={`Auto Refresh Plus active (${tab.autoRefresh.remainingSeconds}s remaining)`}
                    className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-blue-400 shrink-0"
                  >
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    {tab.autoRefresh.remainingSeconds}s
                  </span>
                )}
                {isPaused && (
                  <span
                    title="Auto Refresh Plus paused"
                    className="text-[10px] font-mono tabular-nums text-amber-400 shrink-0"
                  >
                    ||
                  </span>
                )}

                {/* User-Agent Override Marker */}
                {tab.userAgentPresetId !== 'default_desktop_chrome' && (
                  <span
                    title={`Custom User-Agent active on this tab`}
                    className="text-[10px] font-mono text-sky-400 shrink-0"
                  >
                    UA
                  </span>
                )}

                <button
                  type="button"
                  aria-label={`Close tab ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-slate-700/70 text-slate-400 hover:text-slate-100 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            aria-label="New Tab"
            onClick={() => onCreateTab('viju://home')}
            className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors shrink-0"
            title="Open New Tab (Ctrl+T)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {closedTabsCount > 0 && (
            <button
              type="button"
              aria-label="Restore Closed Tab"
              onClick={onRestoreClosedTab}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs transition-colors shrink-0 whitespace-nowrap"
              title="Reopen last closed tab (Ctrl+Shift+T)"
            >
              <RotateCcw className="w-3 h-3 text-blue-400" />
              <span>Restore ({closedTabsCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: Privacy Status Indicator & Windows Caption Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onTogglePanel('webrtc')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs transition-colors whitespace-nowrap shrink-0"
          title="Click to inspect WebRTC Shield and Fingerprint Privacy posture"
        >
          {!webrtcConfig.enabled || privacyStatusLevel === 'restricted' ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : privacyStatusLevel === 'hardened' ? (
            <Shield className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="text-slate-300 font-medium">{privacyStatusLabel}</span>
        </button>

        {/* Windows Desktop Caption Controls */}
        <div className="hidden sm:flex items-center border-l border-slate-800 pl-2 ml-1 text-slate-500">
          <span className="p-1.5 hover:bg-slate-800 hover:text-slate-300 rounded transition-colors">
            <Minus className="w-3 h-3" />
          </span>
          <span className="p-1.5 hover:bg-slate-800 hover:text-slate-300 rounded transition-colors">
            <Square className="w-3 h-3" />
          </span>
        </div>
      </div>
    </header>
  );
};
