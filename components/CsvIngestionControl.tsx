import React, { useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { ingestCsvCandidates, type CsvIngestionResult } from '../services/CsvIngestionService';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

const CsvIngestionControl: React.FC = () => {
  const { activeOrganization } = useAuth();
  const { setUploadedCandidates } = useData();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<CsvIngestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importFile = async () => {
    if (!file || !activeOrganization) return;
    setIsImporting(true);
    setResult(null);
    setError(null);
    const imported = await ingestCsvCandidates(file, activeOrganization.organizationId);
    setIsImporting(false);
    if (!imported.success) {
      setError(imported.error.message);
      return;
    }
    setUploadedCandidates((current) => [...imported.data.candidates, ...current]);
    setResult(imported.data);
  };

  return (
    <section className="p-6 bg-slate-800 rounded-xl border border-slate-700 max-w-2xl mx-auto my-8">
      <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><FileSpreadsheet className="text-emerald-400" /> CSV candidate import</h2>
      <p className="text-sm text-slate-400 mb-4">Import up to 250 candidates. Required: <code>Name</code> or <code>Full Name</code>. Optional: Email, Phone, Location, Title, Experience Years, Skills, Summary.</p>
      <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full text-sm text-slate-300 file:mr-4 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100" />
      <button type="button" disabled={!file || !activeOrganization || isImporting} onClick={() => void importFile()} className="mt-4 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold flex justify-center items-center gap-2">
        {isImporting ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : <><Upload className="h-4 w-4" /> Import CSV</>}
      </button>
      {!activeOrganization ? <p className="mt-3 text-sm text-amber-300">Select an organization before importing.</p> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {result ? <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm"><p className="text-emerald-300">Imported {result.imported} candidate(s); rejected {result.rejected}.</p>{result.errors.length ? <ul className="mt-2 list-disc pl-5 text-amber-200">{result.errors.map((item, index) => <li key={`${item.row}-${index}`}>Row {item.row}: {item.message}</li>)}</ul> : null}</div> : null}
    </section>
  );
};

export default CsvIngestionControl;
