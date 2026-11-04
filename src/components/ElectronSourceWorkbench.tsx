import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  Terminal,
  ShieldCheck,
  Package,
  Wrench,
  FileCode,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { ELECTRON_SOURCE_FILES } from '../data/electronSourceFiles';
import {
  buildGitHubReleaseUrls,
  diagnoseNoReleasesState,
  GitHubNoReleasesDiagnosisInput,
  GitHubNoReleasesDiagnosisResult,
  DEFAULT_GITHUB_RELEASE_REPO,
  VIJU_INSTALLER_EXE_FILENAME,
  VIJU_PORTABLE_EXE_FILENAME,
  VIJU_RELEASE_TAG,
} from '../utils/browserEngine';

interface ElectronSourceWorkbenchProps {
  onTriggerInstallerDownload: (filename?: string, url?: string, sizeBytes?: number) => void;
}

interface LiveGitHubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  download_count: number;
}

interface LiveReleaseCheckState {
  status: 'idle' | 'checking' | 'found' | 'not_published_yet' | 'error';
  tagName?: string;
  publishedAt?: string;
  htmlUrl?: string;
  assets?: LiveGitHubReleaseAsset[];
  message?: string;
  diagnosisInput?: GitHubNoReleasesDiagnosisInput;
  diagnosis?: GitHubNoReleasesDiagnosisResult;
}

const GITHUB_REPO_STORAGE_KEY = 'viju.githubReleaseRepo.v1';

