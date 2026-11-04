import React, { useState } from 'react';
import {
  Pause,
  Play,
  RefreshCw,
  Settings,
  RotateCcw,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Globe,
  Info,
  Copy,
} from 'lucide-react';
import {
  CustomUserAgentItem,
  RandomUASwitcherConfig,
  UABlacklistRule,
  UABrowserFamily,
  UAGeneratorComboKey,
  UAOsFamily,
} from '../types/browser';
import {
  UA_GENERATOR_COMBINATIONS,
  deriveAppVersionFromUA,
  extractHostnameFromUrl,
  inferBrowserAndOsFromUAString,
  isDomainBlacklistedForUA,
  resolveEffectiveUserAgentForUrl,
  validateUserAgentString,
} from '../utils/browserEngine';

interface UserAgentSwitcherProps {
  activeTabUrl: string;
  uaConfig: RandomUASwitcherConfig;
  errorBanner: string | null;
  statusBanner: string | null;
  onGetNewAgent: (preferredBrowser?: UABrowserFamily, preferredOs?: UAOsFamily) => void;
  onTogglePauseSwitcher: () => void;
  onToggleCurrentDomain: (url: string) => void;
  onUpdateConfig: (updater: (prev: RandomUASwitcherConfig) => RandomUASwitcherConfig) => void;
  onResetDefaults: () => void;
  onOpenSettingsPage?: () => void;
}

const BROWSER_PROFILES: { id: UABrowserFamily; label: string; color: string }[] = [
  { id: 'chrome', label: 'Chrome', color: 'text-sky-400' },
  { id: 'firefox', label: 'Firefox', color: 'text-orange-400' },
  { id: 'safari', label: 'Safari', color: 'text-blue-400' },
  { id: 'edge', label: 'Edge', color: 'text-emerald-400' },
  { id: 'opera', label: 'Opera', color: 'text-rose-400' },
];

const OS_PROFILES: { id: UAOsFamily; label: string }[] = [
  { id: 'linux', label: 'Linux' },
  { id: 'windows', label: 'Windows' },
  { id: 'macos', label: 'macOS' },
  { id: 'android', label: 'Android' },
];

function renderBrowserSvgIcon(browser: UABrowserFamily) {
  switch (browser) {
    case 'chrome':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3.5" />
          <line x1="12" y1="8.5" x2="19.8" y2="8.5" />
          <line x1="8.9" y1="13.8" x2="5" y2="7.1" />
          <line x1="15.1" y1="13.8" x2="11.2" y2="20.5" />
        </svg>
      );
    case 'firefox':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M12 3a9 9 0 1 0 9 9c0-4-2.5-7.2-6-8.4.4 1.8-.3 3.6-2 4.4-1.8.8-3.5-.2-4-2C7.2 7.5 6.5 9.6 7 12c.6 2.8 3.2 4.5 6 4 2.2-.4 3.8-2.3 3.8-4.5" />
        </svg>
      );
    case 'safari':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
          <circle cx="12" cy="12" r="9" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case 'edge':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M20 13c0-4.4-3.6-8-8-8a8 8 0 0 0-7.5 10.8c1.2 2.5 3.8 4.2 6.8 4.2 2.9 0 5.5-1.5 6.8-3.8" />
          <path d="M8.5 13.5c0-2.2 1.8-4 4-4h6.5" />
        </svg>
      );
    case 'opera':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4.2" ry="6.8" />
        </svg>
      );
  }
}

function renderOsSvgIcon(os: UAOsFamily) {
  switch (os) {
    case 'windows':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="3" width="8" height="8" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
      );
    case 'macos':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 6.5c1.5-1.8 4-1.8 5.2-.2 1.3 1.7 1.1 4.8-.6 7.5-1.2 1.9-2.5 3.7-4 3.7-.9 0-1.5-.5-2.6-.5s-1.8.5-2.6.5c-1.5 0-2.9-1.9-4-3.7-1.7-2.7-1.9-5.8-.6-7.5 1.2-1.6 3.7-1.6 5.2.2Z" />
          <path d="M12 6.5c0-2 1.3-3.5 3-3.5" />
        </svg>
      );
    case 'linux':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3c-2.5 0-4 2-4 5 0 1.8-.8 3.5-1.8 5.2-.9 1.5-.7 3.8 1 4.8 1.2.7 2.8 1 4.8 1s3.6-.3 4.8-1c1.7-1 1.9-3.3 1-4.8C16.8 11.5 16 9.8 16 8c0-3-1.5-5-4-5Z" />
          <circle cx="10.5" cy="7.5" r="0.8" fill="currentColor" />
          <circle cx="13.5" cy="7.5" r="0.8" fill="currentColor" />
        </svg>
      );
    case 'android':
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 11a6 6 0 0 1 12 0v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6Z" />
          <line x1="8.5" y1="4.5" x2="7" y2="2.5" />
          <line x1="15.5" y1="4.5" x2="17" y2="2.5" />
          <circle cx="9.5" cy="9" r="0.8" fill="currentColor" />
          <circle cx="14.5" cy="9" r="0.8" fill="currentColor" />
        </svg>
      );
  }
}

