'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vijuAPI', {
  getInitialState: () => ipcRenderer.invoke('viju:get-initial-state'),
  setSidePanelOpen: (isOpen) => ipcRenderer.invoke('viju:set-side-panel-open', Boolean(isOpen)),
  createTab: (url) => ipcRenderer.invoke('viju:tab-create', url),
  switchTab: (tabId) => ipcRenderer.invoke('viju:tab-switch', String(tabId)),
  closeTab: (tabId) => ipcRenderer.invoke('viju:tab-close', String(tabId)),
  restoreClosedTab: () => ipcRenderer.invoke('viju:tab-restore'),
  navigate: (input) => ipcRenderer.invoke('viju:navigate', String(input)),
  navControl: (action) => ipcRenderer.invoke('viju:nav-control', String(action)),
  controlAutoRefresh: (payload) => ipcRenderer.invoke('viju:auto-refresh-control', payload),
  setUserAgent: (payload) => ipcRenderer.invoke('viju:set-user-agent', payload),
  getNewUserAgent: (options) => ipcRenderer.invoke('viju:ua-get-new-agent', options),
  updateUserAgentSwitcherConfig: (config) => ipcRenderer.invoke('viju:ua-update-config', config),
  resetUserAgentSwitcherDefaults: () => ipcRenderer.invoke('viju:ua-reset-defaults'),
  setFingerprintProfile: (profile) => ipcRenderer.invoke('viju:set-fingerprint-profile', profile),
  setFingerprintSpoofConfig: (config) => ipcRenderer.invoke('viju:set-fingerprint-spoof-config', config),
  setWebRTCConfig: (config) => ipcRenderer.invoke('viju:set-webrtc-config', config),
  clearBrowserData: (options) => ipcRenderer.invoke('viju:clear-browser-data', options),
  toggleBookmark: (payload) => ipcRenderer.invoke('viju:toggle-bookmark', payload),
  onStateUpdated: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('viju:state-updated', listener);
    return () => ipcRenderer.removeListener('viju:state-updated', listener);
  }
});
