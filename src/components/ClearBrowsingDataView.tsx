import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import {
  BrowserDataClearOptions,
  CacheStorageMetrics,
  ClearBrowsingDataPayload,
  ClearTimeRange,
  DownloadItem,
  FormAutofillEntry,
  HistoryEntry,
  SavedPasswordEntry,
  WebDataClearOptions,
} from '../types/browser';
import {
  CLEAR_TIME_RANGES,
  createDefaultClearBrowsingDataPayload,
} from '../utils/browserEngine';

interface ClearBrowsingDataViewProps {
  cacheMetrics: CacheStorageMetrics;
  history: HistoryEntry[];
  downloads: DownloadItem[];
  formDataEntries: FormAutofillEntry[];
  savedPasswords: SavedPasswordEntry[];
  onExecuteClearData: (payload: ClearBrowsingDataPayload) => {
    success: boolean;
    message: string;
    details: string[];
  };
  onAddSampleFormEntry?: () => void;
}

const WEB_DATA_ITEMS: {
  key: keyof WebDataClearOptions;
  label: string;
  apiNote: string;
  getMetric: (m: CacheStorageMetrics) => string;
}[] = [
  {
    key: 'appCache',
    label: 'App Cache',
    apiNote: 'Legacy Chromium appcache (handled gracefully)',
    getMetric: (m) => `${m.appCacheKB} KB`,
  },
  {
    key: 'cache',
    label: 'Cache',
    apiNote: 'session.clearCache()',
    getMetric: (m) => `${m.cacheMB.toFixed(1)} MB`,
  },
  {
    key: 'cacheStorage',
    label: 'Cache Storage',
    apiNote: 'storages: ["cachestorage"]',
    getMetric: (m) => `${m.cacheStorageMB.toFixed(1)} MB`,
  },
  {
    key: 'cookies',
    label: 'Cookies',
    apiNote: 'storages: ["cookies"]',
    getMetric: (m) => `${m.cookiesCount} cookies`,
  },
  {
    key: 'fileSystems',
    label: 'File Systems',
    apiNote: 'storages: ["filesystem"]',
    getMetric: (m) => `${m.fileSystemsKB} KB`,
  },
  {
    key: 'indexedDB',
    label: 'IndexedDB',
    apiNote: 'storages: ["indexdb"]',
    getMetric: (m) => `${m.indexedDBKB} KB`,
  },
  {
    key: 'localStorage',
    label: 'Local Storage',
    apiNote: 'storages: ["localstorage"]',
    getMetric: (m) => `${m.localStorageKB} KB`,
  },
  {
    key: 'serviceWorkers',
    label: 'Service Workers',
    apiNote: 'storages: ["serviceworkers"]',
    getMetric: (m) => `${m.serviceWorkersCount} workers`,
  },
  {
    key: 'webSQL',
    label: 'WebSQL',
    apiNote: 'storages: ["websql"] (graceful fallback)',
    getMetric: (m) => `${m.webSQLKB} KB`,
  },
];

