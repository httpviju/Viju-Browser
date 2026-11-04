'use strict';

let currentState = null;
let currentPanel = null;

const tabsContainer = document.getElementById('tabs-container');
const addressForm = document.getElementById('address-form');
const addressInput = document.getElementById('address-input');
const bookmarksBar = document.getElementById('bookmarks-bar');
const sidePanel = document.getElementById('side-panel');
const sidePanelTitle = document.getElementById('side-panel-title');
const sidePanelBody = document.getElementById('side-panel-body');
const privacyPill = document.getElementById('privacy-status-pill');

function getActiveTab() {
  if (!currentState || !currentState.tabs) return null;
  return currentState.tabs.find((t) => t.id === currentState.activeTabId) || null;
}

function renderChrome(state) {
  currentState = state;
  const activeTab = getActiveTab();

  tabsContainer.innerHTML = '';
  state.tabs.forEach((tab) => {
    const el = document.createElement('div');
    el.className = 'tab-item' + (tab.id === state.activeTabId ? ' active' : '');
    const titleSpan = document.createElement('span');
    const timerBadge = tab.autoRefresh.status === 'running'
      ? ` [${tab.autoRefresh.remainingSeconds}s]`
      : '';
    titleSpan.textContent = (tab.title || 'New Tab').slice(0, 22) + timerBadge;
    el.appendChild(titleSpan);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    closeBtn.textContent = '×';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      window.vijuAPI.closeTab(tab.id);
    };
    el.appendChild(closeBtn);
    el.onclick = () => window.vijuAPI.switchTab(tab.id);
    tabsContainer.appendChild(el);
  });

  if (activeTab && document.activeElement !== addressInput) {
    addressInput.value = activeTab.url;
  }

  if (!state.webrtc.enabled) {
    privacyPill.textContent = 'WebRTC: Disabled';
  } else if (state.webrtc.policy === 'disable_non_proxied_udp') {
    privacyPill.textContent = 'WebRTC Shield: Non-Proxied UDP Blocked';
  } else if (state.webrtc.policy === 'default_public_interface_only') {
    privacyPill.textContent = 'WebRTC Shield: Public Interface Only';
  } else {
    privacyPill.textContent = 'WebRTC: Standard';
  }

  bookmarksBar.innerHTML = '';
  (state.bookmarks || []).forEach((bm) => {
    const btn = document.createElement('button');
    btn.className = 'text-btn';
    btn.textContent = bm.title;
    btn.onclick = () => window.vijuAPI.navigate(bm.url);
    bookmarksBar.appendChild(btn);
  });

  if (currentPanel && currentPanel !== 'clear-cache') {
    renderSidePanel(currentPanel);
  }
}

function openSidePanel(panelName) {
  currentPanel = panelName;
  sidePanel.classList.remove('hidden');
  window.vijuAPI.setSidePanelOpen(true);
  renderSidePanel(panelName);
}

function closeSidePanel() {
  currentPanel = null;
  sidePanel.classList.add('hidden');
  window.vijuAPI.setSidePanelOpen(false);
}

