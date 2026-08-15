import React, { useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, Loader2, RefreshCw } from 'lucide-react';
import { jobIntelligenceService, type ExternalJobPosting, type JobBoardProvider } from '../services/JobIntelligenceService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const JobIntelligenceControl: React.FC<{ onSynced?: (postings: ExternalJobPosting[]) => void }> = ({ onSynced }) => {
  const { activeOrganization } = useAuth();
  const { showToast } = useToast();
  const [provider, setProvider] = useState<JobBoardProvider>('greenhouse');
  const [boardToken, setBoardToken] = useState('');
  const [postings, setPostings] = useState<ExternalJobPosting[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeOrganization) return;
    try { const next = await jobIntelligenceService.list(activeOrganization.organizationId); setPostings(next); onSynced?.(next); } catch { /* The empty state is useful before a source is connected. */ }
  }, [activeOrganization, onSynced]);

  useEffect(() => { void refresh(); }, [refresh]);

  const sync = async () => {
    if (!activeOrganization || !boardToken.trim()) return;
    setIsSyncing(true);
    try {
      const imported = await jobIntelligenceService.sync(activeOrganization.organizationId, provider, boardToken.trim());
      showToast(`Synced ${imported} ${provider} posting(s).`, 'success');
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Job-board sync failed.', 'warning');
    } finally { setIsSyncing(false); }
  };

  return <section className="rounded-xl border border-slate-700 bg-slate-800 p-6">
    <h2 className="text-xl font-bold text-white flex items-center gap-2"><BriefcaseBusiness className="text-cyan-400" /> Greenhouse & Lever job intelligence</h2>
    <p className="text-sm text-slate-400 mt-2">Sync public careers-board postings into this workspace. Enter the board token from the provider URL, not a private API key.</p>
    <div className="mt-4 flex gap-2"><select value={provider} onChange={(event) => setProvider(event.target.value as JobBoardProvider)} className="rounded bg-slate-900 border border-slate-700 px-3 text-white"><option value="greenhouse">Greenhouse</option><option value="lever">Lever</option></select><input value={boardToken} onChange={(event) => setBoardToken(event.target.value)} placeholder={provider === 'greenhouse' ? 'Board token, e.g. acme' : 'Site name, e.g. acme'} className="flex-1 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-white" /><button type="button" disabled={!activeOrganization || !boardToken.trim() || isSyncing} onClick={() => void sync()} className="rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 text-white font-medium">{isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sync'}</button></div>
    <div className="mt-5 flex justify-between items-center"><h3 className="text-sm font-semibold text-slate-200">Recent external postings ({postings.length})</h3><button type="button" onClick={() => void refresh()} className="text-xs text-slate-400 hover:text-white inline-flex gap-1"><RefreshCw className="h-3 w-3" /> Refresh</button></div>
    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">{postings.slice(0, 25).map((posting) => <a key={`${posting.provider}:${posting.external_job_id}`} href={posting.apply_url} target="_blank" rel="noreferrer" className="block rounded border border-slate-700 bg-slate-900/50 p-3 hover:border-cyan-500/50"><div className="flex justify-between gap-2"><span className="text-sm text-white font-medium">{posting.title}</span><span className="text-xs text-cyan-300">{posting.provider}</span></div><p className="text-xs text-slate-400 mt-1">{[posting.department, posting.location].filter(Boolean).join(' • ') || 'Location not listed'}</p></a>)}{postings.length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">No external postings synced yet.</p> : null}</div>
  </section>;
};

export default JobIntelligenceControl;
