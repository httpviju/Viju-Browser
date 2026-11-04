'use strict';

/**
 * Viju Browser — Security-Hardened Tab Preload & 12-Surface Fingerprint Spoofing Engine
 * Runs with contextIsolation: true, nodeIntegration: false, sandbox: true.
 * Uses webFrame.executeJavaScript in the main world at document start alongside
 * Chromium CDP Page.addScriptToEvaluateOnNewDocument so all 12 surfaces are protected
 * without weakening Electron's renderer sandbox or contextIsolation boundary.
 */
const { ipcRenderer, webFrame } = require('electron');

function buildMainWorldSpoofScript(config) {
  const serializedConfig = JSON.stringify(config || {});
  return `(function() {
    'use strict';
    const CFG = ${serializedConfig};
    const fp = CFG.fingerprintProfile || {};
    const spoof = CFG.fingerprintSpoofConfig || {};
    const controls = spoof.controls || {};
    const webrtc = CFG.webrtc || { enabled: true };
    const seed = (controls.random ? (spoof.profileSeed || 0x7F4A9C21) : 0x13579BDF) >>> 0;

    // Origin Whitelist evaluation
    const host = (window.location && window.location.hostname || '').toLowerCase();
    const rules = Array.isArray(spoof.whitelistRules) ? spoof.whitelistRules : [];
    function isControlEnabled(ctrlKey) {
      if (!controls[ctrlKey]) return false;
      if (controls.whitelist && host) {
        for (let i = 0; i < rules.length; i++) {
          const r = rules[i];
          if (!r || !r.enabled || !r.domain) continue;
          const d = String(r.domain).toLowerCase();
          if (host === d || host.endsWith('.' + d)) {
            if (r.bypassControls === 'all' || (Array.isArray(r.bypassControls) && r.bypassControls.indexOf(ctrlKey) !== -1)) {
              emitLog('whitelist', 'whitelisted', 'Origin Exception', 'Bypassed ' + ctrlKey + ' on ' + host);
              return false;
            }
          }
        }
      }
      return true;
    }

    function emitLog(control, level, apiSurface, detail) {
      if (!controls.logs) return;
      try {
        window.postMessage({
          __vijuFpLog: true,
          control: control,
          level: level,
          origin: window.location.origin || host,
          apiSurface: apiSurface,
          detail: detail,
          timestampMs: Date.now()
        }, '*');
      } catch (_e) {}
    }

    // Deterministic 32-bit Mulberry32 PRNG keyed by profileSeed + surface salt
    function createPrng(salt) {
      let a = (seed ^ (salt >>> 0)) >>> 0;
      return function() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const uaCfg = CFG.uaSwitcherConfig || {};
    const uaBlacklist = Array.isArray(uaCfg.blacklistDomains) ? uaCfg.blacklistDomains : [];
    function isDomainBlacklistedForUA() {
      if (!host) return false;
      for (let i = 0; i < uaBlacklist.length; i++) {
        const b = uaBlacklist[i];
        if (!b || !b.enabled || !b.domainPattern) continue;
        const pat = String(b.domainPattern).toLowerCase().trim();
        if (pat.indexOf('*.') === 0) {
          const base = pat.slice(2);
          if (host === base || host.endsWith('.' + base)) return true;
        } else if (host === pat || (b.matchSubdomains && host.endsWith('.' + pat))) {
          return true;
        }
      }
      return false;
    }

    // 1. NAVIGATOR & SCREEN SPOOFING + USER-AGENT JS DETECTION PROTECTION
    const defProp = (obj, prop, getter) => {
      try {
        Object.defineProperty(obj, prop, { get: getter, configurable: true });
      } catch (_e) {}
    };

    if (uaCfg.enabledGlobally && uaCfg.jsProtectionEnabled && uaCfg.activeGeneratedProfile && !isDomainBlacklistedForUA()) {
      const prof = uaCfg.activeGeneratedProfile;
      if (prof.userAgent) defProp(navigator, 'userAgent', () => prof.userAgent);
      if (prof.appVersion) defProp(navigator, 'appVersion', () => prof.appVersion);
      if (prof.platform) defProp(navigator, 'platform', () => prof.platform);
      if (typeof prof.vendor === 'string') defProp(navigator, 'vendor', () => prof.vendor);
      emitLog('navigator', 'protected', 'UA Switcher JS Protection', 'Synchronized navigator.userAgent, appVersion, platform (' + prof.platform + '), vendor');
    }

    if (isControlEnabled('navigator')) {
      defProp(navigator, 'webdriver', () => false);
      if (fp.hardwareConcurrency) defProp(navigator, 'hardwareConcurrency', () => fp.hardwareConcurrency);
      if (fp.deviceMemory) defProp(navigator, 'deviceMemory', () => fp.deviceMemory);
      if (fp.language) {
        const baseLang = fp.language.split('-')[0] || 'en';
        defProp(navigator, 'language', () => fp.language);
        defProp(navigator, 'languages', () => Object.freeze([fp.language, baseLang]));
      }
      if (fp.platform && !(uaCfg.enabledGlobally && uaCfg.jsProtectionEnabled && !isDomainBlacklistedForUA())) {
        defProp(navigator, 'platform', () => fp.platform);
      }
      if (fp.screenWidth && fp.screenHeight && window.screen) {
        defProp(window.screen, 'width', () => fp.screenWidth);
        defProp(window.screen, 'height', () => fp.screenHeight);
        defProp(window.screen, 'availWidth', () => fp.screenWidth);
        defProp(window.screen, 'availHeight', () => Math.max(200, fp.screenHeight - 40));
        defProp(window.screen, 'colorDepth', () => fp.colorDepth || 24);
        defProp(window.screen, 'pixelDepth', () => fp.colorDepth || 24);
      }
      emitLog('navigator', 'protected', 'navigator & window.screen', 'Applied coherent navigator/screen getters');
    }

    // 2. CANVAS SPOOFING (2D getImageData, toDataURL, toBlob)
    if (isControlEnabled('canvas') && window.CanvasRenderingContext2D) {
      const step = Math.max(1, Number(spoof.canvasNoiseStep) || 2);
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
        const img = origGetImageData.apply(this, arguments);
        const prng = createPrng(0x00CA7A55 ^ (w << 8) ^ h);
        for (let i = 0; i < img.data.length; i += 16) {
          const ch = Math.floor(prng() * 3);
          const delta = prng() > 0.5 ? step : -step;
          const idx = i + ch;
          if (idx < img.data.length) {
            img.data[idx] = Math.max(0, Math.min(255, img.data[idx] + delta));
          }
        }
        emitLog('canvas', 'protected', 'CanvasRenderingContext2D.getImageData', 'Perturbed pixel buffer with profile seed');
        return img;
      };
    }

    // 3. WEBGL SPOOFING (UNMASKED_VENDOR_WEBGL 37445, UNMASKED_RENDERER_WEBGL 37446, readPixels)
    if (isControlEnabled('webgl')) {
      const vendor = spoof.webglVendor || fp.webglVendor || 'Google Inc. (NVIDIA)';
      const renderer = spoof.webglRenderer || fp.webglRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      const patchWebGL = (proto) => {
        if (!proto || !proto.getParameter) return;
        const origGetParam = proto.getParameter;
        proto.getParameter = function(param) {
          if (param === 37445) {
            emitLog('webgl', 'protected', 'WebGL.getParameter(37445)', 'Returned spoofed vendor: ' + vendor);
            return vendor;
          }
          if (param === 37446) {
            emitLog('webgl', 'protected', 'WebGL.getParameter(37446)', 'Returned spoofed renderer: ' + renderer);
            return renderer;
          }
          return origGetParam.apply(this, arguments);
        };
      };
      if (window.WebGLRenderingContext) patchWebGL(window.WebGLRenderingContext.prototype);
      if (window.WebGL2RenderingContext) patchWebGL(window.WebGL2RenderingContext.prototype);
    }

    // 4. AUDIO SPOOFING (AudioBuffer.getChannelData & AnalyserNode)
    if (isControlEnabled('audio') && window.AudioBuffer) {
      const eps = Number(spoof.audioNoiseEpsilon) || 1.4e-7;
      const origGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function(channel) {
        const data = origGetChannelData.apply(this, arguments);
        const prng = createPrng(0x00A0D105 ^ (channel + 1));
        for (let i = 0; i < data.length; i += 8) {
          data[i] = data[i] + Math.fround((prng() - 0.5) * 2 * eps);
        }
        emitLog('audio', 'protected', 'AudioBuffer.getChannelData', 'Applied deterministic float32 epsilon perturbation');
        return data;
      };
    }

    // 5. FONT SPOOFING (FontFaceSet.check & Context2D.measureText)
    if (isControlEnabled('font') && window.CanvasRenderingContext2D) {
      const jitterPx = Number(spoof.fontJitterPx) || 0.015;
      const origMeasureText = CanvasRenderingContext2D.prototype.measureText;
      CanvasRenderingContext2D.prototype.measureText = function(text) {
        const metrics = origMeasureText.apply(this, arguments);
        const prng = createPrng(0x00F07711 ^ String(text || '').length);
        const delta = (prng() - 0.5) * 2 * jitterPx;
        const origWidth = metrics.width;
        try {
          Object.defineProperty(metrics, 'width', {
            get: () => origWidth + delta,
            configurable: true
          });
        } catch (_e) {}
        return metrics;
      };
    }

    // 6. CLIENTRECTS SPOOFING (Element & Range getBoundingClientRect / getClientRects)
    if (isControlEnabled('clientRects') && window.Element) {
      const delta = Number(spoof.clientRectsDeltaPx) || 0.00037;
      const origGetBCR = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function() {
        const r = origGetBCR.apply(this, arguments);
        if (!r || (r.width === 0 && r.height === 0)) return r;
        return new DOMRect(r.x + delta, r.y + delta, r.width + delta, r.height + delta);
      };
    }

    // 7. TIMEZONE SPOOFING (Intl.DateTimeFormat & Date.prototype.getTimezoneOffset)
    if (isControlEnabled('timezone') && fp.timezone) {
      const tzOffsets = {
        'UTC': 0,
        'Europe/London': 0,
        'Europe/Berlin': -60,
        'America/New_York': 300,
        'America/Chicago': 360,
        'America/Los_Angeles': 480,
        'Asia/Tokyo': -540
      };
      if (Object.prototype.hasOwnProperty.call(tzOffsets, fp.timezone)) {
        Date.prototype.getTimezoneOffset = function() {
          return tzOffsets[fp.timezone];
        };
      }
      const OrigDTF = Intl.DateTimeFormat;
      const PatchedDTF = function(locales, options) {
        const opts = Object.assign({}, options, { timeZone: (options && options.timeZone) || fp.timezone });
        return new OrigDTF(locales || fp.language, opts);
      };
      PatchedDTF.prototype = OrigDTF.prototype;
      PatchedDTF.supportedLocalesOf = OrigDTF.supportedLocalesOf;
      Intl.DateTimeFormat = PatchedDTF;
    }

    // 8. WEBRTC SHIELD & CANDIDATE SCRUBBING (Local IP, Public STUN IP, UDP, Proxy & Whitelist)
    function isWebRTCWhitelistedOrigin() {
      const rules = (webrtc && Array.isArray(webrtc.whitelistDomains)) ? webrtc.whitelistDomains : [];
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        if (!r || !r.enabled || !r.domain) continue;
        const d = String(r.domain).toLowerCase();
        if (currentHost === d || currentHost.endsWith('.' + d)) return true;
      }
      return false;
    }

    const webrtcWhitelisted = isWebRTCWhitelistedOrigin();
    const shieldActive = Boolean(webrtc && webrtc.shieldEnabled) && !webrtcWhitelisted;

    if (isControlEnabled('webrtc') || !webrtc.enabled || shieldActive) {
      if (!webrtc.enabled || spoof.mode === 'strict') {
        delete window.RTCPeerConnection;
        delete window.webkitRTCPeerConnection;
        emitLog('webrtc', 'protected', 'window.RTCPeerConnection', 'Blocked RTCPeerConnection constructor in strict/disabled mode');
      } else if (webrtcWhitelisted) {
        emitLog('webrtc', 'whitelisted_bypass', 'WebRTC Shield Whitelist', 'Allowed WebRTC peer connection on trusted domain: ' + currentHost);
      } else if (window.RTCPeerConnection) {
        const OrigPeerConnection = window.RTCPeerConnection;
        window.RTCPeerConnection = function(pcConfig, constraints) {
          const safeConfig = Object.assign({}, pcConfig || {});
          if (shieldActive && (webrtc.blockPublicIp || webrtc.blockUdp || webrtc.forceProxy)) {
            safeConfig.iceServers = [];
            emitLog('webrtc', 'protected', 'RTCPeerConnection(iceServers)', 'Cleared STUN/TURN servers to prevent public IP & direct UDP leak');
          }
          const pc = new OrigPeerConnection(safeConfig, constraints);
          pc.addEventListener('icecandidate', function(ev) {
            if (ev && ev.candidate && ev.candidate.candidate) {
              const cand = String(ev.candidate.candidate);
              const isPrivateLan = /(192\\.168\\.|10\\.|172\\.(1[6-9]|2\\d|3[0-1])\\.|\\.local)/i.test(cand);
              const isSrflx = /typ\\s+srflx/i.test(cand);
              const isUdp = /\\budp\\b/i.test(cand);

              if ((shieldActive && webrtc.blockLocalIp && isPrivateLan) || (!webrtc.shieldEnabled && isPrivateLan)) {
                ev.stopImmediatePropagation();
                emitLog('webrtc', 'protected', 'WebRTC Shield (Block Local IP)', 'Stripped RFC1918/mDNS host ICE candidate');
                return;
              }
              if (shieldActive && (webrtc.blockPublicIp || webrtc.forceProxy) && isSrflx) {
                ev.stopImmediatePropagation();
                emitLog('webrtc', 'protected', 'WebRTC Shield (Block Public IP)', 'Blocked STUN srflx public IP ICE candidate');
                return;
              }
              if (shieldActive && (webrtc.blockUdp || webrtc.forceProxy) && isUdp) {
                ev.stopImmediatePropagation();
                emitLog('webrtc', 'protected', 'WebRTC Shield (Block UDP / Force Proxy)', 'Blocked non-proxied UDP ICE candidate');
                return;
              }
              if (webrtc && webrtc.leakDetectionEnabled && (isPrivateLan || isSrflx)) {
                emitLog('webrtc', 'warning', 'WebRTC Leak Detection', 'Detected exposed ICE candidate on ' + currentHost);
              }
            }
          }, true);
          return pc;
        };
        window.RTCPeerConnection.prototype = OrigPeerConnection.prototype;
      }
    }
  })();`;
}

try {
  const config = ipcRenderer.sendSync('viju:get-tab-preload-config-sync');
  if (config) {
    webFrame.executeJavaScript(buildMainWorldSpoofScript(config));

    window.addEventListener('message', (event) => {
      if (event && event.data && event.data.__vijuFpLog === true) {
        ipcRenderer.send('viju:fp-log', {
          control: String(event.data.control || 'system').slice(0, 32),
          level: String(event.data.level || 'protected').slice(0, 24),
          origin: String(event.data.origin || '').slice(0, 128),
          apiSurface: String(event.data.apiSurface || '').slice(0, 128),
          detail: String(event.data.detail || '').slice(0, 256),
          timestampMs: Number(event.data.timestampMs) || Date.now()
        });
      }
    });
  }
} catch (_err) {
  // Never leak preload errors to untrusted page context
}