export const ElectronSourceWorkbench: React.FC<ElectronSourceWorkbenchProps> = ({
  onTriggerInstallerDownload,
}) => {
  const workflowFileIndex = Math.max(
    0,
    ELECTRON_SOURCE_FILES.findIndex((f) => f.filename === 'build-windows-exe.yml')
  );

  const [selectedFileIndex, setSelectedFileIndex] = useState(workflowFileIndex);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<
    'github-release' | 'code' | 'install-run' | 'build-exe' | 'troubleshooting'
  >('github-release');

  const [repoInput, setRepoInput] = useState<string>(() => {
    try {
      return localStorage.getItem(GITHUB_REPO_STORAGE_KEY) || DEFAULT_GITHUB_RELEASE_REPO;
    } catch {
      return DEFAULT_GITHUB_RELEASE_REPO;
    }
  });

  const [liveReleaseState, setLiveReleaseState] = useState<LiveReleaseCheckState>({
    status: 'idle',
  });

  useEffect(() => {
    try {
      localStorage.setItem(GITHUB_REPO_STORAGE_KEY, repoInput);
    } catch {
      // ignore storage errors
    }
  }, [repoInput]);

  const releaseUrls = buildGitHubReleaseUrls(repoInput, VIJU_RELEASE_TAG);
  const currentFile = ELECTRON_SOURCE_FILES[selectedFileIndex] || ELECTRON_SOURCE_FILES[0];
  const workflowFileObj =
    ELECTRON_SOURCE_FILES[workflowFileIndex] ||
    ELECTRON_SOURCE_FILES[ELECTRON_SOURCE_FILES.length - 1];
  const packageJsonFileObj =
    ELECTRON_SOURCE_FILES.find((f) => f.filename === 'package.json') || ELECTRON_SOURCE_FILES[0];

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedFile(key);
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

  const handleDownloadWindowsOneClickBuilderBat = () => {
    const desktopFiles = ELECTRON_SOURCE_FILES.filter(
      (f) => f.filename !== 'build-windows-exe.yml'
    );
    const psLines: string[] = [
      '$ErrorActionPreference = "Stop"',
      'Write-Host "==========================================================" -ForegroundColor Cyan',
      'Write-Host "  VIJU BROWSER v1.4.0 - 1-CLICK WINDOWS .EXE AUTO-BUILDER " -ForegroundColor Green',
      'Write-Host "==========================================================" -ForegroundColor Cyan',
      '$targetDir = Join-Path $PSScriptRoot "viju-browser-win32"',
      'New-Item -ItemType Directory -Force -Path $targetDir | Out-Null',
    ];

    for (const file of desktopFiles) {
      const b64 = btoa(unescape(encodeURIComponent(file.content)));
      psLines.push(
        `[IO.File]::WriteAllText((Join-Path $targetDir "${file.filename}"), [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${b64}")))`
      );
      psLines.push(`Write-Host "  [+] Extracted ${file.filename}" -ForegroundColor Gray`);
    }

    psLines.push(
      'Set-Location $targetDir',
      'Write-Host ""',
      'Write-Host "[1/2] Installing Electron 35 & electron-builder..." -ForegroundColor Yellow',
      'npm install --no-audit --no-fund',
      'Write-Host "[2/2] Building Viju-Browser-Setup-1.4.0-x64.exe & Portable .EXE..." -ForegroundColor Yellow',
      '$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"',
      'npx electron-builder --win --x64 --publish never',
      'Write-Host ""',
      'Write-Host "SUCCESS! Opening dist-installer folder with your .EXE files..." -ForegroundColor Green',
      'Invoke-Item (Join-Path $targetDir "dist-installer")'
    );

    const batContent = [
      '@echo off',
      'title Viju Browser v1.4.0 - 1-Click Windows .EXE Builder',
      'echo Starting Viju Browser Windows .EXE Auto-Builder...',
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "' +
        psLines.join('; ').replace(/"/g, '\\"') +
        '"',
      'pause',
      '',
    ].join('\r\n');

    handleDownloadSingleFile('Build-Viju-Browser-EXE.bat', batContent);
    onTriggerInstallerDownload(
      'Build-Viju-Browser-EXE.bat',
      'local://Build-Viju-Browser-EXE.bat',
      batContent.length
    );
  };

  const handleCheckLiveGitHubRelease = async () => {
    setLiveReleaseState({ status: 'checking' });
    const headers = { Accept: 'application/vnd.github+json' };
    try {
      const [repoRes, wfRes, runsRes, relRes] = await Promise.all([
        fetch(releaseUrls.apiRepoUrl, { headers }).catch(() => null),
        fetch(releaseUrls.apiWorkflowFileUrl, { headers }).catch(() => null),
        fetch(releaseUrls.apiActionRunsUrl, { headers }).catch(() => null),
        fetch(releaseUrls.apiLatestReleaseUrl, { headers }).catch(() => null),
      ]);

      const repoExists = Boolean(repoRes && repoRes.ok);
      const hasWorkflowFile = Boolean(wfRes && wfRes.ok);

      let latestRunStatus: 'queued' | 'in_progress' | 'completed' | 'none' = 'none';
      let latestRunConclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null = null;

      if (runsRes && runsRes.ok) {
        const runsData = await runsRes.json().catch(() => null);
        const firstRun =
          runsData && Array.isArray(runsData.workflow_runs) ? runsData.workflow_runs[0] : null;
        if (firstRun) {
          latestRunStatus = firstRun.status || 'none';
          latestRunConclusion = firstRun.conclusion || null;
        }
      }

      if (relRes && relRes.ok) {
        const data = await relRes.json();
        const assets: LiveGitHubReleaseAsset[] = Array.isArray(data.assets)
          ? data.assets.map((a: LiveGitHubReleaseAsset) => ({
              name: a.name,
              size: a.size,
              browser_download_url: a.browser_download_url,
              download_count: a.download_count,
            }))
          : [];
        const diagnosisInput: GitHubNoReleasesDiagnosisInput = {
          repoExists: true,
          hasWorkflowFile,
          latestRunStatus,
          latestRunConclusion,
          releasesCount: 1,
        };
        setLiveReleaseState({
          status: 'found',
          tagName: data.tag_name || VIJU_RELEASE_TAG,
          publishedAt: data.published_at
            ? new Date(data.published_at).toLocaleString()
            : 'Just now',
          htmlUrl: data.html_url || releaseUrls.releasesPageUrl,
          assets,
          diagnosisInput,
          diagnosis: diagnoseNoReleasesState(diagnosisInput),
          message: `Live GitHub Release (${data.tag_name || VIJU_RELEASE_TAG}) found with ${assets.length} downloadable asset(s)!`,
        });
        return;
      }

      const diagnosisInput: GitHubNoReleasesDiagnosisInput = {
        repoExists,
        hasWorkflowFile,
        latestRunStatus,
        latestRunConclusion,
        releasesCount: 0,
      };
      const diagnosis = diagnoseNoReleasesState(diagnosisInput);

      setLiveReleaseState({
        status: 'not_published_yet',
        diagnosisInput,
        diagnosis,
        message: `${diagnosis.headlineHinglish} — ${diagnosis.explanationHinglish}`,
      });
    } catch {
      setLiveReleaseState({
        status: 'error',
        message:
          'Could not reach api.github.com right now. Use the Fix steps or 1-Click .BAT Builder below.',
      });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Banner + Direct GitHub Releases .EXE Download Hub */}
      <div className="p-5 rounded-xl bg-[#0F172A] border border-blue-500/40 space-y-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                GITHUB RELEASES DIRECT .EXE DOWNLOAD · AUTO-PUBLISH WORKFLOW READY
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100">
              Viju Browser — Direct Windows <code className="text-blue-400">.EXE</code> Download
              from GitHub Releases Tab
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Apna GitHub repository naam niche set karein aur sidha{' '}
              <strong className="text-white">GitHub Releases Tab</strong> se{' '}
              <code className="text-emerald-300">{VIJU_INSTALLER_EXE_FILENAME}</code> (Full
              Installer) ya{' '}
              <code className="text-blue-300">{VIJU_PORTABLE_EXE_FILENAME}</code> (Portable
              No-Install) direct download karein. Agar GitHub par abhi{' '}
              <strong className="text-amber-300">&quot;No releases published&quot;</strong> dikha
              raha hai, toh niche diye{' '}
              <strong className="text-emerald-300">2-Minute Fix</strong> ya{' '}
              <strong className="text-blue-300">1-Click Windows .BAT Builder</strong> ka use
              karein!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={releaseUrls.releasesPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span>Open GitHub Releases Tab</span>
            </a>

            <a
              href={releaseUrls.actionsWorkflowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open GitHub Actions Build</span>
            </a>
          </div>
        </div>

        {/* Repository Selector & Direct .EXE Download Buttons */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5 space-y-1.5">
            <label
              htmlFor="github-release-repo-input"
              className="block text-xs font-semibold text-slate-300"
            >
              GitHub Repository (<code className="text-blue-400">owner/repo</code> or full
              GitHub URL):
            </label>
            <div className="flex items-center gap-2">
              <input
                id="github-release-repo-input"
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="thakorvijay51098/viju-browser"
                className="flex-1 bg-[#090D16] border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCheckLiveGitHubRelease}
                disabled={liveReleaseState.status === 'checking'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors shrink-0"
                title="Diagnose why GitHub shows 'No releases published' or check if .EXE is ready"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    liveReleaseState.status === 'checking' ? 'animate-spin' : ''
                  }`}
                />
                <span>Diagnose / Check Release</span>
              </button>
            </div>
            <div className="text-[11px] font-mono text-slate-400 truncate">
              Target Release URL:{' '}
              <span className="text-blue-400">{releaseUrls.latestReleaseUrl}</span>
            </div>
          </div>

          {/* Direct Download Buttons */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Button 1: Direct NSIS Setup .EXE */}
            <div className="p-3 rounded-lg bg-[#090D16] border border-emerald-500/40 flex flex-col justify-between gap-2.5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-semibold text-emerald-400">
                    WINDOWS x64 NSIS INSTALLER (.EXE)
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                    Recommended
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-100 mt-1 truncate">
                  {VIJU_INSTALLER_EXE_FILENAME}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Direct from <code className="text-slate-300">/releases/latest/download/</code>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={releaseUrls.installerExeDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    onTriggerInstallerDownload(
                      VIJU_INSTALLER_EXE_FILENAME,
                      releaseUrls.installerExeDownloadUrl,
                      84_500_000
                    )
                  }
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Direct Download Setup .EXE</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy('installer-url', releaseUrls.installerExeDownloadUrl)
                  }
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Copy direct Setup .EXE GitHub Release link"
                >
                  {copiedFile === 'installer-url' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Button 2: Direct Portable .EXE */}
            <div className="p-3 rounded-lg bg-[#090D16] border border-blue-500/40 flex flex-col justify-between gap-2.5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-semibold text-blue-400">
                    PORTABLE STANDALONE (.EXE)
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/30">
                    No Install Needed
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-100 mt-1 truncate">
                  {VIJU_PORTABLE_EXE_FILENAME}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Direct from <code className="text-slate-300">/releases/latest/download/</code>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={releaseUrls.portableExeDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    onTriggerInstallerDownload(
                      VIJU_PORTABLE_EXE_FILENAME,
                      releaseUrls.portableExeDownloadUrl,
                      79_200_000
                    )
                  }
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Direct Download Portable .EXE</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy('portable-url', releaseUrls.portableExeDownloadUrl)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Copy direct Portable .EXE GitHub Release link"
                >
                  {copiedFile === 'portable-url' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated "Why does GitHub say 'No releases published'?" Solution Box */}
        <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/40 space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                GitHub Par &quot;Releases / No releases published&quot; Kyun Dikha Raha Hai? (Aur
                2 Minute Me Fix Kaise Karein)
              </span>
            </div>
            <span className="text-[11px] font-mono text-amber-200/90 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-500/30">
              AI Studio Workspace → GitHub Sync Required
            </span>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">
            Jab tak AI Studio ka naya code (jisme{' '}
            <code className="text-amber-300">.github/workflows/build-windows-exe.yml</code> aur{' '}
            <code className="text-amber-300">electron-desktop/</code> folder hai) aapke GitHub
            repository (<code className="text-blue-300">{releaseUrls.normalizedRepo}</code>) par
            push/sync nahi hota, tab tak GitHub ka Releases tab{' '}
            <strong className="text-white">&quot;No releases published&quot;</strong> dikhata hai.
            Aap niche diye <strong>2 tariko</strong> me se kisi bhi 1 se abhi turant{' '}
            <code className="text-emerald-300">.EXE</code> pa sakte hain:
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
            {/* Method A: 1-Click Fix for electron-builder "Cannot read properties of null (reading 'channel')" */}
            <div className="p-3.5 rounded-lg bg-[#090D16] border border-emerald-500/50 space-y-2.5">
              <div className="font-bold text-emerald-400 flex items-center justify-between gap-2">
                <span>
                  1-Click Fix: GitHub Actions Error (Cannot read properties of null reading
                  &apos;channel&apos;)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 shrink-0">
                  100% Fixed YAML
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Aapke GitHub Actions log me{' '}
                <code className="text-emerald-300">{VIJU_INSTALLER_EXE_FILENAME}</code> aur{' '}
                <code className="text-blue-300">{VIJU_PORTABLE_EXE_FILENAME}</code>{' '}
                <strong>dono 100% compile ho chuke the</strong>! Sirf aakhri second me{' '}
                <code className="text-amber-300">electron-builder 26.18.0</code> isliye ruka kyunki{' '}
                <code className="text-amber-300">electron-desktop/package.json</code> me{' '}
                <code className="text-amber-300">&quot;repository&quot;</code> nahi tha aur{' '}
                <code className="text-amber-300">updateInfoBuilder.ts</code>{' '}
                <code className="text-rose-300">null.channel</code> read karne laga.
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 leading-relaxed">
                <li>
                  Niche green button{' '}
                  <strong>&quot;Copy Fixed Workflow YAML (Auto-Fixes package.json)&quot;</strong>{' '}
                  dabayein.
                </li>
                <li>
                  Apne GitHub repo me{' '}
                  <code className="text-blue-300">.github/workflows/build-windows-exe.yml</code>{' '}
                  kholkar yeh naya YAML paste karein aur <strong>Commit changes</strong> kar dein
                  (yeh workflow PowerShell-safe hai aur khud{' '}
                  <code className="text-emerald-300">package.json</code> me{' '}
                  <code className="text-emerald-300">owner/repo/channel</code> set karke bina kisi
                  error ke build karega!).
                </li>
              </ol>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopy('wf-yaml', workflowFileObj.content)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
                >
                  {copiedFile === 'wf-yaml' ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiedFile === 'wf-yaml'
                      ? 'Fixed Workflow YAML Copied!'
                      : '1. Copy Fixed Workflow YAML (Auto-Fixes package.json)'}
                  </span>
                </button>
                <a
                  href={releaseUrls.editWorkflowFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleCopy('wf-yaml', workflowFileObj.content)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Edit build-windows-exe.yml on GitHub</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy('pkg-json', packageJsonFileObj.content)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold transition-colors"
                >
                  {copiedFile === 'pkg-json' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>
                    {copiedFile === 'pkg-json'
                      ? 'Fixed package.json Copied!'
                      : 'Copy Fixed package.json'}
                  </span>
                </button>
              </div>
            </div>

            {/* Method B: Instant 1-Click Local Windows .BAT Builder (Zero GitHub Wait) */}
            <div className="p-3.5 rounded-lg bg-[#090D16] border border-blue-500/40 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="font-bold text-blue-400 flex items-center justify-between">
                  <span>Tarika 2: Bina GitHub Wait Kiye Abhi PC Par .EXE Banayein</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300">
                    Instant 1-Click .BAT
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Agar aap GitHub sync ka wait nahi karna chahte, toh niche diye button se{' '}
                  <code className="text-blue-300">Build-Viju-Browser-EXE.bat</code> abhi download
                  karein. Isko apne Windows PC par double-click karte hi yeh saari 8 Electron
                  files extract karke{' '}
                  <code className="text-emerald-300">{VIJU_INSTALLER_EXE_FILENAME}</code> aur{' '}
                  <code className="text-blue-300">{VIJU_PORTABLE_EXE_FILENAME}</code> banakar
                  folder open kar dega!
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadWindowsOneClickBuilderBat}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download 1-Click Windows .EXE Builder (Build-Viju-Browser-EXE.bat)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live GitHub Release Check & Diagnostic Banner */}
        {liveReleaseState.status !== 'idle' && (
          <div
            className={`p-4 rounded-lg border text-xs flex flex-col gap-3 ${
              liveReleaseState.status === 'found'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : liveReleaseState.status === 'not_published_yet'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                {liveReleaseState.status === 'found' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>
                  {liveReleaseState.status === 'checking'
                    ? `Diagnosing GitHub repository ${releaseUrls.normalizedRepo} (Repo, Workflow, Actions & Releases)...`
                    : liveReleaseState.diagnosis
                    ? liveReleaseState.diagnosis.headlineHinglish
                    : liveReleaseState.message}
                </span>
              </div>
              {liveReleaseState.htmlUrl && (
                <a
                  href={liveReleaseState.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-mono text-emerald-300 hover:text-white shrink-0"
                >
                  View Release Page
                </a>
              )}
            </div>

            {liveReleaseState.diagnosis && liveReleaseState. diagnosisInput && (
              <div className="space-y-2">
                <p className="text-slate-200 leading-relaxed">
                  {liveReleaseState.diagnosis.explanationHinglish}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 rounded bg-[#090D16] border border-slate-800">
                    <span className="text-slate-400 block">1. GitHub Repo:</span>
                    <span
                      className={
                        liveReleaseState.diagnosisInput.repoExists
                          ? 'text-emerald-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      {liveReleaseState.diagnosisInput.repoExists
                        ? 'FOUND (PUBLIC)'
                        : 'NOT FOUND / PRIVATE'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#090D16] border border-slate-800">
                    <span className="text-slate-400 block">2. Workflow (.yml):</span>
                    <span
                      className={
                        liveReleaseState.diagnosisInput.hasWorkflowFile
                          ? 'text-emerald-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      {liveReleaseState.diagnosisInput.hasWorkflowFile
                        ? 'SYNCED ON GITHUB'
                        : 'NOT PUSHED YET'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#090D16] border border-slate-800">
                    <span className="text-slate-400 block">3. Actions Build:</span>
                    <span className="text-blue-300 font-bold uppercase">
                      {liveReleaseState.diagnosisInput.latestRunStatus}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#090D16] border border-slate-800">
                    <span className="text-slate-400 block">4. Releases Tab:</span>
                    <span
                      className={
                        liveReleaseState.diagnosisInput.releasesCount > 0
                          ? 'text-emerald-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      {liveReleaseState.diagnosisInput.releasesCount > 0
                        ? 'PUBLISHED (.EXE READY)'
                        : 'NO RELEASES YET'}
                    </span>
                  </div>
                </div>
                <div className="text-emerald-300 font-semibold pt-1">
                  Next Step: {liveReleaseState.diagnosis.actionRequiredHinglish}
                </div>
              </div>
            )}

            {liveReleaseState.assets && liveReleaseState.assets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {liveReleaseState.assets.map((asset) => (
                  <a
                    key={asset.name}
                    href={asset.browser_download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {asset.name} ({(asset.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveGuideTab('github-release')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeGuideTab === 'github-release'
              ? 'bg-emerald-600 text-white'
              : 'bg-[#0F172A] text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>1. GitHub Releases Direct .EXE Setup (Auto-Build)</span>
        </button>

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
          <span>2. Complete Source & Workflow Files ({ELECTRON_SOURCE_FILES.length} Files)</span>
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
          <span>3. Windows Installation & Run Locally</span>
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
          <span>4. Build Windows .EXE Locally</span>
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
          <span>5. Troubleshooting Common Errors</span>
        </button>
      </div>

      {/* Tab 1: GitHub Releases Direct .EXE Setup */}
      {activeGuideTab === 'github-release' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-slate-100">
              GitHub Releases Tab Se Direct <code className="text-emerald-400">.EXE</code> Kaise
              Download Karein (3 Simple Steps)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Humne aapke project me{' '}
              <code className="text-blue-300">.github/workflows/build-windows-exe.yml</code> aur{' '}
              <code className="text-blue-300">electron-desktop/package.json</code> set kar diya
              hai. Ab aapko apne PC par manually build karne ki bhi zaroorat nahi hai — GitHub
              khud Windows server (<code className="text-emerald-300">windows-latest</code>) par{' '}
              <code className="text-emerald-300">.exe</code> banakar aapke{' '}
              <strong className="text-white">Releases</strong> tab me daal dega:
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-lg bg-[#090D16] border border-slate-800 space-y-1.5">
                <div className="font-bold text-emerald-400">
                  Step 1: Project ko apne GitHub Repo ({releaseUrls.normalizedRepo}) par Push /
                  Sync karein
                </div>
                <p className="text-slate-300 leading-relaxed">
                  AI Studio ke top bar se <strong>Export to GitHub</strong> karein ya terminal se
                  code apne GitHub repository ke <code className="text-blue-300">main</code>{' '}
                  branch par push karein:
                </p>
                <pre className="p-2.5 rounded bg-[#0B0F19] border border-slate-800 font-mono text-[11px] text-blue-300 overflow-x-auto">
                  {`git init
git add .
git commit -m "Build Viju Browser Windows EXE to GitHub Releases"
git branch -M main
git remote add origin https://github.com/${releaseUrls.normalizedRepo}.git
git push -u origin main`}
                </pre>
              </div>

              <div className="p-3.5 rounded-lg bg-[#090D16] border border-slate-800 space-y-1.5">
                <div className="font-bold text-blue-400">
                  Step 2: GitHub Actions Automatically Windows .EXE Compile & Publish Karega
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Jaise hi code push hoga,{' '}
                  <code className="text-blue-300">.github/workflows/build-windows-exe.yml</code>{' '}
                  chalu ho jayega (lagbhag 2–3 minute). Yeh workflow{' '}
                  <code className="text-emerald-300">softprops/action-gh-release@v2</code> aur{' '}
                  <code className="text-emerald-300">permissions: contents: write</code> use
                  karke seedha aapke repo ke <strong>Releases</strong> tab me tag{' '}
                  <code className="text-amber-300">v1.4.0</code> create kar dega.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#090D16] border border-slate-800 space-y-1.5">
                <div className="font-bold text-amber-400">
                  Step 3: Releases Tab Kholkar Direct .EXE Download Karein!
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Apne GitHub repo ke right-side{' '}
                  <strong className="text-white">Releases</strong> section (ya upar diye{' '}
                  <strong className="text-emerald-300">Direct Download Setup .EXE</strong>{' '}
                  button) par click karein — wahan{' '}
                  <code className="text-emerald-300">{VIJU_INSTALLER_EXE_FILENAME}</code> aur{' '}
                  <code className="text-blue-300">{VIJU_PORTABLE_EXE_FILENAME}</code> dono
                  direct one-click download ke liye milenge!
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 p-5 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100">
                  Direct GitHub Release URLs (Copy & Share)
                </h3>
                <span className="text-[11px] font-mono text-emerald-400">Tag: {VIJU_RELEASE_TAG}</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-lg bg-[#090D16] border border-slate-800 space-y-1">
                  <div className="text-slate-400 font-medium">
                    1. GitHub Releases Tab Page:
                  </div>
                  <div className="font-mono text-[11px] text-blue-300 break-all">
                    {releaseUrls.releasesPageUrl}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#090D16] border border-slate-800 space-y-1">
                  <div className="text-slate-400 font-medium">
                    2. Direct NSIS Setup Installer (.EXE) URL:
                  </div>
                  <div className="font-mono text-[11px] text-emerald-300 break-all">
                    {releaseUrls.installerExeDownloadUrl}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#090D16] border border-slate-800 space-y-1">
                  <div className="text-slate-400 font-medium">
                    3. Direct Portable Executable (.EXE) URL:
                  </div>
                  <div className="font-mono text-[11px] text-blue-300 break-all">
                    {releaseUrls.portableExeDownloadUrl}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedFileIndex(workflowFileIndex);
                  setActiveGuideTab('code');
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <FileCode className="w-4 h-4" />
                <span>Inspect .github/workflows/build-windows-exe.yml</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const wf = ELECTRON_SOURCE_FILES[workflowFileIndex];
                  if (wf) handleDownloadSingleFile(wf.filename, wf.content);
                }}
                className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download build-windows-exe.yml File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Complete Source Files */}
      {activeGuideTab === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* File List Sidebar */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-semibold text-slate-400 px-1">
              Project Directory: electron-desktop/ & .github/workflows/
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

      {/* Tab 3: Windows Installation & Local Run */}
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
              Open PowerShell inside <code className="text-blue-300">electron-desktop/</code>{' '}
              and execute:
            </p>
            <pre className="p-3.5 rounded-lg bg-[#090D16] border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
              {`cd electron-desktop
npm install
npm start`}
            </pre>
            <p className="text-xs text-slate-400">
              To run with Chromium internal console logging enabled during debugging:
            </p>
            <pre className="p-3 rounded-lg bg-[#090D16] border border-slate-800 font-mono text-xs text-blue-300">
              {`npm run dev`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 4: Build Windows Installer (.EXE) */}
      {activeGuideTab === 'build-exe' && (
        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-slate-100">
            03. Building the Windows NSIS Installer (.EXE) & Portable Binary
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            The project uses <code className="text-blue-300">electron-builder</code> configured
            in <code className="text-blue-300">electron-desktop/package.json</code> to produce
            both a full Windows NSIS Setup Wizard (
            <code className="text-emerald-300">{VIJU_INSTALLER_EXE_FILENAME}</code>) and a
            standalone Portable executable (
            <code className="text-blue-300">{VIJU_PORTABLE_EXE_FILENAME}</code>).
          </p>
          <pre className="p-4 rounded-lg bg-[#090D16] border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
            {`cd electron-desktop

# 1. Install dependencies (Electron 35 + electron-builder 26)
npm install

# 2. Build both NSIS Setup .EXE and Portable .EXE locally
npm run dist:win

# 3. Or publish directly to GitHub Releases from CLI (requires GH_TOKEN)
npm run release:github`}
          </pre>
          <div className="p-3.5 rounded-lg bg-[#090D16] border border-slate-800 text-xs space-y-1.5">
            <div className="font-semibold text-slate-200">Generated Output Artifacts:</div>
            <div className="font-mono text-emerald-400">
              dist-installer/{VIJU_INSTALLER_EXE_FILENAME} (NSIS Setup Installer)
            </div>
            <div className="font-mono text-blue-400">
              dist-installer/{VIJU_PORTABLE_EXE_FILENAME} (Standalone Portable .EXE)
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Troubleshooting */}
      {activeGuideTab === 'troubleshooting' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title:
                "1. TypeError: Cannot read properties of null (reading 'channel') at computeChannelNames (updateInfoBuilder.ts)",
              cause:
                'When electron-builder v26 runs inside the electron-desktop/ subdirectory with build.publish set to a github provider without owner/repo or a top-level "repository" field in package.json, updateInfoBuilder.ts resolves a null publish config after building the NSIS .exe.',
              fix: 'Set "publish": null in electron-desktop/package.json, add "repository": { "type": "git", "url": "https://github.com/thakorvijay51098/Viju-Browser.git" }, and run npx electron-builder --win --x64 --publish never -c.publish=null (already updated in both package.json and build-windows-exe.yml).',
            },
            {
              title: '2. GitHub Actions workflow fails with 403 Resource not accessible by integration',
              cause: 'Default GITHUB_TOKEN in repository settings has Read-only permissions.',
              fix: 'Our .github/workflows/build-windows-exe.yml explicitly sets "permissions: contents: write" at the workflow level. You can also verify in GitHub Repo -> Settings -> Actions -> General -> Workflow permissions -> Read and write permissions.',
            },
            {
              title: '2. Symbolic link privilege error during electron-builder on Windows',
              cause: 'winCodeSign archive extraction requires privilege to create symlinks on Windows.',
              fix: 'Enable Windows Developer Mode (Settings -> System -> For developers -> Developer Mode: On) or run PowerShell as Administrator when running npm run dist:win.',
            },
            {
              title: '3. WebContentsView bounds overlap the right-hand side panel',
              cause: 'In Electron, WebContentsView is a native Chromium compositor layer rendered above HTML DOM elements.',
              fix: 'main.js automatically insets the active WebContentsView width by 420px via viju:set-side-panel-open IPC whenever a side panel opens.',
            },
            {
              title: '4. Video conferencing (Meet / Zoom / Teams) fails to connect audio/video',
              cause: 'WebRTC Shield blocks non-proxied UDP on untrusted domains.',
              fix: 'Add the domain in the WebRTC Shield Whitelist (meet.google.com, zoom.us, and teams.microsoft.com are whitelisted and enabled by default).',
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
