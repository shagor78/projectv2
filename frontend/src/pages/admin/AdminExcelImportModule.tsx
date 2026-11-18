import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Play, RefreshCw, Upload } from 'lucide-react';
import { useSiteConfig } from '../../context/SiteConfigContext.tsx';
import { apiFetch, getSessionToken, resolveApiUrl } from '../../services/api.ts';
import { ExcelImportLogRecord, ExcelImportReport } from '../../types/platform.ts';

export function AdminExcelImportModule() {
  const { refreshSiteConfig } = useSiteConfig();
  const [workspaceFile, setWorkspaceFile] = useState<{
    exists: boolean;
    filename: string;
    sizeBytes: number;
    modifiedAt: string | null;
  } | null>(null);
  const [logs, setLogs] = useState<ExcelImportLogRecord[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [lastReport, setLastReport] = useState<ExcelImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    apiFetch<{ workspaceFile: any; logs: ExcelImportLogRecord[] }>('/api/admin/excel/status')
      .then((d) => {
        setWorkspaceFile(d.workspaceFile || null);
        setLogs(d.logs || []);
      })
      .catch((err) => setError(err?.message || 'Failed to load Excel import status'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleWorkspaceImport = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await apiFetch<{ report: ExcelImportReport }>('/api/admin/excel/import-workspace', {
        method: 'POST',
        body: JSON.stringify({ overwriteExisting }),
      });
      setLastReport(res.report);
      load();
      await refreshSiteConfig();
    } catch (err: any) {
      setError(err?.message || 'Workspace Excel import failed');
    } finally {
      setRunning(false);
    }
  };

  const handleUploadImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setRunning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('overwriteExisting', String(overwriteExisting));
      const res = await apiFetch<{ report: ExcelImportReport }>('/api/admin/excel/upload', {
        method: 'POST',
        body: fd,
      });
      setLastReport(res.report);
      setSelectedFile(null);
      load();
      await refreshSiteConfig();
    } catch (err: any) {
      setError(err?.message || 'Uploaded spreadsheet import failed');
    } finally {
      setRunning(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = getSessionToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(resolveApiUrl('/api/admin/excel/template'), {
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('Failed to download Excel template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vexora-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Template download failed');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>
      )}

      {/* Workspace dataexcel.xlsx & Template Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#10141E] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-amber-400" />
              <div>
                <h3 className="font-display text-sm font-bold text-white">Workspace Workbook (dataexcel.xlsx)</h3>
                <p className="text-[11px] text-slate-400">
                  {workspaceFile?.exists
                    ? `Detected · ${(workspaceFile.sizeBytes / 1024).toFixed(1)} KB`
                    : 'Not present at workspace root'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Template .xlsx</span>
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Supports multi-sheet workbooks (<span className="font-mono-num text-amber-300">LiveChannels</span>,{' '}
            <span className="font-mono-num text-amber-300">Movies</span>,{' '}
            <span className="font-mono-num text-amber-300">Drama</span>,{' '}
            <span className="font-mono-num text-amber-300">WebSeries</span>,{' '}
            <span className="font-mono-num text-amber-300">Sports</span>,{' '}
            <span className="font-mono-num text-amber-300">ContentCategories</span>,{' '}
            <span className="font-mono-num text-amber-300">Navigation</span>,{' '}
            <span className="font-mono-num text-amber-300">Pages</span>). Duplicates are skipped safely unless Overwrite is checked.
          </p>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Overwrite existing matching slugs / records</span>
          </label>

          <button
            type="button"
            disabled={running || !workspaceFile?.exists}
            onClick={handleWorkspaceImport}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span>{running ? 'Importing Spreadsheet...' : 'Import Workspace dataexcel.xlsx'}</span>
          </button>
        </div>

        {/* Upload Spreadsheet Card */}
        <form
          onSubmit={handleUploadImport}
          className="rounded-xl border border-white/10 bg-[#10141E] p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-2">
            <h3 className="font-display text-sm font-bold text-white border-b border-white/10 pb-3">
              Upload Custom Excel (.xlsx) or CSV (.csv)
            </h3>
            <p className="text-xs text-slate-400">
              Single-sheet CSV files are mapped automatically using the sheet columns or contentType field.
            </p>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-[#0A0D14] p-6 text-center cursor-pointer hover:border-amber-400/50">
            <Upload className="h-6 w-6 text-amber-400" />
            <span className="text-xs font-semibold text-white">
              {selectedFile ? selectedFile.name : 'Choose .xlsx or .csv file (max 15 MB)'}
            </span>
            <input
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </label>

          <button
            type="submit"
            disabled={running || !selectedFile}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white/15 px-5 text-xs font-bold text-white hover:bg-white/25 disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            <span>{running ? 'Processing File...' : 'Upload & Import Spreadsheet'}</span>
          </button>
        </form>
      </div>

      {/* Live Import Report Summary */}
      {lastReport && (
        <div className="rounded-xl border border-white/10 bg-[#10141E] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h3 className="font-display text-sm font-bold text-white">
              Import Summary — {lastReport.filename}
            </h3>
            <div className="flex flex-wrap gap-3 font-mono-num text-xs">
              <span className="rounded bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
                Inserted: {lastReport.insertedCount}
              </span>
              <span className="rounded bg-sky-500/15 px-2.5 py-1 text-sky-300">
                Updated: {lastReport.updatedCount}
              </span>
              <span className="rounded bg-slate-500/20 px-2.5 py-1 text-slate-300">
                Skipped: {lastReport.skippedCount}
              </span>
              <span className="rounded bg-red-500/15 px-2.5 py-1 text-red-300">
                Errors: {lastReport.errorCount}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(lastReport.perSheet || {}).map(([sheet, stats]) => (
              <div key={sheet} className="rounded-lg border border-white/10 bg-[#0A0D14] p-3 text-xs">
                <p className="font-semibold text-white">{sheet}</p>
                <p className="mt-1 font-mono-num text-[11px] text-slate-400">
                  +{stats.inserted} · ~{stats.updated} · ={stats.skipped} · !{stats.errors}
                </p>
              </div>
            ))}
          </div>

          <div className="max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-[#0A0D14] divide-y divide-white/5 text-xs">
            {lastReport.details.slice(0, 100).map((d, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <span className="font-mono-num text-slate-400 mr-2">
                    [{d.sheet} R{d.row}]
                  </span>
                  <span className="font-semibold text-white">{d.identifier}</span>
                  <span className="ml-2 text-slate-400">— {d.message}</span>
                </div>
                <span
                  className={`shrink-0 font-mono-num uppercase text-[10px] font-bold ${
                    d.action === 'inserted'
                      ? 'text-emerald-400'
                      : d.action === 'updated'
                      ? 'text-sky-400'
                      : d.action === 'error'
                      ? 'text-red-400'
                      : 'text-slate-400'
                  }`}
                >
                  {d.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import History Logs */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10141E]">
        <div className="border-b border-white/10 px-4 py-3">
          <h3 className="font-display text-sm font-bold text-white">Recent Spreadsheet Import Logs</h3>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="p-3">Timestamp</th>
              <th className="p-3">File & Mode</th>
              <th className="p-3">Sheets</th>
              <th className="p-3 text-right">Inserted</th>
              <th className="p-3 text-right">Updated</th>
              <th className="p-3 text-right">Skipped</th>
              <th className="p-3 text-right">Errors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  No Excel/CSV imports recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="p-3 font-mono-num text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <p className="font-semibold text-white">{log.filename}</p>
                    <p className="text-[11px] uppercase text-slate-400">
                      {log.mode} {log.overwriteExisting ? '· overwrite' : '· safe-skip'}
                    </p>
                  </td>
                  <td className="p-3 text-slate-300">{(log.sheetsProcessed || []).join(', ')}</td>
                  <td className="p-3 text-right font-mono-num text-emerald-400">{log.insertedCount}</td>
                  <td className="p-3 text-right font-mono-num text-sky-400">{log.updatedCount}</td>
                  <td className="p-3 text-right font-mono-num text-slate-300">{log.skippedCount}</td>
                  <td className="p-3 text-right font-mono-num text-red-400">{log.errorCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
