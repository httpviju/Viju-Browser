import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  Terminal,
  ShieldCheck,
  Package,
  Wrench,
  FileCode,
  Play,
} from 'lucide-react';
import { ELECTRON_SOURCE_FILES } from '../data/electronSourceFiles';

interface ElectronSourceWorkbenchProps {
  onTriggerInstallerDownload: () => void;
}

export const ElectronSourceWorkbench: React.FC<ElectronSourceWorkbenchProps> = ({
  onTriggerInstallerDownload,
}) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<
    'code' | 'install-run' | 'build-exe' | 'troubleshooting'
  >('code');

  const currentFile = ELECTRON_SOURCE_FILES[selectedFileIndex] || ELECTRON_SOURCE_FILES[0];

  const handleCopy = (filename: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const handleDownloadSingleFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-blue-400">
            viju://electron-source · Windows x64 Desktop Deliverables
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Viju Browser — Complete Electron Source Code & Windows .EXE Build Center
          </h1>
          <p className="text-xs text-slate-400 max-w-3xl">
            Inspect, copy, or download every modular file for the standalone Electron 35 +
            Chromium 134 Windows application, along with step-by-step commands to run locally
            and package a signed/unsigned NSIS <code className="text-blue-300">.exe</code>{' '}
            installer.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onTriggerInstallerDownload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Simulate .EXE Installer Download</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveGuideTab('code')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeGuideTab === 'code'
              ? 'bg-blue-600 text-white'
              : 'bg-[#0F172A] text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>1. Complete Source Files ({ELECTRON_SOURCE_FILES.length} Files)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGuideTab('install-run')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeGuideTab === 'install-run'
              ? 'bg-blue-600 text-white'
              : 'bg-[#0F172A] text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>2. Windows Installation & Run Locally</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGuideTab('build-exe')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeGuideTab === 'build-exe'
              ? 'bg-blue-600 text-white'
              : 'bg-[#0F172A] text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>3. Build Windows Installer (.EXE)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGuideTab('troubleshooting')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeGuideTab === 'troubleshooting'
              ? 'bg-blue-600 text-white'
              : 'bg-[#0F172A] text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>4. Troubleshooting Common Errors</span>
        </button>
      </div>

      {/* Tab 1: Complete Source Files */}
      {activeGuideTab === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* File List Sidebar */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-semibold text-slate-400 px-1">
              Project Directory: viju-browser-win32/
            </div>
            {ELECTRON_SOURCE_FILES.map((file, idx) => (
              <button
                key={file.filename}
                type="button"
                onClick={() => setSelectedFileIndex(idx)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedFileIndex === idx
                    ? 'bg-blue-950/40 border-blue-500 text-slate-100'
                    : 'bg-[#0F172A] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-xs text-blue-400">
                    {file.filename}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {file.language}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {file.description}
                </p>
              </button>
            ))}
          </div>

          {/* Code Viewer */}
          <div className="lg:col-span-8 bg-[#0F172A] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-[#090D16] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-bold text-slate-100">
                  {currentFile.path}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {currentFile.description}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(currentFile.filename, currentFile.content)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  {copiedFile === currentFile.filename ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadSingleFile(currentFile.filename, currentFile.content)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {currentFile.filename}</span>
                </button>
              </div>
            </div>

            {/* Security Notes Bar */}
            <div className="px-4 py-2.5 bg-blue-950/30 border-b border-slate-800 space-y-1">
              {currentFile.securityNotes.map((note, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-blue-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{note}</span>
                </div>
              ))}
            </div>

            <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[540px] leading-relaxed">
              <code>{currentFile.content}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Tab 2: Windows Installation & Local Run */}
      {activeGuideTab === 'install-run' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-slate-100">
              01. Exact Windows Installation Prerequisites
            </h2>
            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <li>
                <strong>Operating System:</strong> Windows 10 (version 21H2+) or Windows 11
                (64-bit x64).
              </li>
              <li>
                <strong>Node.js Runtime:</strong> Install Node.js 20 LTS or Node.js 22 LTS from{' '}
                <code className="text-blue-300">https://nodejs.org</code> (includes{' '}
                <code className="text-blue-300">npm</code>).
              </li>
              <li>
                <strong>Verify Environment in PowerShell:</strong>
                <pre className="mt-1.5 p-3 rounded-lg bg-[#090D16] border border-slate-800 font-mono text-blue-300">
                  {`node --version\nnpm --version`}
                </pre>
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-slate-100">
              02. Commands to Run Viju Browser Locally
            </h2>
            <p className="text-xs text-slate-300">
              Place all 8 files (<code className="text-blue-300">package.json</code>,{' '}
              <code className="text-blue-300">main.js</code>,{' '}
              <code className="text-blue-300">preload.js</code>,{' '}
              <code className="text-blue-300">tab-preload.js</code>,{' '}
              <code className="text-blue-300">ipc-validators.js</code>,{' '}
              <code className="text-blue-300">renderer.js</code>,{' '}
              <code className="text-blue-300">index.html</code>,{' '}
              <code className="text-blue-300">style.css</code>) inside a folder named{' '}
              <code className="text-blue-300">viju-browser-win32</code> and execute:
            </p>
            <pre className="p-3.5 rounded-lg bg-[#090D16] border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
              {`cd viju-browser-win32
npm install
npm start`}
            </pre>
            <p className="text-xs text-slate-400">
              To run with Chromium internal console logging enabled during debugging:
            </p>
            <pre className="p-3 rounded-lg bg-[#090D16] border border-slate-800 font-mono text-xs text-blue-300">
              {`npm run dev`}
            </pre>
            <p className="text-xs text-slate-400 pt-1">
              To run the automated 19-test verification suite (verifying Get New Agent,
              startup/interval rotation, pause/resume, 14 Browser/OS generator toggles,
              exact/subdomain Blacklist matching, 12-Surface Fingerprint Spoofing, and Clear
              Browsing Data):
            </p>
            <pre className="p-3 rounded-lg bg-[#090D16] border border-slate-800 font-mono text-xs text-emerald-300">
              {`npx tsx --test src/utils/browserEngine.test.ts`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 3: Build Windows Installer (.EXE) */}
      {activeGuideTab === 'build-exe' && (
        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-slate-100">
            03. Building the Windows NSIS Installer (.EXE) & Portable Binary
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            The project uses <code className="text-blue-300">electron-builder</code> configured
            in <code className="text-blue-300">package.json</code> to produce both a full
            multi-step Windows NSIS Setup Wizard (<code className="text-blue-300">.exe</code>)
            with Desktop/Start Menu shortcuts and a standalone Portable executable.
          </p>
          <pre className="p-4 rounded-lg bg-[#090D16] border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
            {`# 1. Install dependencies (Electron 35 + electron-builder 26)
npm install

# 2. Test unpackaged directory bundle first (fast verification)
npm run pack

# 3. Build production Windows x64 Installer (.exe)
npm run dist:win`}
          </pre>
          <div className="p-3.5 rounded-lg bg-[#090D16] border border-slate-800 text-xs space-y-1.5">
            <div className="font-semibold text-slate-200">Generated Output Artifacts:</div>
            <div className="font-mono text-blue-400">
              dist-installer/Viju-Browser-Setup-1.4.0-x64.exe (NSIS Installer)
            </div>
            <div className="font-mono text-slate-400">
              dist-installer/win-unpacked/Viju Browser.exe (Unpacked Application Binary)
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Troubleshooting */}
      {activeGuideTab === 'troubleshooting' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: '1. Electron binary download stalls during npm install',
              cause: 'Corporate firewall or slow mirror blocking GitHub releases download.',
              fix: 'Set ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" in PowerShell before running npm install, or clear cache with npm cache clean --force.',
            },
            {
              title: '2. Symbolic link privilege error during electron-builder on Windows',
              cause: 'winCodeSign archive extraction requires privilege to create symlinks on Windows.',
              fix: 'Enable Windows Developer Mode (Settings -> System -> For developers -> Developer Mode: On) or run PowerShell as Administrator when running npm run dist:win.',
            },
            {
              title: '3. WebContentsView bounds overlap the right-hand side panel',
              cause: 'In Electron, WebContentsView is a native Chromium compositor layer rendered above HTML DOM elements.',
              fix: 'main.js automatically insets the active WebContentsView width by 380px via viju:set-side-panel-open IPC whenever a side panel opens.',
            },
            {
              title: '4. Video conferencing (Meet / Zoom / Teams) fails to connect audio/video',
              cause: 'WebRTC Control is toggled Off or WebRTC Shield is set to disable_non_proxied_udp without an active TURN/TCP server.',
              fix: 'Open the WebRTC panel in Viju Browser, enable WebRTC Master Control, and select default_public_interface_only.',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 space-y-2"
            >
              <div className="font-semibold text-sm text-slate-100">{item.title}</div>
              <div className="text-xs text-amber-300">
                <strong>Cause:</strong> {item.cause}
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                <strong>Solution:</strong> {item.fix}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
