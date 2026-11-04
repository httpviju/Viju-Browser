import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Shuffle,
  RotateCcw,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Terminal,
  Activity,
  Sliders,
  Globe,
} from 'lucide-react';
import {
  FingerprintControlKey,
  FingerprintProfile,
  FingerprintProtectionLogEntry,
  FingerprintSpoofConfig,
  WebRTCConfig,
  WhitelistSiteRule,
} from '../types/browser';
import {
  ALL_FINGERPRINT_CONTROL_KEYS,
  FINGERPRINT_CONTROL_DESCRIPTORS,
  evaluateAll12FingerprintSurfaces,
  extractHostnameFromUrl,
  formatSeedHex,
  isOriginWhitelisted,
  validateScreenDimensions,
} from '../utils/browserEngine';

interface FingerprintSpoofingPanelProps {
  layout?: 'drawer' | 'full';
  activeTabUrl: string;
  openTabsCount: number;
  effectiveUserAgent: string;
  fingerprintProfiles: FingerprintProfile[];
  activeFingerprintProfile: FingerprintProfile;
  webrtcConfig: WebRTCConfig;
  spoofConfig: FingerprintSpoofConfig;
  protectionLogs: FingerprintProtectionLogEntry[];
  onToggleControl: (control: FingerprintControlKey) => void;
  onBulkAction: (
    action: 'enable_all' | 'disable_all' | 'reset_defaults' | 'strict_protection'
  ) => void;
  onGenerateCoherentRandomProfile: () => void;
  onSelectFingerprintProfile: (profileId: string) => void;
  onCreateOrUpdateFingerprintProfile: (
    profile: FingerprintProfile,
    webglVendor?: string,
    webglRenderer?: string
  ) => void;
  onAddWhitelistRule: (rule: Omit<WhitelistSiteRule, 'id' | 'addedAt'>) => void;
  onToggleWhitelistRule: (ruleId: string) => void;
  onDeleteWhitelistRule: (ruleId: string) => void;
  onSimulateFingerprintProbe: () => void;
  onClearProtectionLogs: () => void;
}

