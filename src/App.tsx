import React, { useState, useEffect, useCallback } from 'react';
import {
  ActiveSidePanel,
  BookmarkItem,
  CacheStorageMetrics,
  ClearBrowsingDataPayload,
  ClosedTabRecord,
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
} from './types/browser';
import {
  ALL_FINGERPRINT_CONTROL_KEYS,
  CLEAR_TIME_RANGES,
  DEFAULT_FINGERPRINT_PROFILES,
  applyStrictProtectionPreset,
  applyUserAgentToTab,
  computePrivacyStatusSummary,
  createDefaultFingerprintSpoofConfig,
  createDefaultRandomUASwitcherConfig,
  createProtectionLogEntriesForEvent,
  createTabState,
  disableAllFingerprintControls,
  enableAllFingerprintControls,
  extractHostnameFromUrl,
  filterRecordsByClearTimeRange,
  formatSeedHex,
  generateCoherentRandomProfile,
  generateNextUserAgentProfile,
  goBackTabState,
  goForwardTabState,
  mapWebDataToElectronStorages,
  navigateTabState,
  normalizeWebRTCConfig,
  resetDefaultFingerprintSpoofConfig,
  resolveEffectiveUserAgentForUrl,
  tickAutoRotateUASwitcher,
  toggleDomainInUABlacklist,
  validateAutoRefreshInterval,
} from './utils/browserEngine';
import { TabStrip } from './components/TabStrip';
import { NavigationToolbar } from './components/NavigationToolbar';
import { BrowserViewport } from './components/BrowserViewport';
import { SidePanelDrawer } from './components/SidePanelDrawer';

const STORAGE_KEY = 'viju_browser_persistent_session_v3';

const INITIAL_BOOKMARKS: BookmarkItem[] = [
  {
    id: 'bm-home',
    title: 'Viju Start',
    url: 'viju://home',
    category: 'Core',
    createdAt: '2026-11-03',
  },
  {
    id: 'bm-electron',
    title: 'Electron .EXE Source',
    url: 'viju://electron-source',
    category: 'Deliverables',
    createdAt: '2026-11-03',
  },
  {
    id: 'bm-webrtc',
    title: 'WebRTC Policy Audit',
    url: 'viju://webrtc-test',
    category: 'Security',
    createdAt: '2026-11-03',
  },
  {
    id: 'bm-fp',
    title: 'Fingerprint Signals',
    url: 'viju://fingerprint',
    category: 'Privacy',
    createdAt: '2026-11-03',
  },
  {
    id: 'bm-chromium',
    title: 'Chromium Security',
    url: 'https://www.chromium.org/Home/chromium-security/',
    category: 'Reference',
    createdAt: '2026-11-03',
  },
];

const INITIAL_DOWNLOADS: DownloadItem[] = [
  {
    id: 'dl-seed-1',
    filename: 'Viju-Browser-Portable-1.4.0-x64.exe',
    url: 'https://releases.vijubrowser.dev/win64/Viju-Browser-Portable-1.4.0-x64.exe',
    totalBytes: 76_400_000,
    receivedBytes: 76_400_000,
    status: 'completed',
    startedAt: '21:00:15',
    timestampMs: Date.now() - 5 * 60 * 1000,
    speedKbps: 0,
  },
];