export const ClearBrowsingDataView: React.FC<ClearBrowsingDataViewProps> = ({
  cacheMetrics,
  history,
  downloads,
  formDataEntries,
  savedPasswords,
  onExecuteClearData,
  onAddSampleFormEntry,
}) => {
  const defaultState = createDefaultClearBrowsingDataPayload();
  const [timeRange, setTimeRange] = useState<ClearTimeRange>(defaultState.timeRange);
  const [webData, setWebData] = useState<WebDataClearOptions>(defaultState.webData);
  const [browserData, setBrowserData] = useState<BrowserDataClearOptions>(
    defaultState.browserData
  );
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [resultFeedback, setResultFeedback] = useState<{
    success: boolean;
    message: string;
    details: string[];
  } | null>(null);

  const toggleWebDataItem = (key: keyof WebDataClearOptions) => {
    setWebData((prev) => ({ ...prev, [key]: !prev[key] }));
    setResultFeedback(null);
  };

  const toggleBrowserDataItem = (key: keyof BrowserDataClearOptions) => {
    setBrowserData((prev) => ({ ...prev, [key]: !prev[key] }));
    setResultFeedback(null);
  };

  const setAllWebData = (checked: boolean) => {
    setWebData({
      appCache: checked,
      cache: checked,
      cacheStorage: checked,
      cookies: checked,
      fileSystems: checked,
      indexedDB: checked,
      localStorage: checked,
      serviceWorkers: checked,
      webSQL: checked,
    });
    setResultFeedback(null);
  };

  const setAllBrowserData = (checked: boolean) => {
    setBrowserData({
      downloads: checked,
      formData: checked,
      history: checked,
      passwords: checked,
    });
    setResultFeedback(null);
  };

  const selectedWebCount = Object.values(webData).filter(Boolean).length;
  const selectedBrowserCount = Object.values(browserData).filter(Boolean).length;
  const totalSelectedCount = selectedWebCount + selectedBrowserCount;

  const selectedTimeRangeLabel =
    CLEAR_TIME_RANGES.find((r) => r.id === timeRange)?.label || 'Everything';

  const handleConfirmClear = () => {
    const res = onExecuteClearData({
      timeRange,
      webData,
      browserData,
    });
    setShowConfirmStep(false);
    setResultFeedback(res);
  };

  return (
    <div className="space-y-4 text-xs text-slate-200">
      {/* Time Range Section */}
      <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="clear-time-range-select"
            className="flex items-center gap-1.5 font-semibold text-slate-100"
          >
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Time Range</span>
          </label>
          <span className="text-[11px] font-mono text-blue-400">
            {selectedTimeRangeLabel}
          </span>
        </div>

        <select
          id="clear-time-range-select"
          aria-label="Time Range"
          value={timeRange}
          onChange={(e) => {
            setTimeRange(e.target.value as ClearTimeRange);
            setResultFeedback(null);
          }}
          className="w-full bg-[#111827] border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-medium text-slate-100 focus:outline-none"
        >
          {CLEAR_TIME_RANGES.map((range) => (
            <option key={range.id} value={range.id}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {/* Web Data Section (9 Checkboxes - All Checked by Default) */}
      <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-slate-100">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Web Data ({selectedWebCount}/9)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setAllWebData(true)}
              className="text-blue-400 hover:text-blue-300"
            >
              All
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => setAllWebData(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              None
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5 pt-1">
          {WEB_DATA_ITEMS.map((item) => (
            <label
              key={item.key}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                webData[item.key]
                  ? 'bg-[#111827] border-slate-700/90 text-slate-100'
                  : 'bg-[#090D16] border-slate-800/70 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  checked={webData[item.key]}
                  onChange={() => toggleWebDataItem(item.key)}
                  className="w-3.5 h-3.5 accent-blue-500 rounded shrink-0"
                />
                <span className="font-medium truncate">{item.label}</span>
              </div>
              <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0 ml-2">
                {item.getMetric(cacheMetrics)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Browser Data Section (4 Checkboxes - All Checked by Default) */}
      <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-slate-100">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Browser Data ({selectedBrowserCount}/4)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setAllBrowserData(true)}
              className="text-blue-400 hover:text-blue-300"
            >
              All
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => setAllBrowserData(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              None
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5 pt-1">
          {/* Downloads */}
          <label
            className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
              browserData.downloads
                ? 'bg-[#111827] border-slate-700/90 text-slate-100'
                : 'bg-[#090D16] border-slate-800/70 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={browserData.downloads}
                onChange={() => toggleBrowserDataItem('downloads')}
                className="w-3.5 h-3.5 accent-blue-500 rounded shrink-0"
              />
              <span className="font-medium">Downloads</span>
            </div>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {downloads.length} items
            </span>
          </label>

          {/* Form Data */}
          <label
            className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
              browserData.formData
                ? 'bg-[#111827] border-slate-700/90 text-slate-100'
                : 'bg-[#090D16] border-slate-800/70 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={browserData.formData}
                onChange={() => toggleBrowserDataItem('formData')}
                className="w-3.5 h-3.5 accent-blue-500 rounded shrink-0"
              />
              <span className="font-medium">Form Data</span>
            </div>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {formDataEntries.length} saved entries
            </span>
          </label>

          {/* History */}
          <label
            className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
              browserData.history
                ? 'bg-[#111827] border-slate-700/90 text-slate-100'
                : 'bg-[#090D16] border-slate-800/70 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={browserData.history}
                onChange={() => toggleBrowserDataItem('history')}
                className="w-3.5 h-3.5 accent-blue-500 rounded shrink-0"
              />
              <span className="font-medium">History</span>
            </div>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {history.length} visits
            </span>
          </label>

          {/* Passwords */}
          <label
            className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
              browserData.passwords
                ? 'bg-[#111827] border-slate-700/90 text-slate-100'
                : 'bg-[#090D16] border-slate-800/70 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={browserData.passwords}
                onChange={() => toggleBrowserDataItem('passwords')}
                className="w-3.5 h-3.5 accent-blue-500 rounded shrink-0"
              />
              <span className="font-medium">Passwords</span>
            </div>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {savedPasswords.length} credentials
            </span>
          </label>
        </div>

        {onAddSampleFormEntry && (
          <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Autofill & History records are time-indexed.</span>
            <button
              type="button"
              onClick={onAddSampleFormEntry}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
            >
              <Plus className="w-3 h-3" />
              <span>Add Test Form Entry</span>
            </button>
          </div>
        )}
      </div>

      {/* Action & Confirmation Step */}
      {!showConfirmStep ? (
        <button
          type="button"
          disabled={totalSelectedCount === 0}
          onClick={() => {
            setResultFeedback(null);
            setShowConfirmStep(true);
          }}
          className={`w-full py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
            totalSelectedCount === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Data</span>
        </button>
      ) : (
        <div
          role="dialog"
          aria-label="Confirm Clear Browsing Data"
          className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 space-y-3"
        >
          <div className="flex items-start gap-2 text-red-200">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">
                Confirm Clearing {totalSelectedCount} Data Categories ({selectedTimeRangeLabel})
              </div>
              <p className="text-[11px] text-red-200/90 mt-0.5 leading-relaxed">
                This will permanently clear the selected Web Data ({selectedWebCount}) and
                Browser Data ({selectedBrowserCount}) for time range{' '}
                <strong>{selectedTimeRangeLabel}</strong>. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmClear}
              className="flex-1 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
            >
              Confirm & Clear Data
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmStep(false)}
              className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success / Status Message */}
      {resultFeedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border space-y-2 ${
            resultFeedback.success
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-start gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{resultFeedback.message}</span>
          </div>
          {resultFeedback.details.length > 0 && (
            <ul className="pl-6 list-disc text-[11px] text-emerald-200/90 space-y-0.5 font-mono">
              {resultFeedback.details.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