/**
 * 1. COMPACT ACTIVE USER-AGENT POPUP
 * Displays the active UA, domain switch, Browser icons (Chrome, Firefox, Safari, Edge, Opera),
 * OS sync checkbox, OS icons (Linux, Windows, macOS, Android), Pause Switcher, Get New Agent,
 * and Open Settings buttons.
 */
export const ActiveUserAgentPopup: React.FC<UserAgentSwitcherProps> = ({
  activeTabUrl,
  uaConfig,
  errorBanner,
  statusBanner,
  onGetNewAgent,
  onTogglePauseSwitcher,
  onToggleCurrentDomain,
  onUpdateConfig,
  onOpenSettingsPage,
}) => {
  const [copied, setCopied] = useState(false);

  const currentDomain = extractHostnameFromUrl(activeTabUrl) || 'home';
  const domainBlacklistStatus = isDomainBlacklistedForUA(
    activeTabUrl,
    uaConfig.blacklistDomains
  );
  const resolved = resolveEffectiveUserAgentForUrl(activeTabUrl, uaConfig);
  const isDomainEnabled = !domainBlacklistStatus.blacklisted && uaConfig.enabledGlobally;

  const handleCopyActiveUa = () => {
    try {
      navigator.clipboard?.writeText(resolved.effectiveProfile.userAgent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-4 text-xs text-slate-200">
      {/* Section 1: Active User-Agent Display Box */}
      <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            Active User-Agent
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                resolved.isSwitchingActiveOnDomain
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
              }`}
            >
              {resolved.isSwitchingActiveOnDomain
                ? uaConfig.activeGeneratedProfile.label
                : 'Bypassed (Native UA)'}
            </span>
            <button
              type="button"
              onClick={handleCopyActiveUa}
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
              title="Copy Active User-Agent String"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <div
          aria-label="Currently active User-Agent string"
          className="p-2.5 rounded-lg bg-[#070A12] border border-slate-800/90 font-mono text-[11px] text-slate-100 break-all leading-relaxed select-all"
        >
          {resolved.effectiveProfile.userAgent}
        </div>

        {/* Synchronized JS Properties Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 pt-0.5">
          <span>platform: {resolved.effectiveProfile.platform}</span>
          <span>·</span>
          <span>vendor: {resolved.effectiveProfile.vendor || '(empty)'}</span>
          {uaConfig.autoRotateEnabled && (
            <>
              <span>·</span>
              <span className="text-blue-400 tabular-nums">
                {uaConfig.paused
                  ? 'Auto-Rotate: PAUSED'
                  : `Next rotate: ${uaConfig.remainingSeconds}s`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Section 2: Enable / Disable Switch for Current Domain */}
      <div className="p-3 rounded-xl bg-[#0B0F19] border border-slate-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Enable on {currentDomain}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {domainBlacklistStatus.blacklisted
              ? `Switching disabled on ${currentDomain} (Blacklisted)`
              : `Switching active for requests to ${currentDomain}`}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-label={`Enable User-Agent Switcher on ${currentDomain}`}
          aria-checked={isDomainEnabled}
          onClick={() => onToggleCurrentDomain(activeTabUrl)}
          className={`px-3 py-1.5 rounded-lg font-semibold text-xs border transition-colors shrink-0 ${
            isDomainEnabled
              ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          {isDomainEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Section 3: Browser Profile Icons (Chrome, Firefox, Safari, Edge, Opera) */}
      <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Browser Profiles
          </span>
          <span className="text-[11px] font-mono text-blue-400 uppercase">
            {uaConfig.selectedBrowserFamily}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {BROWSER_PROFILES.map((b) => {
            const isSelected = uaConfig.selectedBrowserFamily === b.id;
            return (
              <button
                key={b.id}
                type="button"
                aria-label={`Select ${b.label} browser profile`}
                title={`Switch to ${b.label} User-Agent profile`}
                onClick={() => {
                  onUpdateConfig((prev) => ({ ...prev, selectedBrowserFamily: b.id }));
                  onGetNewAgent(
                    b.id,
                    uaConfig.syncWithOs ? uaConfig.selectedOsFamily : undefined
                  );
                }}
                className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-blue-600/25 border-blue-500 text-white'
                    : 'bg-[#090D16] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span className={isSelected ? b.color : 'text-slate-300'}>
                  {renderBrowserSvgIcon(b.id)}
                </span>
                <span className="text-[10px] font-medium">{b.label}</span>
              </button>
            );
          })}
        </div>

        {/* Synchronize generated User-Agent with selected OS */}
        <label className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 cursor-pointer">
          <span
            className="text-xs text-slate-200 font-medium"
            title="Keep generated User-Agent synchronized with the selected Operating System icon below"
          >
            Sync User-Agent with Selected OS
          </span>
          <input
            type="checkbox"
            aria-label="Sync User-Agent with Selected OS"
            checked={uaConfig.syncWithOs}
            onChange={(e) =>
              onUpdateConfig((prev) => ({
                ...prev,
                syncWithOs: e.target.checked,
              }))
            }
            className="w-4 h-4 rounded accent-blue-600"
          />
        </label>

        {/* Section 4: OS Profile Icons (Linux, Windows, macOS, Android) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              OS Profiles
            </span>
            <span className="text-[11px] font-mono text-blue-400 uppercase">
              {uaConfig.selectedOsFamily}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {OS_PROFILES.map((os) => {
              const isSelected = uaConfig.selectedOsFamily === os.id;
              return (
                <button
                  key={os.id}
                  type="button"
                  aria-label={`Select ${os.label} OS profile`}
                  title={`Filter or generate User-Agent for ${os.label}`}
                  onClick={() => {
                    onUpdateConfig((prev) => ({ ...prev, selectedOsFamily: os.id }));
                    if (uaConfig.syncWithOs) {
                      onGetNewAgent(undefined, os.id);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-blue-600/25 border-blue-500 text-white'
                      : 'bg-[#090D16] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className={isSelected ? 'text-blue-400' : 'text-slate-300'}>
                    {renderOsSvgIcon(os.id)}
                  </span>
                  <span className="text-[10px] font-medium">{os.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error / Status Feedback Banners */}
      {errorBanner && (
        <div
          role="alert"
          className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 flex items-start gap-2 text-xs"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorBanner}</span>
        </div>
      )}

      {statusBanner && !errorBanner && (
        <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 flex items-start gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Section 5: Popup Action Buttons (Pause Switcher, Get New Agent, Open Settings) */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onTogglePauseSwitcher}
            className={`py-2.5 px-3 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              uaConfig.paused
                ? 'bg-amber-600/20 border-amber-500/50 text-amber-300 hover:bg-amber-600/30'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title={
              uaConfig.paused
                ? 'Resume automatic User-Agent interval rotation'
                : 'Pause automatic rotation while keeping the active User-Agent profile'
            }
          >
            {uaConfig.paused ? (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Resume Switcher</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Switcher</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onGetNewAgent()}
            className="py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors"
            title="Select a random enabled User-Agent profile and apply to the active tab"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Get New Agent</span>
          </button>
        </div>

        {onOpenSettingsPage && (
          <button
            type="button"
            onClick={onOpenSettingsPage}
            className="w-full py-2 px-3 rounded-lg bg-[#0B0F19] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-blue-400" />
            <span>Open Settings</span>
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * 2. FULL ADVANCED USER-AGENT SWITCHER SETTINGS WORKBENCH
 * Includes:
 * - General Settings (Global enable, Auto-rotate interval, Rotate on startup, JS detection protection, Custom UA manager)
 * - Generator Settings (9 enabled by default + 5 disabled by default Browser/OS combinations)
 * - Blacklist Settings (Add, edit, toggle, remove domains with exact & subdomain matching)
 */
export const UserAgentSwitcherSettingsView: React.FC<UserAgentSwitcherProps> = (props) => {
  const {
    activeTabUrl,
    uaConfig,
    errorBanner,
    statusBanner,
    onGetNewAgent,
    onTogglePauseSwitcher,
    onToggleCurrentDomain,
    onUpdateConfig,
    onResetDefaults,
  } = props;

  // Custom User-Agent Add / Edit State
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomUa, setNewCustomUa] = useState('');
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [editingCustomUaText, setEditingCustomUaText] = useState('');
  const [customUaError, setCustomUaError] = useState<string | null>(null);

  // Blacklist Add / Edit State
  const [newBlacklistDomain, setNewBlacklistDomain] = useState('');
  const [newBlacklistNote, setNewBlacklistNote] = useState('');
  const [editingBlacklistId, setEditingBlacklistId] = useState<string | null>(null);
  const [editingBlacklistDomain, setEditingBlacklistDomain] = useState('');

  const enabledCombosCount = UA_GENERATOR_COMBINATIONS.filter(
    (c) => uaConfig.generatorToggles[c.key]
  ).length;

  const handleAddCustomAgent = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateUserAgentString(newCustomUa);
    if (!check.valid) {
      setCustomUaError(check.error || 'Invalid User-Agent string.');
      return;
    }
    const inferred = inferBrowserAndOsFromUAString(check.sanitized);
    const item: CustomUserAgentItem = {
      id: `cua-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: newCustomLabel.trim() || `${inferred.browserFamily.toUpperCase()} Custom Profile`,
      userAgent: check.sanitized,
      browserFamily: inferred.browserFamily,
      osFamily: inferred.osFamily,
      appVersion: deriveAppVersionFromUA(check.sanitized, inferred.browserFamily),
      platform: inferred.platform,
      vendor: inferred.vendor,
    };
    onUpdateConfig((prev) => ({
      ...prev,
      customAgentsList: [item, ...prev.customAgentsList],
    }));
    setNewCustomLabel('');
    setNewCustomUa('');
    setCustomUaError(null);
  };

  const handleSaveEditedCustomAgent = (id: string) => {
    const check = validateUserAgentString(editingCustomUaText);
    if (!check.valid) {
      setCustomUaError(check.error || 'Invalid User-Agent string.');
      return;
    }
    const inferred = inferBrowserAndOsFromUAString(check.sanitized);
    onUpdateConfig((prev) => ({
      ...prev,
      customAgentsList: prev.customAgentsList.map((item) =>
        item.id === id
          ? {
              ...item,
              userAgent: check.sanitized,
              browserFamily: inferred.browserFamily,
              osFamily: inferred.osFamily,
              appVersion: deriveAppVersionFromUA(check.sanitized, inferred.browserFamily),
              platform: inferred.platform,
              vendor: inferred.vendor,
            }
          : item
      ),
    }));
    setEditingCustomId(null);
    setCustomUaError(null);
  };

  const handleAddBlacklistDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const host = extractHostnameFromUrl(newBlacklistDomain);
    if (!host) return;
    const newRule: UABlacklistRule = {
      id: `uabl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      domain: host,
      enabled: true,
      note: newBlacklistNote.trim() || 'User-configured domain exception',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onUpdateConfig((prev) => ({
      ...prev,
      blacklistDomains: [newRule, ...prev.blacklistDomains],
    }));
    setNewBlacklistDomain('');
    setNewBlacklistNote('');
  };

  const handleSaveEditedBlacklistDomain = (id: string) => {
    const host = extractHostnameFromUrl(editingBlacklistDomain);
    if (!host) return;
    onUpdateConfig((prev) => ({
      ...prev,
      blacklistDomains: prev.blacklistDomains.map((r) =>
        r.id === id ? { ...r, domain: host } : r
      ),
    }));
    setEditingBlacklistId(null);
  };

  const toggleGeneratorCombo = (key: UAGeneratorComboKey) => {
    onUpdateConfig((prev) => ({
      ...prev,
      generatorToggles: {
        ...prev.generatorToggles,
        [key]: !prev.generatorToggles[key],
      },
    }));
  };

  return (
    <div className="space-y-6 text-xs text-slate-200">
      {/* Top Status & Reset Bar */}
      <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-blue-400">
              viju://ua-settings · Advanced Random User-Agent Switcher
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                uaConfig.enabledGlobally
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/70 border-red-500/40 text-red-300'
              }`}
            >
              {uaConfig.enabledGlobally
                ? uaConfig.paused
                  ? 'PAUSED (PROFILE ACTIVE)'
                  : 'SWITCHER ACTIVE'
                : 'GLOBALLY DISABLED'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mt-1">
            Random User-Agent Switcher — Popup, Generator & Blacklist Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Active Profile:{' '}
            <strong className="text-slate-200">
              {uaConfig.activeGeneratedProfile.label}
            </strong>{' '}
            · Rotations: <span className="font-mono">{uaConfig.rotationCount}</span> · Enabled
            Generators: <span className="font-mono">{enabledCombosCount}/14</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onGetNewAgent()}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Get New Agent</span>
          </button>
          <button
            type="button"
            onClick={onResetDefaults}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 transition-colors"
            title="Restore all General, Generator (9 enabled / 5 disabled), and Blacklist settings to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>
        </div>
      </div>

      {/* Main 12-Column Grid: Left Column = Popup Preview + General Settings; Right Column = Generator Settings + Blacklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Active User-Agent Popup + General Settings */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 space-y-3">
            <h2 className="text-sm font-bold text-slate-100">
              1. Active User-Agent Popup Controls
            </h2>
            <ActiveUserAgentPopup
              activeTabUrl={activeTabUrl}
              uaConfig={uaConfig}
              errorBanner={errorBanner}
              statusBanner={statusBanner}
              onGetNewAgent={onGetNewAgent}
              onTogglePauseSwitcher={onTogglePauseSwitcher}
              onToggleCurrentDomain={onToggleCurrentDomain}
              onUpdateConfig={onUpdateConfig}
            />
          </div>

          {/* 2. GENERAL SETTINGS */}
          <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100">2. General Settings</h2>
              <Info
                className="w-4 h-4 text-slate-400"
                title="Configure global User-Agent switching, automatic interval rotation, startup behavior, and custom UA lists."
              />
            </div>

            <div className="space-y-3 divide-y divide-slate-800/80">
              {/* Enable Switcher Globally */}
              <label
                className="flex items-center justify-between gap-3 pt-1 cursor-pointer"
                title="Master toggle enabling or disabling User-Agent spoofing across all browser tabs"
              >
                <div>
                  <div className="font-semibold text-slate-100">Enable Switcher</div>
                  <div className="text-[11px] text-slate-400">
                    Apply active User-Agent profile to outgoing HTTP requests and DOM navigator
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="Enable Switcher"
                  checked={uaConfig.enabledGlobally}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      enabledGlobally: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded accent-blue-600 shrink-0"
                />
              </label>

              {/* Automatically change User-Agent after configurable interval */}
              <div className="pt-3 space-y-2">
                <label
                  className="flex items-center justify-between gap-3 cursor-pointer"
                  title="Automatically rotate to a new enabled User-Agent profile after the configured interval in seconds"
                >
                  <div>
                    <div className="font-semibold text-slate-100">
                      Automatically change the User-Agent after specified time
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Rotates User-Agent on a timer without changing mid-request
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    aria-label="Automatically change the User-Agent after specified time"
                    checked={uaConfig.autoRotateEnabled}
                    onChange={(e) =>
                      onUpdateConfig((prev) => ({
                        ...prev,
                        autoRotateEnabled: e.target.checked,
                        remainingSeconds: prev.autoRotateIntervalSeconds,
                      }))
                    }
                    className="w-4 h-4 rounded accent-blue-600 shrink-0"
                  />
                </label>

                <div className="flex items-center gap-2 pl-1">
                  <span className="text-[11px] text-slate-400">Interval (seconds):</span>
                  <input
                    type="number"
                    aria-label="Auto-rotate User-Agent interval in seconds"
                    min={5}
                    max={86400}
                    value={uaConfig.autoRotateIntervalSeconds}
                    onChange={(e) => {
                      const val = Math.max(5, Math.min(86400, Number(e.target.value) || 60));
                      onUpdateConfig((prev) => ({
                        ...prev,
                        autoRotateIntervalSeconds: val,
                        remainingSeconds: val,
                      }));
                    }}
                    className="w-24 bg-[#090D16] border border-slate-700 rounded px-2.5 py-1 font-mono tabular-nums text-slate-100"
                  />
                  <span className="text-[11px] font-mono text-blue-400 tabular-nums">
                    {uaConfig.autoRotateEnabled
                      ? uaConfig.paused
                        ? '(Paused)'
                        : `(Next in ${uaConfig.remainingSeconds}s)`
                      : '(Timer Off)'}
                  </span>
                </div>
              </div>

              {/* Change User-Agent on browser startup */}
              <label
                className="flex items-center justify-between gap-3 pt-3 cursor-pointer"
                title="Generate and apply a fresh random User-Agent profile whenever Viju Browser starts"
              >
                <div>
                  <div className="font-semibold text-slate-100">
                    Change User-Agent on browser startup
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Selects a new profile from enabled Generator combinations at launch
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="Change User-Agent on browser startup"
                  checked={uaConfig.rotateOnStartup}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      rotateOnStartup: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded accent-blue-600 shrink-0"
                />
              </label>

              {/* Protect against JavaScript detection */}
              <label
                className="flex items-center justify-between gap-3 pt-3 cursor-pointer"
                title="Synchronizes navigator.userAgent, navigator.appVersion, navigator.platform, and navigator.vendor with the active HTTP User-Agent"
              >
                <div>
                  <div className="font-semibold text-slate-100">
                    Protect against JavaScript detection
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Keep <code className="text-blue-300">navigator.userAgent</code>,{' '}
                    <code className="text-blue-300">appVersion</code>,{' '}
                    <code className="text-blue-300">platform</code>, and{' '}
                    <code className="text-blue-300">vendor</code> coherent
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="Protect against JavaScript detection"
                  checked={uaConfig.jsProtectionEnabled}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      jsProtectionEnabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded accent-blue-600 shrink-0"
                />
              </label>

              {/* Use custom User-Agent strings instead of generated ones */}
              <div className="pt-3 space-y-3">
                <label
                  className="flex items-center justify-between gap-3 cursor-pointer"
                  title="Rotate through your custom User-Agent list instead of the built-in Generator combinations"
                >
                  <div>
                    <div className="font-semibold text-slate-100">
                      Use custom User-Agent strings instead of generated ones
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Selects randomly from your Custom User-Agent list below
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    aria-label="Use custom User-Agent strings instead of generated ones"
                    checked={uaConfig.useCustomAgentsMode}
                    onChange={(e) =>
                      onUpdateConfig((prev) => ({
                        ...prev,
                        useCustomAgentsMode: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded accent-blue-600 shrink-0"
                  />
                </label>

                {/* Custom User-Agents Add / Edit / Remove / Rotate Manager */}
                <div className="p-3 rounded-lg bg-[#090D16] border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      Custom User-Agent Strings ({uaConfig.customAgentsList.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateConfig((prev) => ({ ...prev, useCustomAgentsMode: true }));
                        setTimeout(() => onGetNewAgent(), 0);
                      }}
                      className="px-2 py-1 rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-[11px] font-medium"
                    >
                      Rotate Custom Agent
                    </button>
                  </div>

                  <form onSubmit={handleAddCustomAgent} className="space-y-2">
                    <input
                      type="text"
                      aria-label="Custom User-Agent label"
                      value={newCustomLabel}
                      onChange={(e) => setNewCustomLabel(e.target.value)}
                      placeholder="Profile label (e.g. Custom Workstation UA)..."
                      className="w-full bg-[#111827] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        aria-label="New custom User-Agent string"
                        value={newCustomUa}
                        onChange={(e) => {
                          setNewCustomUa(e.target.value);
                          setCustomUaError(null);
                        }}
                        placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
                        className="flex-1 bg-[#111827] border border-slate-700 rounded px-2.5 py-1.5 font-mono text-[11px] text-slate-100"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </form>

                  {customUaError && (
                    <div className="text-[11px] text-red-400">{customUaError}</div>
                  )}

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {uaConfig.customAgentsList.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded bg-[#0F172A] border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-200 text-[11px]">
                            {item.label}
                          </span>
                          <div className="flex items-center gap-1">
                            {editingCustomId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  aria-label={`Save edited custom UA ${item.label}`}
                                  onClick={() => handleSaveEditedCustomAgent(item.id)}
                                  className="p-1 text-emerald-400 hover:bg-slate-800 rounded"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCustomId(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-800 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Edit custom UA ${item.label}`}
                                onClick={() => {
                                  setEditingCustomId(item.id);
                                  setEditingCustomUaText(item.userAgent);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Remove custom UA ${item.label}`}
                              onClick={() =>
                                onUpdateConfig((prev) => ({
                                  ...prev,
                                  customAgentsList: prev.customAgentsList.filter(
                                    (c) => c.id !== item.id
                                  ),
                                }))
                              }
                              className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {editingCustomId === item.id ? (
                          <input
                            type="text"
                            value={editingCustomUaText}
                            onChange={(e) => setEditingCustomUaText(e.target.value)}
                            className="w-full bg-[#090D16] border border-blue-500 rounded px-2 py-1 font-mono text-[10px] text-slate-100"
                          />
                        ) : (
                          <div className="font-mono text-[10px] text-slate-400 break-all">
                            {item.userAgent}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): 3. Generator Settings + 4. Blacklist Settings */}
        <div className="lg:col-span-7 space-y-6">
          {/* 3. GENERATOR SETTINGS (14 Browser/OS Combinations) */}
          <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-100">
                  3. Generator Settings (Browser / OS Combinations)
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Only enabled combinations are used when generating random User-Agents.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-blue-950/60 border border-blue-500/30 font-mono text-[11px] text-blue-300 tabular-nums">
                {enabledCombosCount} of 14 Enabled
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {UA_GENERATOR_COMBINATIONS.map((combo) => {
                const isEnabled = uaConfig.generatorToggles[combo.key];
                return (
                  <label
                    key={combo.key}
                    title={`Enable or disable generating ${combo.label} User-Agent profiles`}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isEnabled
                        ? 'bg-[#0B0F19] border-blue-500/40 text-slate-100'
                        : 'bg-[#090D16] border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        aria-label={combo.label}
                        checked={isEnabled}
                        onChange={() => toggleGeneratorCombo(combo.key)}
                        className="w-4 h-4 rounded accent-blue-600 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate">{combo.label}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {combo.platform} ·{' '}
                          {combo.defaultEnabled ? 'Default: ON' : 'Default: OFF'}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                        isEnabled
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isEnabled ? 'ON' : 'OFF'}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 4. BLACKLIST SETTINGS */}
          <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-100">
                  4. Blacklist Settings (Domain Exceptions)
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  User-Agent switching is automatically disabled on matching domains and
                  subdomains during navigation.
                </p>
              </div>
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            </div>

            <form onSubmit={handleAddBlacklistDomain} className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  aria-label="Blacklist domain input"
                  value={newBlacklistDomain}
                  onChange={(e) => setNewBlacklistDomain(e.target.value)}
                  placeholder="Enter domain to blacklist (e.g. example.com, login.corp.local)..."
                  className="flex-1 bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Domain</span>
                </button>
              </div>
              <input
                type="text"
                aria-label="Blacklist domain note"
                value={newBlacklistNote}
                onChange={(e) => setNewBlacklistNote(e.target.value)}
                placeholder="Optional note (e.g. Preserve native UA for SSO login)..."
                className="w-full bg-[#090D16] border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] text-slate-300"
              />
            </form>

            <div className="space-y-2">
              {uaConfig.blacklistDomains.length === 0 ? (
                <div className="p-4 text-center text-slate-500 border border-slate-800 rounded-lg">
                  No domains in blacklist. All domains receive the active spoofed User-Agent.
                </div>
              ) : (
                uaConfig.blacklistDomains.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      {editingBlacklistId === rule.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingBlacklistDomain}
                            onChange={(e) => setEditingBlacklistDomain(e.target.value)}
                            className="bg-[#090D16] border border-blue-500 rounded px-2 py-1 font-mono text-xs text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditedBlacklistDomain(rule.id)}
                            className="p-1 text-emerald-400 hover:bg-slate-800 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingBlacklistId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-800 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-100">
                            {rule.domain}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                            Exact + Subdomains (*.{rule.domain})
                          </span>
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {rule.note}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateConfig((prev) => ({
                            ...prev,
                            blacklistDomains: prev.blacklistDomains.map((r) =>
                              r.id === rule.id ? { ...r, enabled: !r.enabled } : r
                            ),
                          }))
                        }
                        className={`px-2 py-1 rounded text-[10px] font-mono border ${
                          rule.enabled
                            ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        {rule.enabled ? 'Bypassing UA' : 'Rule Paused'}
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit blacklist domain ${rule.domain}`}
                        onClick={() => {
                          setEditingBlacklistId(rule.id);
                          setEditingBlacklistDomain(rule.domain);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove blacklist domain ${rule.domain}`}
                        onClick={() =>
                          onUpdateConfig((prev) => ({
                            ...prev,
                            blacklistDomains: prev.blacklistDomains.filter(
                              (r) => r.id !== rule.id
                            ),
                          }))
                        }
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