function renderSidePanel(panelName) {
  if (!currentState) return;
  const activeTab = getActiveTab();
  sidePanelBody.innerHTML = '';

  if (panelName === 'auto-refresh' && activeTab) {
    sidePanelTitle.textContent = 'Auto Refresh Plus';
    const info = document.createElement('p');
    info.textContent = `Tab Status: ${activeTab.autoRefresh.status.toUpperCase()} | Remaining: ${activeTab.autoRefresh.remainingSeconds}s | Count: ${activeTab.autoRefresh.refreshCount}`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '5';
    input.value = String(activeTab.autoRefresh.intervalSeconds || 15);
    input.className = 'tool-btn';

    const startBtn = document.createElement('button');
    startBtn.className = 'tool-btn';
    startBtn.textContent = 'Start (Min 5s)';
    startBtn.onclick = () => {
      window.vijuAPI.controlAutoRefresh({
        tabId: activeTab.id,
        command: 'start',
        intervalSeconds: Number(input.value)
      }).catch((err) => alert(err.message));
    };

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'tool-btn';
    pauseBtn.textContent = activeTab.autoRefresh.status === 'paused' ? 'Resume' : 'Pause';
    pauseBtn.onclick = () => {
      window.vijuAPI.controlAutoRefresh({
        tabId: activeTab.id,
        command: activeTab.autoRefresh.status === 'paused' ? 'resume' : 'pause'
      });
    };

    const stopBtn = document.createElement('button');
    stopBtn.className = 'tool-btn';
    stopBtn.textContent = 'Stop';
    stopBtn.onclick = () => {
      window.vijuAPI.controlAutoRefresh({ tabId: activeTab.id, command: 'stop' });
    };

    sidePanelBody.append(info, input, startBtn, pauseBtn, stopBtn);
  } else if (panelName === 'user-agent') {
    sidePanelTitle.textContent = 'User-Agent Switcher';
    const notice = document.createElement('p');
    notice.textContent = 'Notice: Switching User-Agent changes HTTP headers and navigator.userAgent for the active tab, but does not change your real device hardware or IP address.';
    sidePanelBody.appendChild(notice);

    [
      ['default_desktop_chrome', 'Desktop Chrome (Windows 11)'],
      ['android_chrome', 'Android Chrome (Mobile)'],
      ['iphone_safari', 'iPhone Safari (iOS)']
    ].forEach(([preset, label]) => {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.textContent = 'Apply ' + label;
      btn.onclick = () => window.vijuAPI.setUserAgent({ preset });
      sidePanelBody.appendChild(btn);
    });
  } else if (panelName === 'webrtc') {
    sidePanelTitle.textContent = 'WebRTC Control & Shield';
    const warn = document.createElement('p');
    warn.textContent = 'Warning: Disabling WebRTC or blocking non-proxied UDP may break browser-based video calls and conferencing tools. Does not guarantee complete IP anonymity.';
    sidePanelBody.appendChild(warn);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'tool-btn';
    toggleBtn.textContent = currentState.webrtc.enabled ? 'Disable WebRTC' : 'Enable WebRTC';
    toggleBtn.onclick = () => {
      window.vijuAPI.setWebRTCConfig({
        enabled: !currentState.webrtc.enabled,
        policy: currentState.webrtc.policy
      });
    };
    sidePanelBody.appendChild(toggleBtn);
  } else if (panelName === 'clear-cache') {
    sidePanelTitle.textContent = 'Clear Browsing Data';

    // Time Range Selector
    const rangeLabel = document.createElement('label');
    rangeLabel.textContent = 'Time Range:';
    const rangeSelect = document.createElement('select');
    rangeSelect.className = 'tool-btn';
    [
      ['last_15_min', 'Last 15 Minutes'],
      ['last_hour', 'Last Hour'],
      ['last_day', 'Last Day'],
      ['last_week', 'Last Week'],
      ['last_month', 'Last Month'],
      ['everything', 'Everything']
    ].forEach(([val, text]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      if (val === 'everything') opt.selected = true;
      rangeSelect.appendChild(opt);
    });
    sidePanelBody.append(rangeLabel, rangeSelect);

    // Web Data Checkboxes (all checked by default)
    const webHeader = document.createElement('h4');
    webHeader.textContent = 'Web Data';
    sidePanelBody.appendChild(webHeader);

    const webCheckboxes = {};
    [
      ['appCache', 'App Cache'],
      ['cache', 'Cache'],
      ['cacheStorage', 'Cache Storage'],
      ['cookies', 'Cookies'],
      ['fileSystems', 'File Systems'],
      ['indexedDB', 'IndexedDB'],
      ['localStorage', 'Local Storage'],
      ['serviceWorkers', 'Service Workers'],
      ['webSQL', 'WebSQL']
    ].forEach(([key, label]) => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.gap = '8px';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      webCheckboxes[key] = cb;
      row.append(cb, document.createTextNode(label));
      sidePanelBody.appendChild(row);
    });

    // Browser Data Checkboxes (all checked by default)
    const browserHeader = document.createElement('h4');
    browserHeader.textContent = 'Browser Data';
    sidePanelBody.appendChild(browserHeader);

    const browserCheckboxes = {};
    [
      ['downloads', 'Downloads'],
      ['formData', 'Form Data'],
      ['history', 'History'],
      ['passwords', 'Passwords']
    ].forEach(([key, label]) => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.gap = '8px';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      browserCheckboxes[key] = cb;
      row.append(cb, document.createTextNode(label));
      sidePanelBody.appendChild(row);
    });

    const statusMsg = document.createElement('div');
    const clearBtn = document.createElement('button');
    clearBtn.className = 'tool-btn';
    clearBtn.textContent = 'Clear Data';
    clearBtn.onclick = async () => {
      const payload = {
        timeRange: rangeSelect.value,
        webData: Object.fromEntries(
          Object.entries(webCheckboxes).map(([k, el]) => [k, el.checked])
        ),
        browserData: Object.fromEntries(
          Object.entries(browserCheckboxes).map(([k, el]) => [k, el.checked])
        )
      };
      const res = await window.vijuAPI.clearBrowserData(payload);
      if (res && res.ok) {
        statusMsg.textContent = `Successfully cleared selected data (${res.timeRange}) at ${res.clearedAt}.`;
      }
    };
    sidePanelBody.append(clearBtn, statusMsg);
  } else if (panelName === 'fingerprint') {
    sidePanelTitle.textContent = 'Fingerprint Privacy Controls';
    const desc = document.createElement('p');
    desc.textContent = 'Modifies window.screen dimensions, navigator.hardwareConcurrency, deviceMemory, and Accept-Language. Does not guarantee complete anonymity or alter network-layer TLS/IP signals.';
    sidePanelBody.appendChild(desc);

    [
      { name: 'Windows 11 Standard (1920x1080)', screenWidth: 1920, screenHeight: 1080, colorDepth: 24, hardwareConcurrency: 8, deviceMemory: 8, language: 'en-US' },
      { name: 'Compact Laptop (1366x768)', screenWidth: 1366, screenHeight: 768, colorDepth: 24, hardwareConcurrency: 4, deviceMemory: 4, language: 'en-US' }
    ].forEach((prof) => {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.textContent = 'Apply ' + prof.name;
      btn.onclick = () => window.vijuAPI.setFingerprintProfile(prof);
      sidePanelBody.appendChild(btn);
    });
  } else if (panelName === 'downloads') {
    sidePanelTitle.textContent = 'Download Manager';
    (currentState.downloads || []).forEach((dl) => {
      const item = document.createElement('div');
      item.textContent = `${dl.filename} — ${dl.status} (${dl.receivedBytes}/${dl.totalBytes} bytes)`;
      sidePanelBody.appendChild(item);
    });
  }
}

document.getElementById('btn-new-tab').onclick = () => window.vijuAPI.createTab('https://www.google.com');
document.getElementById('btn-restore-tab').onclick = () => window.vijuAPI.restoreClosedTab();
document.getElementById('btn-back').onclick = () => window.vijuAPI.navControl('back');
document.getElementById('btn-forward').onclick = () => window.vijuAPI.navControl('forward');
document.getElementById('btn-reload').onclick = () => window.vijuAPI.navControl('reload');
document.getElementById('btn-home').onclick = () => window.vijuAPI.navControl('home');
document.getElementById('btn-close-panel').onclick = closeSidePanel;

document.getElementById('btn-bookmark').onclick = () => {
  const activeTab = getActiveTab();
  if (activeTab) {
    window.vijuAPI.toggleBookmark({ title: activeTab.title, url: activeTab.url });
  }
};

addressForm.onsubmit = (e) => {
  e.preventDefault();
  window.vijuAPI.navigate(addressInput.value);
};

document.querySelectorAll('.tool-btn[data-panel]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-panel');
    if (currentPanel === target) {
      closeSidePanel();
    } else {
      openSidePanel(target);
    }
  });
});

window.vijuAPI.onStateUpdated(renderChrome);
window.vijuAPI.getInitialState();