const INITIAL_FORM_DATA: FormAutofillEntry[] = [
  {
    id: 'form-1',
    fieldName: 'search_query',
    value: 'electron session clearStorageData documentation',
    origin: 'https://www.google.com',
    savedAt: '5 mins ago',
    timestampMs: Date.now() - 5 * 60 * 1000,
  },
  {
    id: 'form-2',
    fieldName: 'developer_email',
    value: 'security-audit@vijubrowser.dev',
    origin: 'https://www.chromium.org',
    savedAt: '35 mins ago',
    timestampMs: Date.now() - 35 * 60 * 1000,
  },
  {
    id: 'form-3',
    fieldName: 'organization_name',
    value: 'Viju Chromium Engineering Lab',
    origin: 'https://github.com',
    savedAt: '2 days ago',
    timestampMs: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
];

const INITIAL_PASSWORDS: SavedPasswordEntry[] = [
  {
    id: 'pwd-1',
    origin: 'https://github.com',
    username: 'viju-dev-admin',
    savedAt: '10 mins ago',
    timestampMs: Date.now() - 10 * 60 * 1000,
  },
  {
    id: 'pwd-2',
    origin: 'https://portal.vijubrowser.dev',
    username: 'release-signer@vijubrowser.dev',
    savedAt: '3 days ago',
    timestampMs: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
];

export default function App() {
  const loadStored = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore storage errors
    }
    return null;
  };

  const stored = loadStored();

  const [tabs, setTabs] = useState<TabItem[]>(() => {
    if (stored?.tabs && Array.isArray(stored.tabs) && stored.tabs.length > 0) {
      return stored.tabs;
    }
    return [
      createTabState('tab-1', 'viju://home'),
      createTabState('tab-2', 'viju://electron-source'),
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (stored?.activeTabId) return stored.activeTabId;
    return 'tab-1';
  });

  const [closedTabs, setClosedTabs] = useState<ClosedTabRecord[]>([]);

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    if (stored?.bookmarks && Array.isArray(stored.bookmarks)) return stored.bookmarks;
    return INITIAL_BOOKMARKS;
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (stored?.history && Array.isArray(stored.history)) return stored.history;
    return [
      {
        id: 'hist-init-1',
        title: 'Viju Start — Security & Privacy Dashboard',
        url: 'viju://home',
        visitedAt: new Date().toLocaleTimeString(),
        timestampMs: Date.now() - 4 * 60 * 1000,
        tabId: 'tab-1',
      },
      {
        id: 'hist-init-2',
        title: 'The Chromium Projects — Security Architecture',
        url: 'https://www.chromium.org/Home/chromium-security/',
        visitedAt: '40 mins ago',
        timestampMs: Date.now() - 40 * 60 * 1000,
        tabId: 'tab-1',
      },
    ];
  });

  const [formDataEntries, setFormDataEntries] = useState<FormAutofillEntry[]>(() => {
    if (stored?.formDataEntries && Array.isArray(stored.formDataEntries)) {
      return stored.formDataEntries;
    }
    return INITIAL_FORM_DATA;
  });

  const [savedPasswords, setSavedPasswords] = useState<SavedPasswordEntry[]>(() => {
    if (stored?.savedPasswords && Array.isArray(stored.savedPasswords)) {
      return stored.savedPasswords;
    }
    return INITIAL_PASSWORDS;
  });

  const [fingerprintProfiles, setFingerprintProfiles] = useState<FingerprintProfile[]>(
    () => {
      if (stored?.fingerprintProfiles && Array.isArray(stored.fingerprintProfiles)) {
        return stored.fingerprintProfiles;
      }
      return DEFAULT_FINGERPRINT_PROFILES;
    }
  );

  const [activeFingerprintId, setActiveFingerprintId] = useState<string>(() => {
    return stored?.activeFingerprintId || DEFAULT_FINGERPRINT_PROFILES[0].id;
  });

  const [webrtcConfig, setWebrtcConfig] = useState<WebRTCConfig>(() => {
    return normalizeWebRTCConfig(stored?.webrtcConfig);
  });

  const [fingerprintSpoofConfig, setFingerprintSpoofConfig] =
    useState<FingerprintSpoofConfig>(() => {
      if (
        stored?.fingerprintSpoofConfig &&
        stored.fingerprintSpoofConfig.controls &&
        typeof stored.fingerprintSpoofConfig.profileSeed === 'number'
      ) {
        return stored.fingerprintSpoofConfig;
      }
      return createDefaultFingerprintSpoofConfig();
    });

  const [protectionLogs, setProtectionLogs] = useState<FingerprintProtectionLogEntry[]>(
    () => {
      if (stored?.protectionLogs && Array.isArray(stored.protectionLogs)) {
        return stored.protectionLogs;
      }
      const defCfg = createDefaultFingerprintSpoofConfig();
      return createProtectionLogEntriesForEvent(
        'probe_simulation',
        defCfg,
        DEFAULT_FINGERPRINT_PROFILES[0],
        normalizeWebRTCConfig(),
        'viju://home',
        'tab-1'
      );
    }
  );

  const [cacheMetrics, setCacheMetrics] = useState<CacheStorageMetrics>(() => {
    if (stored?.cacheMetrics && typeof stored.cacheMetrics.cacheMB === 'number') {
      return stored.cacheMetrics;
    }
    return {
      appCacheKB: 64,
      cacheMB: 42.8,
      cacheStorageMB: 14.2,
      cookiesCount: 18,
      fileSystemsKB: 256,
      indexedDBKB: 1240,
      localStorageKB: 384,
      serviceWorkersCount: 3,
      webSQLKB: 128,
      lastClearedAt: null,
    };
  });

  const [uaSwitcherConfig, setUaSwitcherConfig] = useState<RandomUASwitcherConfig>(() => {
    if (
      stored?.uaSwitcherConfig &&
      stored.uaSwitcherConfig.generatorToggles &&
      stored.uaSwitcherConfig.activeGeneratedProfile
    ) {
      const loaded: RandomUASwitcherConfig = stored.uaSwitcherConfig;
      if (loaded.enabledGlobally && loaded.rotateOnStartup && !loaded.paused) {
        const rotated = generateNextUserAgentProfile(loaded);
        if (rotated.ok && rotated.profile) {
          return {
            ...loaded,
            activeGeneratedProfile: rotated.profile,
            selectedBrowserFamily: rotated.profile.browserFamily,
            selectedOsFamily: rotated.profile.osFamily,
            rotationCount: loaded.rotationCount + 1,
            remainingSeconds: loaded.autoRotateIntervalSeconds,
            lastRotatedAt: new Date().toLocaleTimeString(),
          };
        }
      }
      return loaded;
    }
    return createDefaultRandomUASwitcherConfig(true);
  });

  const [uaErrorBanner, setUaErrorBanner] = useState<string | null>(null);
  const [uaStatusBanner, setUaStatusBanner] = useState<string | null>(null);

  const [downloads, setDownloads] = useState<DownloadItem[]>(INITIAL_DOWNLOADS);
  const [activePanel, setActivePanel] = useState<ActiveSidePanel>('none');
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastBanner(msg);
    setTimeout(() => {
      setToastBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Synchronize effectiveUserAgent across all open tabs whenever uaSwitcherConfig changes
  useEffect(() => {
    setTabs((prevTabs) => {
      let changed = false;
      const nextTabs = prevTabs.map((t) => {
        const resolved = resolveEffectiveUserAgentForUrl(t.url, uaSwitcherConfig);
        if (t.effectiveUserAgent !== resolved.effectiveProfile.userAgent) {
          changed = true;
          return {
            ...t,
            effectiveUserAgent: resolved.effectiveProfile.userAgent,
          };
        }
        return t;
      });
      return changed ? nextTabs : prevTabs;
    });
  }, [uaSwitcherConfig]);

  // Persist session state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          tabs,
          activeTabId,
          bookmarks,
          history: history.slice(0, 200),
          formDataEntries,
          savedPasswords,
          fingerprintProfiles,
          activeFingerprintId,
          webrtcConfig,
          fingerprintSpoofConfig,
          uaSwitcherConfig,
          protectionLogs: protectionLogs.slice(0, 200),
          cacheMetrics,
        })
      );
    } catch {
      // ignore quota errors
    }
  }, [
    tabs,
    activeTabId,
    bookmarks,
    history,
    formDataEntries,
    savedPasswords,
    fingerprintProfiles,
    activeFingerprintId,
    webrtcConfig,
    fingerprintSpoofConfig,
    uaSwitcherConfig,
    protectionLogs,
    cacheMetrics,
  ]);

  // 1-second tick for Multi-Tab Auto Refresh Plus & Download Manager progress
  useEffect(() => {
    const timer = setInterval(() => {
      setTabs((prevTabs) => {
        let anyChanged = false;
        const nextTabs = prevTabs.map((t) => {
          if (t.autoRefresh.status !== 'running') return t;
          anyChanged = true;
          const nextRemaining = t.autoRefresh.remainingSeconds - 1;
          if (nextRemaining <= 0) {
            return {
              ...t,
              lastLoadedAt: new Date().toLocaleTimeString(),
              reloadCounter: t.reloadCounter + 1,
              autoRefresh: {
                ...t.autoRefresh,
                remainingSeconds: t.autoRefresh.intervalSeconds,
                refreshCount: t.autoRefresh.refreshCount + 1,
                lastRefreshedAt: new Date().toLocaleTimeString(),
              },
            };
          }
          return {
            ...t,
            autoRefresh: {
              ...t.autoRefresh,
              remainingSeconds: nextRemaining,
            },
          };
        });
        return anyChanged ? nextTabs : prevTabs;
      });

      setDownloads((prevDls) => {
        let anyDlChanged = false;
        const nextDls = prevDls.map((dl) => {
          if (dl.status !== 'progressing') return dl;
          anyDlChanged = true;
          const stepBytes = Math.max(2_500_000, Math.round(dl.totalBytes * 0.22));
          const nextReceived = Math.min(dl.totalBytes, dl.receivedBytes + stepBytes);
          const isDone = nextReceived >= dl.totalBytes;
          return {
            ...dl,
            receivedBytes: nextReceived,
            status: isDone ? ('completed' as const) : ('progressing' as const),
            speedKbps: isDone ? 0 : 14800,
          };
        });
        return anyDlChanged ? nextDls : prevDls;
      });

      setUaSwitcherConfig((prevUa) => {
        if (!prevUa.enabledGlobally || !prevUa.autoRotateEnabled || prevUa.paused) {
          return prevUa;
        }
        return tickAutoRotateUASwitcher(prevUa).nextConfig;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activeFingerprintProfile =
    fingerprintProfiles.find((p) => p.id === activeFingerprintId) ||
    fingerprintProfiles[0];

  const privacySummary = computePrivacyStatusSummary(
    webrtcConfig,
    activeFingerprintProfile,
    activeTab.userAgentPresetId
  );

  // Tab & Navigation Handlers
  const handleCreateTab = (initialUrl = 'viju://home') => {
    const newId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTab = createTabState(newId, initialUrl, activeFingerprintId);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setHistory((prev) => [
      {
        id: `hist-${Date.now()}`,
        title: newTab.title,
        url: newTab.url,
        visitedAt: new Date().toLocaleTimeString(),
        timestampMs: Date.now(),
        tabId: newId,
      },
      ...prev,
    ]);
  };

  const handleCloseTab = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (!target) return;

    setClosedTabs((prev) => [
      {
        tab: {
          ...target,
          autoRefresh: { ...target.autoRefresh, status: 'stopped' },
        },
        closedAt: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);

    if (tabs.length === 1) {
      const replacement = createTabState('tab-1', 'viju://home', activeFingerprintId);
      setTabs([replacement]);
      setActiveTabId(replacement.id);
      return;
    }

    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  const handleRestoreClosedTab = () => {
    if (closedTabs.length === 0) return;
    const [mostRecent, ...rest] = closedTabs;
    setClosedTabs(rest);
    const restoredId = `tab-restored-${Date.now()}`;
    const restoredTab: TabItem = {
      ...mostRecent.tab,
      id: restoredId,
      lastLoadedAt: new Date().toLocaleTimeString(),
    };
    setTabs((prev) => [...prev, restoredTab]);
    setActiveTabId(restoredId);
    showToast(`Restored closed tab: ${restoredTab.title}`);
  };

  const handleNavigate = (rawInput: string) => {
    const baseUpdatedTab = navigateTabState(activeTab, rawInput);
    const resolvedUa = resolveEffectiveUserAgentForUrl(
      baseUpdatedTab.url,
      uaSwitcherConfig
    );
    const updatedTab: TabItem = {
      ...baseUpdatedTab,
      effectiveUserAgent: resolvedUa.effectiveProfile.userAgent,
    };
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? updatedTab : t)));
    const nowMs = Date.now();
    setHistory((prev) => [
      {
        id: `hist-${nowMs}`,
        title: updatedTab.title,
        url: updatedTab.url,
        visitedAt: new Date().toLocaleTimeString(),
        timestampMs: nowMs,
        tabId: activeTab.id,
      },
      ...prev,
    ]);
    // If navigating via search query, also record in Form Data autofill history
    if (updatedTab.url.includes('google.com/search')) {
      setFormDataEntries((prev) => [
        {
          id: `form-${nowMs}`,
          fieldName: 'address_bar_search',
          value: rawInput.trim(),
          origin: 'https://www.google.com',
          savedAt: new Date().toLocaleTimeString(),
          timestampMs: nowMs,
        },
        ...prev,
      ]);
    }
    setCacheMetrics((prev) => ({
      ...prev,
      cacheMB: fingerprintSpoofConfig.controls.noCache
        ? prev.cacheMB
        : Number((prev.cacheMB + 0.6).toFixed(1)),
    }));
    const navLogs = createProtectionLogEntriesForEvent(
      'page_navigation',
      fingerprintSpoofConfig,
      activeFingerprintProfile,
      webrtcConfig,
      updatedTab.url,
      activeTab.id
    );
    if (navLogs.length > 0) {
      setProtectionLogs((prev) => [...navLogs, ...prev].slice(0, 200));
    }
  };

  const handleBack = () => {
    const updated = goBackTabState(activeTab);
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? updated : t)));
  };

  const handleForward = () => {
    const updated = goForwardTabState(activeTab);
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? updated : t)));
  };

  const handleReload = () => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              lastLoadedAt: new Date().toLocaleTimeString(),
              reloadCounter: t.reloadCounter + 1,
            }
          : t
      )
    );
    showToast(`Reloaded tab: ${activeTab.title}`);
  };

  const handleToggleBookmark = () => {
    const exists = bookmarks.some((b) => b.url === activeTab.url);
    if (exists) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url));
      showToast('Removed page from Bookmarks.');
    } else {
      setBookmarks((prev) => [
        {
          id: `bm-${Date.now()}`,
          title: activeTab.title.slice(0, 42),
          url: activeTab.url,
          category: 'Saved',
          createdAt: new Date().toISOString().slice(0, 10),
        },
        ...prev,
      ]);
      showToast('Added page to Bookmarks bar.');
    }
  };

  const handleAutoRefreshCommand = (
    tabId: string,
    command: 'start' | 'pause' | 'resume' | 'stop',
    intervalSeconds?: number
  ) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== tabId) return t;
        if (command === 'start') {
          const check = validateAutoRefreshInterval(
            intervalSeconds ?? t.autoRefresh.intervalSeconds
          );
          const safeSec = check.sanitizedSeconds;
          return {
            ...t,
            autoRefresh: {
              ...t.autoRefresh,
              intervalSeconds: safeSec,
              remainingSeconds: safeSec,
              status: 'running',
            },
          };
        }
        if (command === 'pause') {
          return {
            ...t,
            autoRefresh: {
              ...t.autoRefresh,
              status: 'paused',
            },
          };
        }
        if (command === 'resume') {
          return {
            ...t,
            autoRefresh: {
              ...t.autoRefresh,
              status: 'running',
            },
          };
        }
        return {
          ...t,
          autoRefresh: {
            ...t.autoRefresh,
            status: 'stopped',
            remainingSeconds: t.autoRefresh.intervalSeconds,
          },
        };
      })
    );
  };

  const handleApplyUserAgent = (presetId: UserAgentPresetId, customString?: string) => {
    const updated = applyUserAgentToTab(activeTab, presetId, customString);
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? updated : t)));
    showToast('Updated User-Agent for active tab and reloaded page.');
  };

  const handleGetNewAgent = (
    preferredBrowser?: UABrowserFamily,
    preferredOs?: UAOsFamily
  ) => {
    setUaSwitcherConfig((prev) => {
      const nextBase: RandomUASwitcherConfig = {
        ...prev,
        selectedBrowserFamily: preferredBrowser || prev.selectedBrowserFamily,
        selectedOsFamily: preferredOs || prev.selectedOsFamily,
      };
      const result = generateNextUserAgentProfile(nextBase, {
        preferredBrowser,
        preferredOs,
      });
      if (!result.ok || !result.profile) {
        setUaErrorBanner(
          result.error ||
            'No User-Agent generator profiles are enabled. Enable at least one Browser/OS combination.'
        );
        setUaStatusBanner(null);
        return nextBase;
      }
      setUaErrorBanner(null);
      setUaStatusBanner(
        `Generated new User-Agent (${result.profile.label}) and applied to active session.`
      );
      showToast(`Generated new User-Agent: ${result.profile.label}`);
      return {
        ...nextBase,
        activeGeneratedProfile: result.profile,
        selectedBrowserFamily: result.profile.browserFamily,
        selectedOsFamily: result.profile.osFamily,
        rotationCount: nextBase.rotationCount + 1,
        remainingSeconds: nextBase.autoRotateIntervalSeconds,
        lastRotatedAt: new Date().toLocaleTimeString(),
      };
    });
  };

  const handleTogglePauseUASwitcher = () => {
    setUaSwitcherConfig((prev) => {
      const nextPaused = !prev.paused;
      setUaErrorBanner(null);
      setUaStatusBanner(
        nextPaused
          ? 'Paused User-Agent Switcher automatic rotation.'
          : 'Resumed User-Agent Switcher rotation.'
      );
      showToast(
        nextPaused
          ? 'Paused User-Agent Switcher.'
          : 'Resumed User-Agent Switcher.'
      );
      return {
        ...prev,
        paused: nextPaused,
      };
    });
  };

  const handleToggleCurrentDomainUA = (url: string) => {
    setUaSwitcherConfig((prev) => {
      const toggled = toggleDomainInUABlacklist(url, prev.blacklistDomains);
      setUaErrorBanner(null);
      setUaStatusBanner(
        !toggled.isSwitchingEnabledOnDomain
          ? `Disabled User-Agent switching on ${toggled.hostname} (added to Blacklist).`
          : `Enabled User-Agent switching on ${toggled.hostname} (removed from Blacklist).`
      );
      showToast(
        !toggled.isSwitchingEnabledOnDomain
          ? `Disabled UA switching on ${toggled.hostname}`
          : `Enabled UA switching on ${toggled.hostname}`
      );
      return {
        ...prev,
        blacklistDomains: toggled.nextBlacklist,
      };
    });
  };

  const handleUpdateUASwitcherConfig = (
    updater: (prev: RandomUASwitcherConfig) => RandomUASwitcherConfig
  ) => {
    setUaErrorBanner(null);
    setUaSwitcherConfig((prev) => updater(prev));
  };

  const handleResetUADefaults = () => {
    const def = createDefaultRandomUASwitcherConfig(false);
    setUaSwitcherConfig(def);
    setUaErrorBanner(null);
    setUaStatusBanner(
      'Reset Random User-Agent Switcher to defaults (9 desktop combinations enabled, 5 mobile/Linux disabled).'
    );
    showToast('Reset Random User-Agent Switcher settings to defaults.');
  };

  const handleCreateOrUpdateFingerprintProfile = (
    profile: FingerprintProfile,
    webglVendor?: string,
    webglRenderer?: string
  ) => {
    setFingerprintProfiles((prev) => {
      const exists = prev.some((p) => p.id === profile.id);
      if (exists) {
        return prev.map((p) => (p.id === profile.id ? profile : p));
      }
      return [...prev, profile];
    });
    setActiveFingerprintId(profile.id);
    if (webglVendor || webglRenderer) {
      setFingerprintSpoofConfig((prev) => ({
        ...prev,
        webglVendor: webglVendor || prev.webglVendor,
        webglRenderer: webglRenderer || prev.webglRenderer,
      }));
    }
    const newLogs = createProtectionLogEntriesForEvent(
      'profile_change',
      fingerprintSpoofConfig,
      profile,
      webrtcConfig,
      activeTab.url,
      activeTab.id,
      `Applied coherent profile "${profile.name}" (${profile.screenWidth}×${profile.screenHeight}, ${profile.timezone})`
    );
    if (newLogs.length > 0) {
      setProtectionLogs((prev) => [...newLogs, ...prev].slice(0, 200));
    }
    handleReload();
  };

  const handleToggleFingerprintControl = (control: FingerprintControlKey) => {
    setFingerprintSpoofConfig((prev) => {
      const nextVal = !prev.controls[control];
      const nextControls = {
        ...prev.controls,
        [control]: nextVal,
      };
      const allOn = ALL_FINGERPRINT_CONTROL_KEYS.every((k) => nextControls[k]);
      const allOff = ALL_FINGERPRINT_CONTROL_KEYS.every((k) => !nextControls[k]);
      const nextConfig: FingerprintSpoofConfig = {
        ...prev,
        mode: allOn ? 'maximum_default' : allOff ? 'disabled' : 'custom',
        controls: nextControls,
      };
      if (nextControls.logs) {
        const logEntries = createProtectionLogEntriesForEvent(
          'control_toggle',
          nextConfig,
          activeFingerprintProfile,
          webrtcConfig,
          activeTab.url,
          activeTab.id,
          `Toggled control "${control}" -> ${nextVal ? 'ENABLED' : 'DISABLED'}`
        );
        setProtectionLogs((old) => [...logEntries, ...old].slice(0, 200));
      }
      return nextConfig;
    });
  };

  const handleFingerprintBulkAction = (
    action: 'enable_all' | 'disable_all' | 'reset_defaults' | 'strict_protection'
  ) => {
    if (action === 'enable_all') {
      const next = enableAllFingerprintControls(fingerprintSpoofConfig);
      setFingerprintSpoofConfig(next);
      const entries = createProtectionLogEntriesForEvent(
        'bulk_action',
        next,
        activeFingerprintProfile,
        webrtcConfig,
        activeTab.url,
        activeTab.id,
        'Enabled all 12 Fingerprint Spoofing controls'
      );
      setProtectionLogs((prev) => [...entries, ...prev].slice(0, 200));
      showToast('Enabled all 12 Fingerprint Spoofing controls.');
      return;
    }

    if (action === 'disable_all') {
      const next = disableAllFingerprintControls(fingerprintSpoofConfig);
      setFingerprintSpoofConfig(next);
      showToast('Disabled all 12 Fingerprint Spoofing controls.');
      return;
    }

    if (action === 'reset_defaults') {
      const next = resetDefaultFingerprintSpoofConfig();
      setFingerprintSpoofConfig(next);
      setActiveFingerprintId(DEFAULT_FINGERPRINT_PROFILES[0].id);
      setWebrtcConfig({
        enabled: true,
        policy: 'default_public_interface_only',
      });
      const entries = createProtectionLogEntriesForEvent(
        'bulk_action',
        next,
        DEFAULT_FINGERPRINT_PROFILES[0],
        { enabled: true, policy: 'default_public_interface_only' },
        activeTab.url,
        activeTab.id,
        'Reset all 12 Fingerprint Spoofing controls and profile seed to defaults'
      );
      setProtectionLogs((prev) => [...entries, ...prev].slice(0, 200));
      showToast('Reset Fingerprint Spoofing controls to defaults (12/12 enabled).');
      return;
    }

    if (action === 'strict_protection') {
      const { spoofConfig: strictCfg, webrtcConfig: strictWebrtc } =
        applyStrictProtectionPreset(fingerprintSpoofConfig);
      setFingerprintSpoofConfig(strictCfg);
      setWebrtcConfig(strictWebrtc);
      const entries = createProtectionLogEntriesForEvent(
        'bulk_action',
        strictCfg,
        activeFingerprintProfile,
        strictWebrtc,
        activeTab.url,
        activeTab.id,
        `Activated Strict Protection Mode (Seed ${formatSeedHex(
          strictCfg.profileSeed
        )}, WebRTC disabled, non-proxied UDP blocked)`
      );
      setProtectionLogs((prev) => [...entries, ...prev].slice(0, 200));
      showToast('Activated Strict Protection Lockdown across all 12 surfaces.');
    }
  };

  const handleGenerateCoherentRandomProfile = () => {
    const generated = generateCoherentRandomProfile();
    setFingerprintProfiles((prev) => [
      generated.profile,
      ...prev.filter((p) => !p.id.startsWith('fp_seeded_')),
    ]);
    setActiveFingerprintId(generated.profile.id);
    const nextCfg: FingerprintSpoofConfig = {
      ...fingerprintSpoofConfig,
      profileSeed: generated.profileSeed,
      webglVendor: generated.webglVendor,
      webglRenderer: generated.webglRenderer,
      clientRectsDeltaPx: generated.clientRectsDeltaPx,
    };
    setFingerprintSpoofConfig(nextCfg);
    const entries = createProtectionLogEntriesForEvent(
      'seed_rotated',
      nextCfg,
      generated.profile,
      webrtcConfig,
      activeTab.url,
      activeTab.id,
      `Rotated stable profile seed to ${formatSeedHex(
        generated.profileSeed
      )} and synchronized ${generated.profile.name} across ${tabs.length} tabs`
    );
    setProtectionLogs((prev) => [...entries, ...prev].slice(0, 200));
    showToast(
      `Rotated stable identity seed (${formatSeedHex(
        generated.profileSeed
      )}) across all open tabs.`
    );
  };

  const handleAddWhitelistRule = (
    ruleInput: Omit<WhitelistSiteRule, 'id' | 'addedAt'>
  ) => {
    const newRule: WhitelistSiteRule = {
      ...ruleInput,
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      addedAt: new Date().toISOString().slice(0, 10),
    };
    setFingerprintSpoofConfig((prev) => ({
      ...prev,
      whitelistRules: [newRule, ...prev.whitelistRules],
    }));
    showToast(`Added whitelist site exception for ${newRule.domain}`);
  };

  const handleToggleWhitelistRule = (ruleId: string) => {
    setFingerprintSpoofConfig((prev) => ({
      ...prev,
      whitelistRules: prev.whitelistRules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  };

  const handleDeleteWhitelistRule = (ruleId: string) => {
    setFingerprintSpoofConfig((prev) => ({
      ...prev,
      whitelistRules: prev.whitelistRules.filter((r) => r.id !== ruleId),
    }));
    showToast('Removed site exception from Whitelist.');
  };

  const handleSimulateFingerprintProbe = () => {
    const entries = createProtectionLogEntriesForEvent(
      'probe_simulation',
      fingerprintSpoofConfig,
      activeFingerprintProfile,
      webrtcConfig,
      activeTab.url,
      activeTab.id
    );
    setProtectionLogs((prev) => [...entries, ...prev].slice(0, 200));
    showToast(
      `Executed 12-surface fingerprint probe on ${activeTab.url} (${entries.length} audit events logged).`
    );
  };

  const handleClearProtectionLogs = () => {
    setProtectionLogs([]);
    showToast('Cleared local fingerprint protection audit logs.');
  };

  const handleAddSampleFormEntry = () => {
    const nowMs = Date.now();
    const newEntry: FormAutofillEntry = {
      id: `form-${nowMs}`,
      fieldName: `input_field_${formDataEntries.length + 1}`,
      value: `sample_autofill_${Math.floor(Math.random() * 900 + 100)}`,
      origin: activeTab.url,
      savedAt: 'Just now',
      timestampMs: nowMs,
    };
    setFormDataEntries((prev) => [newEntry, ...prev]);
    showToast('Saved new Form Data autofill entry.');
  };

  const handleClearBrowserData = (payload: ClearBrowsingDataPayload) => {
    const { timeRange, webData, browserData } = payload;
    const rangeLabel =
      CLEAR_TIME_RANGES.find((r) => r.id === timeRange)?.label || 'Everything';

    const mappedWeb = mapWebDataToElectronStorages(webData);
    const details: string[] = [];
    const nowMs = Date.now();

    // 1. Clear selected Web Data categories
    if (mappedWeb.selectedLabels.length > 0) {
      details.push(`Web Data cleared: ${mappedWeb.selectedLabels.join(', ')}`);
    }
    if (mappedWeb.gracefullyHandledLegacyTypes.length > 0) {
      details.push(
        `Legacy Chromium types handled gracefully: ${mappedWeb.gracefullyHandledLegacyTypes.join(
          ', '
        )}`
      );
    }

    setCacheMetrics((prev) => ({
      appCacheKB: webData.appCache ? 0 : prev.appCacheKB,
      cacheMB: webData.cache ? 0.0 : prev.cacheMB,
      cacheStorageMB: webData.cacheStorage ? 0.0 : prev.cacheStorageMB,
      cookiesCount: webData.cookies ? 0 : prev.cookiesCount,
      fileSystemsKB: webData.fileSystems ? 0 : prev.fileSystemsKB,
      indexedDBKB: webData.indexedDB ? 0 : prev.indexedDBKB,
      localStorageKB: webData.localStorage ? 0 : prev.localStorageKB,
      serviceWorkersCount: webData.serviceWorkers ? 0 : prev.serviceWorkersCount,
      webSQLKB: webData.webSQL ? 0 : prev.webSQLKB,
      lastClearedAt: new Date().toLocaleTimeString(),
    }));

    // 2. Clear selected Browser Data categories within the selected time range
    if (browserData.downloads) {
      const filtered = filterRecordsByClearTimeRange(downloads, timeRange, nowMs);
      setDownloads(filtered.remaining);
      details.push(`Downloads cleared: ${filtered.removedCount} items (${rangeLabel})`);
    }

    if (browserData.formData) {
      const filtered = filterRecordsByClearTimeRange(formDataEntries, timeRange, nowMs);
      setFormDataEntries(filtered.remaining);
      details.push(
        `Form Data autofill cleared: ${filtered.removedCount} entries (${rangeLabel})`
      );
    }

    if (browserData.history) {
      const filtered = filterRecordsByClearTimeRange(history, timeRange, nowMs);
      setHistory(filtered.remaining);
      if (timeRange === 'everything') {
        setTabs((prev) =>
          prev.map((t) => ({
            ...t,
            historyStack: [t.url],
            historyIndex: 0,
          }))
        );
      }
      details.push(`Browsing History cleared: ${filtered.removedCount} visits (${rangeLabel})`);
    }

    if (browserData.passwords) {
      const filtered = filterRecordsByClearTimeRange(savedPasswords, timeRange, nowMs);
      setSavedPasswords(filtered.remaining);
      details.push(`Passwords cleared: ${filtered.removedCount} credentials (${rangeLabel})`);
    }

    if (details.length === 0) {
      return {
        success: false,
        message: 'No data categories were selected to clear.',
        details: [],
      };
    }

    const summaryMsg = `Successfully cleared selected browsing data (${rangeLabel}) at ${new Date().toLocaleTimeString()}.`;
    showToast(summaryMsg);
    return {
      success: true,
      message: summaryMsg,
      details,
    };
  };

  const handleTriggerDownload = (filename: string, url: string, sizeBytes: number) => {
    const nowMs = Date.now();
    const newDl: DownloadItem = {
      id: `dl-${nowMs}`,
      filename,
      url,
      totalBytes: sizeBytes,
      receivedBytes: Math.round(sizeBytes * 0.15),
      status: 'progressing',
      startedAt: new Date().toLocaleTimeString(),
      timestampMs: nowMs,
      speedKbps: 14800,
    };
    setDownloads((prev) => [newDl, ...prev]);
    setActivePanel('downloads');
    showToast(`Started downloading ${filename}`);
  };

  const handleDownloadAction = (
    downloadId: string,
    action: 'pause' | 'resume' | 'cancel' | 'remove'
  ) => {
    if (action === 'remove') {
      setDownloads((prev) => prev.filter((d) => d.id !== downloadId));
      return;
    }
    setDownloads((prev) =>
      prev.map((d) => {
        if (d.id !== downloadId) return d;
        if (action === 'pause') return { ...d, status: 'paused', speedKbps: 0 };
        if (action === 'resume') return { ...d, status: 'progressing', speedKbps: 14800 };
        return { ...d, status: 'cancelled', speedKbps: 0 };
      })
    );
  };

  const handleTogglePanel = (panel: ActiveSidePanel) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F19] text-slate-100 overflow-hidden">
      {/* Top Tab Strip & Window Caption */}
      <TabStrip
        tabs={tabs}
        activeTabId={activeTab.id}
        closedTabsCount={closedTabs.length}
        webrtcConfig={webrtcConfig}
        privacyStatusLabel={privacySummary.statusLabel}
        privacyStatusLevel={privacySummary.statusLevel}
        activePanel={activePanel}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onCreateTab={handleCreateTab}
        onRestoreClosedTab={handleRestoreClosedTab}
        onTogglePanel={handleTogglePanel}
        onNavigate={handleNavigate}
      />

      {/* Browser Address Bar, Navigation Controls, Feature Buttons & Bookmarks Bar */}
      <NavigationToolbar
        activeTab={activeTab}
        allTabs={tabs}
        bookmarks={bookmarks}
        downloads={downloads}
        activeFingerprintProfile={activeFingerprintProfile}
        webrtcConfig={webrtcConfig}
        uaSwitcherConfig={uaSwitcherConfig}
        activePanel={activePanel}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onHome={() => handleNavigate('viju://home')}
        onToggleBookmark={handleToggleBookmark}
        onTogglePanel={handleTogglePanel}
      />

      {/* Main Split Workspace: Active Tab Viewport + Built-in Control Panel Drawer */}
      <div className="flex-1 flex min-h-0 relative">
        <BrowserViewport
          activeTab={activeTab}
          allTabs={tabs}
          fingerprintProfiles={fingerprintProfiles}
          activeFingerprintProfile={activeFingerprintProfile}
          webrtcConfig={webrtcConfig}
          fingerprintSpoofConfig={fingerprintSpoofConfig}
          uaSwitcherConfig={uaSwitcherConfig}
          uaErrorBanner={uaErrorBanner}
          uaStatusBanner={uaStatusBanner}
          protectionLogs={protectionLogs}
          cacheMetrics={cacheMetrics}
          history={history}
          downloads={downloads}
          formDataEntries={formDataEntries}
          savedPasswords={savedPasswords}
          onNavigate={handleNavigate}
          onOpenPanel={setActivePanel}
          onApplyUserAgent={handleApplyUserAgent}
          onGetNewAgent={handleGetNewAgent}
          onTogglePauseUASwitcher={handleTogglePauseUASwitcher}
          onToggleCurrentDomainUA={handleToggleCurrentDomainUA}
          onUpdateUASwitcherConfig={handleUpdateUASwitcherConfig}
          onResetUADefaults={handleResetUADefaults}
          onSelectFingerprintProfile={(id) => {
            setActiveFingerprintId(id);
            handleReload();
          }}
          onCreateOrUpdateFingerprintProfile={handleCreateOrUpdateFingerprintProfile}
          onToggleFingerprintControl={handleToggleFingerprintControl}
          onFingerprintBulkAction={handleFingerprintBulkAction}
          onGenerateCoherentRandomProfile={handleGenerateCoherentRandomProfile}
          onAddWhitelistRule={handleAddWhitelistRule}
          onToggleWhitelistRule={handleToggleWhitelistRule}
          onDeleteWhitelistRule={handleDeleteWhitelistRule}
          onSimulateFingerprintProbe={handleSimulateFingerprintProbe}
          onClearProtectionLogs={handleClearProtectionLogs}
          onUpdateWebRTC={(cfg) => {
            setWebrtcConfig(cfg);
            handleReload();
          }}
          onAutoRefreshCommand={handleAutoRefreshCommand}
          onClearBrowserData={handleClearBrowserData}
          onAddSampleFormEntry={handleAddSampleFormEntry}
          onTriggerDownload={handleTriggerDownload}
        />

        <SidePanelDrawer
          activePanel={activePanel}
          activeTab={activeTab}
          allTabs={tabs}
          fingerprintProfiles={fingerprintProfiles}
          activeFingerprintProfile={activeFingerprintProfile}
          webrtcConfig={webrtcConfig}
          fingerprintSpoofConfig={fingerprintSpoofConfig}
          uaSwitcherConfig={uaSwitcherConfig}
          uaErrorBanner={uaErrorBanner}
          uaStatusBanner={uaStatusBanner}
          protectionLogs={protectionLogs}
          cacheMetrics={cacheMetrics}
          downloads={downloads}
          bookmarks={bookmarks}
          history={history}
          formDataEntries={formDataEntries}
          savedPasswords={savedPasswords}
          onClose={() => setActivePanel('none')}
          onAutoRefreshCommand={handleAutoRefreshCommand}
          onApplyUserAgent={handleApplyUserAgent}
          onGetNewAgent={handleGetNewAgent}
          onTogglePauseUASwitcher={handleTogglePauseUASwitcher}
          onToggleCurrentDomainUA={handleToggleCurrentDomainUA}
          onUpdateUASwitcherConfig={handleUpdateUASwitcherConfig}
          onResetUADefaults={handleResetUADefaults}
          onSelectFingerprintProfile={(id) => {
            setActiveFingerprintId(id);
            handleReload();
          }}
          onCreateOrUpdateFingerprintProfile={handleCreateOrUpdateFingerprintProfile}
          onToggleFingerprintControl={handleToggleFingerprintControl}
          onFingerprintBulkAction={handleFingerprintBulkAction}
          onGenerateCoherentRandomProfile={handleGenerateCoherentRandomProfile}
          onAddWhitelistRule={handleAddWhitelistRule}
          onToggleWhitelistRule={handleToggleWhitelistRule}
          onDeleteWhitelistRule={handleDeleteWhitelistRule}
          onSimulateFingerprintProbe={handleSimulateFingerprintProbe}
          onClearProtectionLogs={handleClearProtectionLogs}
          onUpdateWebRTC={(cfg) => {
            setWebrtcConfig(cfg);
            handleReload();
          }}
          onClearBrowserData={handleClearBrowserData}
          onAddSampleFormEntry={handleAddSampleFormEntry}
          onTriggerDownload={handleTriggerDownload}
          onDownloadAction={handleDownloadAction}
          onClearCompletedDownloads={() =>
            setDownloads((prev) => prev.filter((d) => d.status !== 'completed'))
          }
          onNavigate={handleNavigate}
          onDeleteBookmark={(id) =>
            setBookmarks((prev) => prev.filter((b) => b.id !== id))
          }
          onDeleteHistoryItem={(id) =>
            setHistory((prev) => prev.filter((h) => h.id !== id))
          }
          onClearAllHistory={() => setHistory([])}
        />

        {/* Floating Action Feedback Toast */}
        {toastBanner && (
          <div
            role="status"
            className="fixed bottom-4 left-4 z-50 px-4 py-2.5 rounded-lg bg-slate-900/95 border border-blue-500/50 text-xs font-medium text-slate-100 shadow-lg"
          >
            {toastBanner}
          </div>
        )}
      </div>
    </div>
  );
}
