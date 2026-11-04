import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Play,
  Trash2,
  Plus,
  Globe,
  Lock,
  Video,
  Activity,
  RotateCcw,
} from 'lucide-react';
import {
  WebRTCConfig,
  WebRTCPolicy,
  WebRTCWhitelistRule,
} from '../types/browser';
import {
  appendWebRTCShieldLog,
  createUntestedWebRTCLeakResult,
  extractHostnameFromUrl,
  isDomainWhitelistedForWebRTC,
  normalizeWebRTCConfig,
  resolveEffectiveWebRTCProtection,
  runWebRTCLeakDetectionAudit,
  syncPolicyFromShieldFlags,
} from '../utils/browserEngine';

interface WebRTCShieldViewProps {
  layout?: 'drawer' | 'full';
  activeTabUrl: string;
  webrtcConfig: WebRTCConfig;
  onUpdateWebRTC: (nextConfig: WebRTCConfig) => void;
  onNavigate?: (url: string) => void;
}

export const WebRTCShieldView: React.FC<WebRTCShieldViewProps> = ({
  layout = 'full',
  activeTabUrl,
  webrtcConfig,
  onUpdateWebRTC,
  onNavigate,
}) => {
  const resolved = resolveEffectiveWebRTCProtection(webrtcConfig, activeTabUrl);
  const cfg = resolved.config;
  const leakTest = cfg.lastLeakTest;
  const lastEvent = cfg.shieldLogs[0] || null;

  const [newWhitelistDomain, setNewWhitelistDomain] = useState('');
  const [newWhitelistNote, setNewWhitelistNote] = useState(
    'Trusted video/voice call website'
  );
  const [whitelistError, setWhitelistError] = useState<string | null>(null);
  const [isProbingBrowserRtc, setIsProbingBrowserRtc] = useState(false);

  const currentHostname = extractHostnameFromUrl(activeTabUrl) || 'home';
  const currentDomainWhitelist = isDomainWhitelistedForWebRTC(
    activeTabUrl,
    cfg.whitelistDomains
  );

  const handleToggleShieldFlag = (
    flagKey:
      | 'enabled'
      | 'shieldEnabled'
      | 'blockLocalIp'
      | 'blockPublicIp'
      | 'blockUdp'
      | 'forceProxy'
      | 'leakDetectionEnabled'
  ) => {
    const nextVal = !cfg[flagKey];
    const nextDraft = {
      ...cfg,
      [flagKey]: nextVal,
    };

    const syncedPolicy = syncPolicyFromShieldFlags({
      shieldEnabled: nextDraft.shieldEnabled,
      blockLocalIp: nextDraft.blockLocalIp,
      blockPublicIp: nextDraft.blockPublicIp,
      blockUdp: nextDraft.blockUdp,
      forceProxy: nextDraft.forceProxy,
      fallbackPolicy: nextDraft.policy,
    });

    const labelMap: Record<typeof flagKey, string> = {
      enabled: 'WebRTC Master Control',
      shieldEnabled: 'Enable WebRTC Shield',
      blockLocalIp: 'Block Local IP Exposure',
      blockPublicIp: 'Block Public IP Exposure',
      blockUdp: 'Block UDP',
      forceProxy: 'Force Proxy for WebRTC',
      leakDetectionEnabled: 'Leak Detection',
    };

    const updatedWithLog = appendWebRTCShieldLog(
      {
        ...nextDraft,
        policy: syncedPolicy,
      },
      {
        origin: currentHostname,
        eventType: 'shield_config_changed',
        action: 'updated',
        summary: `${labelMap[flagKey]} -> ${nextVal ? 'ENABLED' : 'DISABLED'}`,
        detail: `Effective Chromium WebRTC policy synchronized to "${syncedPolicy}".`,
      }
    );

    onUpdateWebRTC(updatedWithLog);
  };

  const handleSelectChromiumPolicy = (policy: WebRTCPolicy) => {
    const nextFlags =
      policy === 'disable_non_proxied_udp'
        ? {
            shieldEnabled: true,
            blockLocalIp: true,
            blockPublicIp: true,
            blockUdp: true,
            forceProxy: true,
          }
        : policy === 'default_public_interface_only'
        ? {
            shieldEnabled: true,
            blockLocalIp: true,
            blockPublicIp: false,
            blockUdp: false,
            forceProxy: false,
          }
        : policy === 'default_public_and_private_interfaces'
        ? {
            shieldEnabled: true,
            blockLocalIp: false,
            blockPublicIp: false,
            blockUdp: false,
            forceProxy: false,
          }
        : {
            shieldEnabled: false,
            blockLocalIp: false,
            blockPublicIp: false,
            blockUdp: false,
            forceProxy: false,
          };

    const updatedWithLog = appendWebRTCShieldLog(
      {
        ...cfg,
        ...nextFlags,
        policy,
      },
      {
        origin: currentHostname,
        eventType: 'shield_config_changed',
        action: 'updated',
        summary: `Chromium IP Handling Policy set to "${policy}"`,
        detail: `Synchronized WebRTC Shield controls with Chromium policy "${policy}".`,
      }
    );

    onUpdateWebRTC(updatedWithLog);
  };

  const handleRunLiveLeakTest = async () => {
    setIsProbingBrowserRtc(true);
    const gatheredCandidates: string[] = [];

    // Probe real browser RTCPeerConnection if available in the runtime
    try {
      if (typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'function') {
        await new Promise<void>((resolve) => {
          const pc = new window.RTCPeerConnection({ iceServers: [] });
          pc.createDataChannel('viju-webrtc-leak-probe');
          const timeout = setTimeout(() => {
            try {
              pc.close();
            } catch {}
            resolve();
          }, 220);

          pc.onicecandidate = (ev) => {
            if (ev?.candidate?.candidate) {
              gatheredCandidates.push(ev.candidate.candidate);
            } else if (!ev?.candidate) {
              clearTimeout(timeout);
              try {
                pc.close();
              } catch {}
              resolve();
            }
          };

          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .catch(() => {
              clearTimeout(timeout);
              resolve();
            });
        });
      }
    } catch {
      // RTCPeerConnection blocked or unavailable
    }

    const { updatedConfig } = runWebRTCLeakDetectionAudit(
      cfg,
      activeTabUrl,
      gatheredCandidates
    );
    setIsProbingBrowserRtc(false);
    onUpdateWebRTC(updatedConfig);
  };

  const handleClearLogs = () => {
    onUpdateWebRTC({
      ...cfg,
      shieldLogs: [],
    });
  };

  const handleResetDefaults = () => {
    const def = normalizeWebRTCConfig({
      enabled: true,
      policy: 'default_public_interface_only',
      shieldEnabled: true,
      blockLocalIp: true,
      blockPublicIp: false,
      blockUdp: false,
      forceProxy: false,
      leakDetectionEnabled: true,
      lastLeakTest: createUntestedWebRTCLeakResult(),
    });
    onUpdateWebRTC(def);
  };

  const handleAddWhitelistDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = extractHostnameFromUrl(newWhitelistDomain.trim());
    if (!cleaned || cleaned.length < 3 || !cleaned.includes('.')) {
      setWhitelistError(
        'Enter a valid domain name (e.g. meet.google.com, zoom.us, or discord.com).'
      );
      return;
    }
    if (cfg.whitelistDomains.some((r) => r.domain.toLowerCase() === cleaned)) {
      setWhitelistError(`"${cleaned}" is already in the WebRTC Whitelist.`);
      return;
    }

    const newRule: WebRTCWhitelistRule = {
      id: `wrtc-wl-${Date.now()}`,
      domain: cleaned,
      enabled: true,
      note: newWhitelistNote.trim() || 'Trusted WebRTC site exception',
      addedAt: new Date().toISOString().slice(0, 10),
    };

    setWhitelistError(null);
    setNewWhitelistDomain('');
    const updated = appendWebRTCShieldLog(
      {
        ...cfg,
        whitelistDomains: [newRule, ...cfg.whitelistDomains],
      },
      {
        origin: cleaned,
        eventType: 'whitelist_bypassed',
        action: 'allowed',
        summary: `Added "${cleaned}" to WebRTC Shield Whitelist`,
        detail: `Trusted site "${cleaned}" is now permitted to establish WebRTC peer connections.`,
      }
    );
    onUpdateWebRTC(updated);
  };

  const handleToggleCurrentDomainWhitelist = () => {
    if (!currentHostname || activeTabUrl.startsWith('viju://')) return;
    if (currentDomainWhitelist.whitelisted && currentDomainWhitelist.matchedRule) {
      const nextRules = cfg.whitelistDomains.filter(
        (r) => r.id !== currentDomainWhitelist.matchedRule!.id
      );
      const updated = appendWebRTCShieldLog(
        {
          ...cfg,
          whitelistDomains: nextRules,
        },
        {
          origin: currentHostname,
          eventType: 'shield_config_changed',
          action: 'updated',
          summary: `Removed "${currentHostname}" from WebRTC Whitelist`,
          detail: `WebRTC Shield protections re-enabled on ${currentHostname}.`,
        }
      );
      onUpdateWebRTC(updated);
    } else {
      const newRule: WebRTCWhitelistRule = {
        id: `wrtc-wl-${Date.now()}`,
        domain: currentHostname,
        enabled: true,
        note: 'Trusted via current tab quick-toggle',
        addedAt: new Date().toISOString().slice(0, 10),
      };
      const updated = appendWebRTCShieldLog(
        {
          ...cfg,
          whitelistDomains: [newRule, ...cfg.whitelistDomains],
        },
        {
          origin: currentHostname,
          eventType: 'whitelist_bypassed',
          action: 'allowed',
          summary: `Whitelisted current domain "${currentHostname}" for WebRTC`,
          detail: `Trusted site exception active on ${currentHostname}.`,
        }
      );
      onUpdateWebRTC(updated);
    }
  };

  const handleToggleWhitelistRule = (id: string) => {
    const nextRules = cfg.whitelistDomains.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    onUpdateWebRTC({
      ...cfg,
      whitelistDomains: nextRules,
    });
  };

  const handleDeleteWhitelistRule = (id: string) => {
    const nextRules = cfg.whitelistDomains.filter((r) => r.id !== id);
    onUpdateWebRTC({
      ...cfg,
      whitelistDomains: nextRules,
    });
  };

  return (
    <div className="space-y-4 text-xs text-slate-200">
      {/* Video / Voice Call Compatibility Warning Banner */}
      {resolved.videoCallCompatibility.warningMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-1.5"
        >
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Video & Voice Call Compatibility Warning</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            {resolved.videoCallCompatibility.warningMessage}
          </p>
        </div>
      )}

      {/* 1. SHIELD STATUS PANEL */}
      <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            {cfg.shieldEnabled && cfg.enabled ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : !cfg.enabled ? (
              <Lock className="w-4 h-4 text-red-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
              WebRTC Shield Status Panel
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              data-testid="webrtc-shield-status-badge"
              className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-semibold border ${
                resolved.isWhitelistedOrigin
                  ? 'bg-sky-950/70 border-sky-500/40 text-sky-300'
                  : !cfg.enabled
                  ? 'bg-red-950/70 border-red-500/40 text-red-300'
                  : cfg.shieldEnabled
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
              }`}
            >
              {resolved.isWhitelistedOrigin
                ? 'WHITELISTED ORIGIN'
                : !cfg.enabled
                ? 'WEBRTC DISABLED'
                : cfg.shieldEnabled
                ? 'SHIELD ENABLED'
                : 'SHIELD DISABLED'}
            </span>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition-colors"
              title="Reset WebRTC Shield to recommended defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Grid */}
        <div
          className={`grid grid-cols-1 ${
            layout === 'full' ? 'md:grid-cols-3' : 'grid-cols-1'
          } gap-2.5`}
        >
          {/* Current Protection Mode */}
          <div className="p-3 rounded-lg bg-[#070A12] border border-slate-800/90 space-y-1">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Current WebRTC Protection Mode
            </div>
            <div className="font-semibold text-slate-100">
              {resolved.protectionModeLabel}
            </div>
            <div className="text-[10px] font-mono text-blue-400">
              Chromium Policy: {resolved.effectiveChromiumPolicy}
            </div>
          </div>

          {/* Leak Test Status */}
          <div className="p-3 rounded-lg bg-[#070A12] border border-slate-800/90 space-y-1">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Leak Test Status
            </div>
            <div
              data-testid="webrtc-leak-test-status"
              className={`font-semibold flex items-center gap-1.5 ${
                leakTest.status === 'not_tested'
                  ? 'text-slate-300'
                  : leakTest.status === 'passed_no_leak' ||
                    leakTest.status === 'webrtc_blocked'
                  ? 'text-emerald-300'
                  : leakTest.status === 'whitelisted_trusted'
                  ? 'text-sky-300'
                  : 'text-red-300'
              }`}
            >
              {leakTest.status === 'not_tested' && (
                <span>Not Tested Yet (Run Test to Verify)</span>
              )}
              {leakTest.status === 'passed_no_leak' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Passed — Local IP Protected</span>
                </>
              )}
              {leakTest.status === 'webrtc_blocked' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Passed — All WebRTC Blocked</span>
                </>
              )}
              {leakTest.status === 'whitelisted_trusted' && (
                <span>Trusted Site (Whitelist Active)</span>
              )}
              {leakTest.status === 'leak_detected' && (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>IP Exposure Detected!</span>
                </>
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {leakTest.testedAt
                ? `Last tested at ${leakTest.testedAt} on ${leakTest.testedOrigin}`
                : 'No leak test executed in this session'}
            </div>
          </div>

          {/* Video Call Compatibility */}
          <div className="p-3 rounded-lg bg-[#070A12] border border-slate-800/90 space-y-1">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Video & Voice Call Compatibility
            </div>
            <div
              className={`font-semibold flex items-center gap-1.5 ${
                resolved.videoCallCompatibility.status === 'compatible'
                  ? 'text-emerald-300'
                  : resolved.videoCallCompatibility.status === 'may_break_calls'
                  ? 'text-amber-300'
                  : 'text-red-300'
              }`}
            >
              <Video className="w-3.5 h-3.5 shrink-0" />
              <span>{resolved.videoCallCompatibility.label}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Meet / Zoom / Teams / Discord
            </div>
          </div>
        </div>

        {/* Detected Local & Public IP Exposure Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="p-3 rounded-lg bg-[#070A12] border border-slate-800/90 space-y-1">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Detected Local IP Exposure (RFC1918 / mDNS)
            </div>
            <div
              data-testid="webrtc-local-ip-exposure"
              className={`font-mono text-xs font-semibold ${
                leakTest.status === 'not_tested'
                  ? 'text-slate-400'
                  : leakTest.localIpExposed
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }`}
            >
              {leakTest.status === 'not_tested'
                ? 'Not Tested Yet'
                : leakTest.localIpExposed
                ? `EXPOSED: ${leakTest.detectedLocalIps.join(', ')}`
                : '0 Local IPs Exposed (Blocked by Shield)'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#070A12] border border-slate-800/90 space-y-1">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Detected Public IP Exposure (STUN srflx)
            </div>
            <div
              data-testid="webrtc-public-ip-exposure"
              className={`font-mono text-xs font-semibold ${
                leakTest.status === 'not_tested'
                  ? 'text-slate-400'
                  : leakTest.publicIpExposed && cfg.blockPublicIp
                  ? 'text-red-400'
                  : leakTest.publicIpExposed
                  ? 'text-amber-300'
                  : 'text-emerald-400'
              }`}
            >
              {leakTest.status === 'not_tested'
                ? 'Not Tested Yet'
                : leakTest.publicIpExposed
                ? `${leakTest.detectedPublicIps.join(', ')} (STUN Visible)`
                : '0 Public IPs Exposed (STUN/UDP Blocked)'}
            </div>
          </div>
        </div>

        {/* Run Live Leak Test Action Row */}
        <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <div className="font-semibold text-blue-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Live WebRTC ICE Candidate Leak Probe</span>
            </div>
            <p className="text-[11px] text-slate-300">
              {leakTest.verdictSummary}
            </p>
          </div>
          <button
            type="button"
            disabled={isProbingBrowserRtc}
            onClick={handleRunLiveLeakTest}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {isProbingBrowserRtc ? 'Testing ICE Candidates...' : 'Run WebRTC Leak Test'}
            </span>
          </button>
        </div>

        {/* Last Protection Event & Clear Logs */}
        <div className="p-3 rounded-lg bg-[#070A12] border border-slate-800/90 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase text-slate-400">
              Last Protection Event ({cfg.shieldLogs.length} Local Events)
            </span>
            <button
              type="button"
              onClick={handleClearLogs}
              disabled={cfg.shieldLogs.length === 0}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                cfg.shieldLogs.length === 0
                  ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-red-950/50 border-red-500/40 text-red-300 hover:bg-red-900/50'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Logs</span>
            </button>
          </div>

          {lastEvent ? (
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between font-mono text-slate-300">
                <span className="font-semibold text-blue-300">{lastEvent.summary}</span>
                <span className="text-slate-500">{lastEvent.timestamp}</span>
              </div>
              <div className="text-slate-400">{lastEvent.detail}</div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic">
              Local WebRTC Shield logs cleared. No protection events recorded.
            </div>
          )}
        </div>
      </div>

      {/* 2. SHIELD CONTROLS (7 REQUIRED OPTIONS + INTEGRATED WEBRTC MASTER CONTROL) */}
      <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              WebRTC Shield Controls
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Integrated with WebRTC Control and Chromium IP handling policies without
              conflicting settings.
            </p>
          </div>
          {layout === 'drawer' && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('viju://webrtc-test')}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-blue-300 transition-colors"
            >
              Open Full Diagnostic Page
            </button>
          )}
        </div>

        <div
          className={`grid grid-cols-1 ${
            layout === 'full' ? 'md:grid-cols-2' : 'grid-cols-1'
          } gap-2.5`}
        >
          {/* Control 1: Enable WebRTC Shield */}
          <label className="p-3 rounded-lg bg-[#070A12] border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-3 cursor-pointer">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-100">1. Enable WebRTC Shield</div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Master protection toggle enforcing Chromium WebRTC IP handling policies and
                preload ICE candidate filtering.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Enable WebRTC Shield"
              checked={cfg.shieldEnabled}
              onChange={() => handleToggleShieldFlag('shieldEnabled')}
              className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
            />
          </label>

          {/* Control 2: Block Local IP Exposure */}
          <label className="p-3 rounded-lg bg-[#070A12] border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-3 cursor-pointer">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-100">
                2. Block Local IP Exposure
              </div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Prevent local network RFC1918 (192.168.x.x / 10.x.x.x) and mDNS IP addresses
                from being exposed via WebRTC host candidates.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Block Local IP Exposure"
              checked={cfg.blockLocalIp}
              onChange={() => handleToggleShieldFlag('blockLocalIp')}
              className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
            />
          </label>

          {/* Control 3: Block Public IP Exposure */}
          <label className="p-3 rounded-lg bg-[#070A12] border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-3 cursor-pointer">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-100">
                3. Block Public IP Exposure
              </div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Restrict public IP discovery through STUN server-reflexive (srflx) binding
                requests where supported.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Block Public IP Exposure"
              checked={cfg.blockPublicIp}
              onChange={() => handleToggleShieldFlag('blockPublicIp')}
              className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
            />
          </label>

          {/* Control 4: Block UDP */}
          <label className="p-3 rounded-lg bg-[#070A12] border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-3 cursor-pointer">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-100">4. Block UDP</div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Restrict direct WebRTC UDP transport sockets (
                <code className="text-blue-300">disable_non_proxied_udp</code>). May break P2P
                video calls.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Block UDP"
              checked={cfg.blockUdp}
              onChange={() => handleToggleShieldFlag('blockUdp')}
              className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
            />
          </label>

          {/* Control 5: Force Proxy for WebRTC */}
          <label className="p-3 rounded-lg bg-[#070A12] border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-3 cursor-pointer">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-100">
                5. Force Proxy for WebRTC
              </div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Prevent WebRTC traffic from bypassing configured HTTP/SOCKS proxy tunnels via
                direct UDP sockets.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Force Proxy for WebRTC"
              checked={cfg.forceProxy}
              onChange={() => handleToggleShieldFlag('forceProxy')}
              className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
            />
          </label>

          {/* Control 6: Leak Detection */}
          <label className="p-3 rounded-lg bg-[#070A12] border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-3 cursor-pointer">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-100">6. Leak Detection</div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Continuously monitor <code className="text-blue-300">onicecandidate</code>{' '}
                activity and report exposed local or public IP addresses.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Leak Detection"
              checked={cfg.leakDetectionEnabled}
              onChange={() => handleToggleShieldFlag('leakDetectionEnabled')}
              className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
            />
          </label>
        </div>

        {/* Integrated WebRTC Master Control (Unified with WebRTC Control feature) */}
        <div className="p-3 rounded-lg bg-[#070A12] border border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>WebRTC Master Control (Allow WebRTC Peer Connections)</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {cfg.enabled
                ? 'RTCPeerConnection enabled and governed by WebRTC Shield controls above.'
                : 'RTCPeerConnection & mediaDevices completely blocked in preload script.'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="WebRTC Master Control"
            aria-checked={cfg.enabled}
            onClick={() => handleToggleShieldFlag('enabled')}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs border transition-colors shrink-0 ${
              cfg.enabled
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                : 'bg-red-600/20 border-red-500/50 text-red-300 hover:bg-red-600/30'
            }`}
          >
            {cfg.enabled ? 'WebRTC Enabled' : 'WebRTC Disabled'}
          </button>
        </div>
      </div>

      {/* 3. WHITELIST MANAGER (7th Shield Control: Trusted Websites) */}
      <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              7. WebRTC Whitelist (Trusted Video & Voice Call Websites)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Allow WebRTC peer connections on selected trusted websites (supports exact domain
              and subdomain matching).
            </p>
          </div>

          {!activeTabUrl.startsWith('viju://') && (
            <button
              type="button"
              onClick={handleToggleCurrentDomainWhitelist}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                currentDomainWhitelist.whitelisted
                  ? 'bg-sky-950/70 border-sky-500/40 text-sky-300 hover:bg-sky-900/50'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {currentDomainWhitelist.whitelisted
                ? `Whitelisted: ${currentHostname} (Click to Remove)`
                : `Trust Current Site (${currentHostname})`}
            </button>
          )}
        </div>

        {/* Add Trusted Domain Form */}
        <form onSubmit={handleAddWhitelistDomain} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            aria-label="Add trusted WebRTC domain to whitelist"
            value={newWhitelistDomain}
            onChange={(e) => {
              setNewWhitelistDomain(e.target.value);
              setWhitelistError(null);
            }}
            placeholder="e.g. meet.google.com, zoom.us, discord.com"
            className="flex-1 bg-[#070A12] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none"
          />
          <input
            type="text"
            aria-label="Trusted domain note"
            value={newWhitelistNote}
            onChange={(e) => setNewWhitelistNote(e.target.value)}
            placeholder="Reason / Note"
            className="sm:w-52 bg-[#070A12] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
          />
          <button
            type="submit"
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Trusted Site</span>
          </button>
        </form>

        {whitelistError && (
          <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-[11px]">
            {whitelistError}
          </div>
        )}

        {/* Whitelist Rules List */}
        <div className="space-y-1.5">
          {cfg.whitelistDomains.map((rule) => (
            <div
              key={rule.id}
              className="p-2.5 rounded-lg bg-[#070A12] border border-slate-800 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="font-mono font-semibold text-slate-100 truncate">
                    {rule.domain}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      rule.enabled
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {rule.enabled ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {rule.note}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleWhitelistRule(rule.id)}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300"
                >
                  {rule.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${rule.domain} from WebRTC Whitelist`}
                  onClick={() => handleDeleteWhitelistRule(rule.id)}
                  className="p-1.5 rounded bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. UNDERLYING CHROMIUM IP HANDLING POLICY & LOCAL LOG HISTORY */}
      {layout === 'full' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Synchronized Chromium IP Handling Policy Selector */}
          <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-2.5">
            <div className="font-bold text-slate-100">
              Synchronized Chromium WebRTC IP Handling Policy
            </div>
            <p className="text-[11px] text-slate-400">
              Directly maps to{' '}
              <code className="text-blue-300">
                webContents.setWebRTCIPHandlingPolicy()
              </code>{' '}
              in Electron.
            </p>
            {(
              [
                {
                  policy: 'default' as WebRTCPolicy,
                  title: 'default (Unrestricted All Interfaces)',
                  desc: 'Shield Disabled: Enumerates all public and local RFC1918 LAN interfaces.',
                },
                {
                  policy: 'default_public_and_private_interfaces' as WebRTCPolicy,
                  title: 'default_public_and_private_interfaces',
                  desc: 'Uses only the OS default route adapter; hides secondary virtual NICs.',
                },
                {
                  policy: 'default_public_interface_only' as WebRTCPolicy,
                  title: 'default_public_interface_only (Recommended)',
                  desc: 'Block Local IP Exposure: Strips RFC1918 private LAN host candidates.',
                },
                {
                  policy: 'disable_non_proxied_udp' as WebRTCPolicy,
                  title: 'disable_non_proxied_udp (Strict UDP & Proxy Lockdown)',
                  desc: 'Block UDP / Force Proxy / Block Public IP: Blocks direct STUN UDP packets.',
                },
              ] as const
            ).map((item) => (
              <label
                key={item.policy}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  resolved.effectiveChromiumPolicy === item.policy
                    ? 'bg-blue-950/40 border-blue-500 text-slate-100'
                    : 'bg-[#070A12] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="chromium-webrtc-policy"
                  checked={resolved.effectiveChromiumPolicy === item.policy}
                  onChange={() => handleSelectChromiumPolicy(item.policy)}
                  className="mt-1 accent-blue-500"
                />
                <div>
                  <div className="font-mono font-semibold text-xs text-slate-100">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Local Protection Event Log History */}
          <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100">
                  Local WebRTC Shield Event Log ({cfg.shieldLogs.length})
                </span>
                <button
                  type="button"
                  onClick={handleClearLogs}
                  disabled={cfg.shieldLogs.length === 0}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 disabled:opacity-40"
                >
                  Clear All Logs
                </button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {cfg.shieldLogs.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 italic">
                    No local WebRTC Shield events recorded.
                  </div>
                ) : (
                  cfg.shieldLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-[#070A12] border border-slate-800/90 space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-blue-300 font-semibold">{log.summary}</span>
                        <span className="text-slate-500">{log.timestamp}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{log.detail}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