export const FingerprintSpoofingPanel: React.FC<FingerprintSpoofingPanelProps> = ({
  layout = 'drawer',
  activeTabUrl,
  openTabsCount,
  effectiveUserAgent,
  fingerprintProfiles,
  activeFingerprintProfile,
  webrtcConfig,
  spoofConfig,
  protectionLogs,
  onToggleControl,
  onBulkAction,
  onGenerateCoherentRandomProfile,
  onSelectFingerprintProfile,
  onCreateOrUpdateFingerprintProfile,
  onAddWhitelistRule,
  onToggleWhitelistRule,
  onDeleteWhitelistRule,
  onSimulateFingerprintProbe,
  onClearProtectionLogs,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'controls' | 'profile' | 'whitelist' | 'logs' | 'verify'
  >('controls');

  // Custom Profile Editor State
  const [fpWidth, setFpWidth] = useState<number>(activeFingerprintProfile.screenWidth);
  const [fpHeight, setFpHeight] = useState<number>(activeFingerprintProfile.screenHeight);
  const [fpCores, setFpCores] = useState<number>(
    activeFingerprintProfile.hardwareConcurrency
  );
  const [fpMemory, setFpMemory] = useState<number>(activeFingerprintProfile.deviceMemory);
  const [fpLang, setFpLang] = useState<string>(activeFingerprintProfile.language);
  const [fpTimezone, setFpTimezone] = useState<string>(activeFingerprintProfile.timezone);
  const [fpColorDepth, setFpColorDepth] = useState<number>(
    activeFingerprintProfile.colorDepth
  );
  const [fpWebglVendor, setFpWebglVendor] = useState<string>(
    activeFingerprintProfile.webglVendor || spoofConfig.webglVendor
  );
  const [fpWebglRenderer, setFpWebglRenderer] = useState<string>(
    activeFingerprintProfile.webglRenderer || spoofConfig.webglRenderer
  );
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);

  // Whitelist Input State
  const [newWhitelistDomain, setNewWhitelistDomain] = useState('');
  const [newWhitelistScope, setNewWhitelistScope] = useState<'all' | 'noCache'>('all');
  const [newWhitelistReason, setNewWhitelistReason] = useState(
    'Site exception configured by user'
  );

  // Logs Filter State
  const [logFilterControl, setLogFilterControl] = useState<string>('all');

  const enabledCount = ALL_FINGERPRINT_CONTROL_KEYS.filter(
    (k) => spoofConfig.controls[k]
  ).length;

  const verificationResults = evaluateAll12FingerprintSurfaces(
    activeFingerprintProfile,
    effectiveUserAgent,
    webrtcConfig,
    spoofConfig,
    protectionLogs.length,
    activeTabUrl
  );

  const activeTabWhitelistStatus = isOriginWhitelisted(activeTabUrl, spoofConfig);
  const currentHost = extractHostnameFromUrl(activeTabUrl);

  const handleSaveCustomProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const dimCheck = validateScreenDimensions(Number(fpWidth), Number(fpHeight));
    if (!dimCheck.valid) {
      setProfileFeedback(dimCheck.error || 'Invalid screen dimensions.');
      return;
    }
    const updatedProfile: FingerprintProfile = {
      id: 'fp_custom_user',
      name: `Custom Coherent (${fpWidth}×${fpHeight})`,
      description: 'User-configured coherent navigator, screen, WebGL, and timezone profile.',
      screenWidth: Number(fpWidth),
      screenHeight: Number(fpHeight),
      colorDepth: Number(fpColorDepth),
      pixelRatio: 1,
      hardwareConcurrency: Number(fpCores),
      deviceMemory: Number(fpMemory),
      language: fpLang,
      timezone: fpTimezone,
      doNotTrack: '1',
      webglVendor: fpWebglVendor,
      webglRenderer: fpWebglRenderer,
      platform: 'Win32',
    };
    onCreateOrUpdateFingerprintProfile(updatedProfile, fpWebglVendor, fpWebglRenderer);
    setProfileFeedback('Saved & applied coherent fingerprint profile across all open tabs.');
  };

  const handleAddWhitelistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = extractHostnameFromUrl(newWhitelistDomain);
    if (!cleaned) return;
    onAddWhitelistRule({
      domain: cleaned,
      enabled: true,
      bypassControls: newWhitelistScope === 'all' ? 'all' : ['noCache'],
      reason: newWhitelistReason.trim() || 'User-configured site exception',
    });
    setNewWhitelistDomain('');
  };

  const filteredLogs = protectionLogs.filter((entry) =>
    logFilterControl === 'all' ? true : entry.control === logFilterControl
  );

  return (
    <div className="space-y-4 text-xs text-slate-200">
      {/* Header Status Summary Banner */}
      <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {enabledCount > 0 ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <div>
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <span>Maximum-Level Fingerprint Spoofing</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                    spoofConfig.mode === 'strict'
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                      : enabledCount === 12
                      ? 'bg-blue-950/70 border-blue-500/50 text-blue-300'
                      : enabledCount === 0
                      ? 'bg-red-950/70 border-red-500/50 text-red-300'
                      : 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                  }`}
                >
                  {spoofConfig.mode === 'strict'
                    ? 'STRICT LOCKDOWN'
                    : `${enabledCount}/12 ACTIVE`}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                Seed: <span className="text-blue-400">{formatSeedHex(spoofConfig.profileSeed)}</span>{' '}
                · Coherent across {openTabsCount} open {openTabsCount === 1 ? 'tab' : 'tabs'} ·{' '}
                {activeTabWhitelistStatus.whitelisted ? (
                  <span className="text-amber-300">Origin Whitelisted ({currentHost})</span>
                ) : (
                  <span className="text-emerald-400">Protected ({currentHost || 'active tab'})</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onGenerateCoherentRandomProfile}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-medium transition-colors"
            title="Rotate deterministic profile seed & coherent hardware profile"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Rotate Stable Identity</span>
          </button>
        </div>

        {/* 4 Required Bulk Action Controls: Enable All, Disable All, Reset Defaults, Strict Protection */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => onBulkAction('enable_all')}
            className="py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] transition-colors text-center"
          >
            Enable All
          </button>
          <button
            type="button"
            onClick={() => onBulkAction('disable_all')}
            className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-[11px] transition-colors text-center"
          >
            Disable All
          </button>
          <button
            type="button"
            onClick={() => onBulkAction('reset_defaults')}
            className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={() => onBulkAction('strict_protection')}
            className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center justify-center gap-1 transition-colors"
          >
            <Lock className="w-3 h-3" />
            <span>Strict Protection</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs for Full Access to Controls, Profile, Whitelist, Logs, and Verification */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090D16] border border-slate-800 overflow-x-auto">
        {(
          [
            { id: 'controls', label: `12 Controls (${enabledCount}/12)` },
            { id: 'profile', label: 'Profile & Seed' },
            { id: 'whitelist', label: `Whitelist (${spoofConfig.whitelistRules.length})` },
            { id: 'logs', label: `Logs (${protectionLogs.length})` },
            { id: 'verify', label: 'Live Verification' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
              activeSubTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ALL 12 FINGERPRINT SPOOFING CONTROLS (Always rendered in 'controls' or full view) */}
      {(activeSubTab === 'controls' || layout === 'full') && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              12 Fingerprint Protection Controls (All Enabled by Default)
            </h3>
            <button
              type="button"
              onClick={onSimulateFingerprintProbe}
              className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Run Live Probe Test</span>
            </button>
          </div>

          <div
            className={`grid gap-2 ${
              layout === 'full' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
            }`}
          >
            {FINGERPRINT_CONTROL_DESCRIPTORS.map((desc) => {
              const isChecked = spoofConfig.controls[desc.key];
              const verif = verificationResults.find((v) => v.control === desc.key);
              return (
                <label
                  key={desc.key}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-[#0B0F19] border-blue-500/40 hover:border-blue-500/70'
                      : 'bg-[#090D16] border-slate-800/80 opacity-80 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label={desc.label}
                    checked={isChecked}
                    onChange={() => onToggleControl(desc.key)}
                    className="mt-0.5 w-4 h-4 rounded accent-blue-600 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100 text-xs">
                        {desc.label}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          isChecked
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isChecked ? 'PROTECTED' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {desc.description}
                    </p>
                    {verif && (
                      <div className="text-[10px] font-mono text-blue-300 bg-slate-900/90 px-2 py-1 rounded border border-slate-800/90 truncate">
                        {verif.spoofedSample}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COHERENT PROFILE & DETERMINISTIC SEED MANAGER */}
      {(activeSubTab === 'profile' || layout === 'full') && (
        <div className="space-y-3 pt-1">
          <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-slate-100">
                  Coherent Browser Profile & Seed Configuration
                </span>
              </div>
              <span className="font-mono text-[11px] text-blue-400 tabular-nums">
                Seed: {formatSeedHex(spoofConfig.profileSeed)}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Viju Browser derives Canvas, Audio, Font, and ClientRects noise from a stable
              32-bit profile seed rather than randomizing on every call, preventing
              statistical intra-session anomaly detection while keeping all open tabs
              coherent.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {fingerprintProfiles.map((prof) => {
                const isSelected = prof.id === activeFingerprintProfile.id;
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => {
                      onSelectFingerprintProfile(prof.id);
                      setProfileFeedback(`Activated profile: ${prof.name}`);
                    }}
                    className={`text-left p-2.5 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 text-slate-100'
                        : 'bg-[#090D16] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs truncate">{prof.name}</span>
                      <span className="font-mono tabular-nums text-[10px] text-blue-400 shrink-0">
                        {prof.screenWidth}×{prof.screenHeight}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                      {prof.hardwareConcurrency}C · {prof.deviceMemory}GB · {prof.language} ·{' '}
                      {prof.timezone}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Coherent Parameter Form */}
            <form
              onSubmit={handleSaveCustomProfile}
              className="pt-2 border-t border-slate-800 space-y-2.5"
            >
              <div className="font-semibold text-slate-200 text-xs">
                Customize Coherent Hardware & Locale Signals
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Screen Width (px)
                  </label>
                  <input
                    type="number"
                    min={320}
                    max={7680}
                    value={fpWidth}
                    onChange={(e) => setFpWidth(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 font-mono tabular-nums text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Screen Height (px)
                  </label>
                  <input
                    type="number"
                    min={240}
                    max={4320}
                    value={fpHeight}
                    onChange={(e) => setFpHeight(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 font-mono tabular-nums text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    CPU Logical Cores
                  </label>
                  <select
                    value={fpCores}
                    onChange={(e) => setFpCores(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100"
                  >
                    {[2, 4, 6, 8, 12, 16, 24, 32].map((c) => (
                      <option key={c} value={c}>
                        {c} Cores
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Device Memory
                  </label>
                  <select
                    value={fpMemory}
                    onChange={(e) => setFpMemory(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100"
                  >
                    {[2, 4, 8, 16, 32].map((m) => (
                      <option key={m} value={m}>
                        {m} GB
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Timezone (IANA)
                  </label>
                  <select
                    value={fpTimezone}
                    onChange={(e) => setFpTimezone(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100"
                  >
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="UTC">UTC</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Europe/Berlin">Europe/Berlin</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Language / Locale
                  </label>
                  <select
                    value={fpLang}
                    onChange={(e) => setFpLang(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100"
                  >
                    <option value="en-US">en-US</option>
                    <option value="en-GB">en-GB</option>
                    <option value="de-DE">de-DE</option>
                    <option value="fr-FR">fr-FR</option>
                    <option value="ja-JP">ja-JP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    WebGL Unmasked Vendor (0x9245)
                  </label>
                  <input
                    type="text"
                    value={fpWebglVendor}
                    onChange={(e) => setFpWebglVendor(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 font-mono text-[11px] text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    WebGL Unmasked Renderer (0x9246)
                  </label>
                  <input
                    type="text"
                    value={fpWebglRenderer}
                    onChange={(e) => setFpWebglRenderer(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 font-mono text-[11px] text-slate-100"
                  />
                </div>
              </div>

              {profileFeedback && (
                <div className="p-2 rounded bg-blue-950/50 border border-blue-500/40 text-blue-200 text-[11px]">
                  {profileFeedback}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
              >
                Save & Apply Coherent Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: PER-SITE WHITELIST EXCEPTIONS */}
      {(activeSubTab === 'whitelist' || layout === 'full') && (
        <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-slate-100">
                Per-Site Whitelist Exceptions
              </span>
            </div>
            {currentHost && (
              <button
                type="button"
                onClick={() =>
                  onAddWhitelistRule({
                    domain: currentHost,
                    enabled: true,
                    bypassControls: 'all',
                    reason: 'Added from active tab toolbar',
                  })
                }
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-300 text-[11px] font-medium"
              >
                + Whitelist Current Domain ({currentHost})
              </button>
            )}
          </div>

          <form onSubmit={handleAddWhitelistSubmit} className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                aria-label="Whitelist domain input"
                value={newWhitelistDomain}
                onChange={(e) => setNewWhitelistDomain(e.target.value)}
                placeholder="Enter domain (e.g. example.com, portal.internal)..."
                className="flex-1 bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              />
              <select
                aria-label="Whitelist bypass scope"
                value={newWhitelistScope}
                onChange={(e) => setNewWhitelistScope(e.target.value as 'all' | 'noCache')}
                className="bg-[#111827] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
              >
                <option value="all">Bypass All 12 Controls</option>
                <option value="noCache">Bypass No-Cache Only</option>
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Exception</span>
              </button>
            </div>
            <input
              type="text"
              value={newWhitelistReason}
              onChange={(e) => setNewWhitelistReason(e.target.value)}
              placeholder="Reason for exception..."
              className="w-full bg-[#111827] border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-300"
            />
          </form>

          <div className="space-y-1.5">
            {spoofConfig.whitelistRules.map((rule) => (
              <div
                key={rule.id}
                className="p-2.5 rounded-lg bg-[#090D16] border border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-100">
                      {rule.domain}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-500/30 text-[10px] font-mono text-blue-300">
                      {rule.bypassControls === 'all'
                        ? 'Bypasses All 12'
                        : `Bypasses: ${rule.bypassControls.join(', ')}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {rule.reason}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleWhitelistRule(rule.id)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border ${
                      rule.enabled
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove whitelist rule for ${rule.domain}`}
                    onClick={() => onDeleteWhitelistRule(rule.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DETAILED LOCAL PROTECTION TELEMETRY LOGS */}
      {(activeSubTab === 'logs' || layout === 'full') && (
        <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-100">
                Local Protection Audit Logs ({filteredLogs.length} entries)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Filter protection logs by control"
                value={logFilterControl}
                onChange={(e) => setLogFilterControl(e.target.value)}
                className="bg-[#111827] border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-200"
              >
                <option value="all">All Controls</option>
                {ALL_FINGERPRINT_CONTROL_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onSimulateFingerprintProbe}
                className="px-2.5 py-1 rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-[11px] font-medium"
              >
                Simulate Probe
              </button>
              <button
                type="button"
                onClick={onClearProtectionLogs}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
              >
                Clear Logs
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {filteredLogs.length === 0 ? (
              <div className="p-4 text-center text-slate-500 border border-slate-800/80 rounded-lg">
                No protection log entries recorded yet. Click &ldquo;Simulate Probe&rdquo; or
                navigate to a page to record intercepted API calls.
              </div>
            ) : (
              filteredLogs.slice(0, 40).map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded bg-[#090D16] border border-slate-800/90 font-mono text-[11px] space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-blue-400 font-semibold uppercase">
                      [{log.control}] {log.action}
                    </span>
                    <span className="text-slate-500 tabular-nums">{log.timestamp}</span>
                  </div>
                  <div className="text-slate-300 break-words">{log.detail}</div>
                  <div className="text-[10px] text-slate-500">
                    API: {log.apiSurface} · Origin: {log.origin}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: LIVE 12-SURFACE AUTOMATED VERIFICATION SUITE */}
      {(activeSubTab === 'verify' || layout === 'full') && (
        <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-100">
                Automated 12-Surface Behavioral Verification Matrix
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 tabular-nums">
              {verificationResults.filter((r) => r.passed).length}/12 Checks Verified
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-2">Surface</th>
                  <th className="py-2 px-2">State</th>
                  <th className="py-2 px-2">Unprotected Baseline</th>
                  <th className="py-2 px-2">Active Spoofed Output</th>
                  <th className="py-2 pl-2">Cross-Tab Coherence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {verificationResults.map((row) => (
                  <tr key={row.control} className="hover:bg-slate-900/40">
                    <td className="py-2 pr-2 font-semibold text-slate-100">{row.label}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          row.enabled
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {row.enabled ? 'ON' : 'OFF'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-400 max-w-[180px] truncate">
                      {row.nativeSample}
                    </td>
                    <td className="py-2 px-2 text-blue-300 max-w-[240px] truncate">
                      {row.spoofedSample}
                    </td>
                    <td className="py-2 pl-2 text-emerald-400 max-w-[200px] truncate">
                      {row.coherenceCheck}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
