'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, X, FileText, FileSpreadsheet } from 'lucide-react';
import { loadData, saveData, mergeTransactions } from '@/lib/store';
import { parseCSVFile, detectSource } from '@/lib/csvParser';
import { parseScotiaPDF, detectScotiaType } from '@/lib/pdfParser';
import { DataSource } from '@/lib/types';
import Papa from 'papaparse';

interface QueuedFile {
  file: File;
  source: DataSource;
  accountName: string;
  fileType: 'csv' | 'pdf';
}

interface UploadResult {
  fileName: string;
  source: DataSource;
  accountName: string;
  count: number;
  errors: string[];
  status: 'success' | 'error' | 'pending';
  detail?: string;
}

const SOURCE_LABELS: Record<DataSource, string> = {
  scotiabank: 'Scotiabank',
  amex: 'American Express',
  wealthsimple: 'Wealthsimple',
  manual: 'Manual',
};

// Extract text from PDF using pdfjs-dist (loaded from CDN)
async function extractPDFText(file: File): Promise<string> {
  // Dynamically load pdf.js from CDN
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
  }

  const pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by their y-position to reconstruct lines
    const items = textContent.items as any[];
    const lineMap: Record<number, { x: number; text: string }[]> = {};

    for (const item of items) {
      const y = Math.round(item.transform[5]); // y position
      const x = Math.round(item.transform[4]); // x position
      const text = item.str;
      if (!text.trim()) continue;

      // Group by approximate y (within 3px)
      let matchedY = y;
      for (const existingY of Object.keys(lineMap).map(Number)) {
        if (Math.abs(existingY - y) < 3) {
          matchedY = existingY;
          break;
        }
      }
      if (!lineMap[matchedY]) lineMap[matchedY] = [];
      lineMap[matchedY].push({ x, text });
    }

    // Sort lines by y descending (PDF y is bottom-up), items by x
    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineItems = lineMap[y].sort((a, b) => a.x - b.x);
      // Reconstruct line with spacing
      let lineText = '';
      let lastX = 0;
      for (const item of lineItems) {
        const gap = item.x - lastX;
        if (lastX > 0 && gap > 15) {
          lineText += '   '; // big gap = column separator
        } else if (lastX > 0 && gap > 4) {
          lineText += ' ';
        }
        lineText += item.text;
        lastX = item.x + item.text.length * 5; // approximate end position
      }
      pages.push(lineText);
    }
    pages.push(''); // page break
  }

  return pages.join('\n');
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const validFiles = incoming.filter(
      (f) => f.name.match(/\.(csv|pdf)$/i)
    );
    setFiles((prev) => [
      ...prev,
      ...validFiles.map((f) => {
        const isPDF = f.name.match(/\.pdf$/i);
        return {
          file: f,
          source: (isPDF ? 'scotiabank' : 'scotiabank') as DataSource,
          accountName: f.name.replace(/\.(csv|pdf)$/i, '').replace(/e-statement/i, 'Scotia Statement'),
          fileType: (isPDF ? 'pdf' : 'csv') as 'csv' | 'pdf',
        };
      }),
    ]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  async function processFiles() {
    if (files.length === 0) return;
    setProcessing(true);
    const data = loadData();
    const newResults: UploadResult[] = [];

    for (const { file, source, accountName, fileType } of files) {
      try {
        if (fileType === 'pdf') {
          // ─── PDF Processing ───
          const text = await extractPDFText(file);
          const result = parseScotiaPDF(text, accountName);

          if (result.count > 0) {
            data.transactions = mergeTransactions(data.transactions, result.transactions);
            newResults.push({
              fileName: file.name,
              source: 'scotiabank',
              accountName,
              count: result.count,
              errors: result.errors,
              status: result.errors.length > 0 ? 'error' : 'success',
              detail: `Detected: ${result.type === 'chequing' ? 'Day-to-Day Banking' : result.type === 'loc' ? 'Line of Credit' : 'Visa Card'}`,
            });
          } else {
            newResults.push({
              fileName: file.name,
              source: 'scotiabank',
              accountName,
              count: 0,
              errors: result.errors.length > 0 ? result.errors : ['No transactions found in PDF'],
              status: 'error',
            });
          }
        } else {
          // ─── CSV Processing ───
          const content = await file.text();

          const previewResult = Papa.parse<Record<string, string>>(content, {
            header: true, preview: 1, skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
          });
          const headers = previewResult.meta.fields || [];
          const detectedSource = source === 'scotiabank' && headers.length > 0 ? detectSource(headers) : source;
          const effectiveSource = source !== 'scotiabank' ? source : detectedSource;

          const result = parseCSVFile(content, effectiveSource, accountName);

          if (result.errors.length === 0 || result.count > 0) {
            data.transactions = mergeTransactions(data.transactions, result.transactions);
            newResults.push({
              fileName: file.name,
              source: effectiveSource,
              accountName,
              count: result.count,
              errors: result.errors,
              status: result.errors.length > 0 ? 'error' : 'success',
            });
          } else {
            newResults.push({
              fileName: file.name,
              source: effectiveSource,
              accountName,
              count: 0,
              errors: result.errors,
              status: 'error',
            });
          }
        }
      } catch (e) {
        newResults.push({
          fileName: file.name,
          source,
          accountName,
          count: 0,
          errors: [`Processing error: ${e}`],
          status: 'error',
        });
      }
    }

    saveData(data);
    setResults(newResults);
    setFiles([]);
    setProcessing(false);
  }

  const totalImported = results.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Import Data</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Upload CSV or PDF statements from Scotiabank, American Express, or Wealthsimple
        </p>
      </div>

      {/* Instructions */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-medium text-text-primary">Supported formats</h2>
        <div className="space-y-2.5 text-sm text-text-secondary">
          <div>
            <span className="text-accent-teal font-medium">Scotiabank PDF:</span> Upload your e-statements directly — supports Chequing, Line of Credit, and Visa cards
          </div>
          <div>
            <span className="text-accent-teal font-medium">American Express CSV:</span> Account → Statements & Activity → Download → CSV
          </div>
          <div>
            <span className="text-accent-teal font-medium">Wealthsimple CSV:</span> Account → Activity → Export transactions → CSV
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-accent-teal bg-accent-teal/5'
            : 'border-border hover:border-accent-teal/50 hover:bg-bg-hover'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.pdf"
          multiple
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files || []))}
        />
        <Upload className={`w-8 h-8 mx-auto mb-3 ${dragging ? 'text-accent-teal' : 'text-text-muted'}`} />
        <p className="text-text-primary text-sm font-medium mb-1">
          {dragging ? 'Drop files here' : 'Drop CSV or PDF files here, or click to browse'}
        </p>
        <p className="text-text-muted text-xs">Supports multiple files at once — CSV and PDF</p>
      </div>

      {/* Queued files */}
      {files.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-medium text-text-primary">Ready to import ({files.length} file{files.length !== 1 ? 's' : ''})</h2>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              {f.fileType === 'pdf' ? (
                <FileText className="w-4 h-4 text-accent-purple flex-shrink-0" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-accent-teal flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm truncate">
                  {f.file.name}
                  <span className="ml-2 text-xs text-text-muted uppercase">{f.fileType}</span>
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {f.fileType === 'csv' ? (
                    <select
                      value={f.source}
                      onChange={(e) => setFiles((prev) => prev.map((x, j) => j === i ? { ...x, source: e.target.value as DataSource } : x))}
                      className="bg-bg-hover border border-border text-text-secondary text-xs rounded px-2 py-1 focus:outline-none focus:border-accent-teal"
                    >
                      <option value="scotiabank">Scotiabank</option>
                      <option value="amex">American Express</option>
                      <option value="wealthsimple">Wealthsimple</option>
                    </select>
                  ) : (
                    <span className="text-xs text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded">Scotiabank PDF — auto-detected</span>
                  )}
                  <input
                    value={f.accountName}
                    onChange={(e) => setFiles((prev) => prev.map((x, j) => j === i ? { ...x, accountName: e.target.value } : x))}
                    placeholder="Account name"
                    className="bg-bg-hover border border-border text-text-secondary text-xs rounded px-2 py-1 focus:outline-none focus:border-accent-teal flex-1"
                  />
                </div>
              </div>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={processFiles}
            disabled={processing}
            className="w-full bg-accent-teal text-bg-primary text-sm font-semibold py-2.5 rounded-lg hover:bg-accent-teal/90 disabled:opacity-50 transition-colors mt-2"
          >
            {processing ? 'Importing...' : `Import ${files.length} File${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">Import Results</h2>
            <span className="text-accent-teal text-xs font-medium">{totalImported} transactions imported</span>
          </div>
          {results.map((r, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              {r.status === 'success' ? (
                <CheckCircle className="w-4 h-4 text-accent-teal flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="text-text-primary text-sm">{r.fileName}</p>
                <p className="text-text-muted text-xs">
                  {SOURCE_LABELS[r.source]} · {r.accountName} · {r.count} transactions
                </p>
                {r.detail && (
                  <p className="text-accent-purple text-xs mt-0.5">{r.detail}</p>
                )}
                {r.errors.length > 0 && (
                  <p className="text-accent-amber text-xs mt-0.5">{r.errors[0]}</p>
                )}
              </div>
            </div>
          ))}
          {totalImported > 0 && (
            <a
              href="/"
              className="block text-center text-accent-teal text-sm hover:underline mt-2"
            >
              View Dashboard →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
