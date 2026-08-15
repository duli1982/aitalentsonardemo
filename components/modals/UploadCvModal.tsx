import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSearch, FileText, Loader2, Save, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import type { UploadedCandidate } from '../../types';
import { parseResumeWithAIGateway } from '../../services/AIGatewayClient';
import { consentExpiresAt, findCandidateDuplicates, normalizeUploadedCandidate, parseLanguages, validateCandidateDraft } from '../../services/CandidateRecordService';

interface UploadCvModalProps { onClose: () => void; onUpload?: (candidates: UploadedCandidate[]) => void }
type FileStatus = 'pending' | 'parsing' | 'review' | 'error' | 'saved';
type UploadFile = { id: string; file: File; status: FileStatus; draft?: UploadedCandidate; error?: string; duplicateAcknowledged?: boolean; consentConfirmed?: boolean };
const accepted = ['.txt', '.md', '.pdf', '.docx'];
const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const UploadCvModal: React.FC<UploadCvModalProps> = ({ onClose, onUpload }) => {
  const { showToast } = useToast();
  const { activeOrganization } = useAuth();
  const { internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const existing = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = files.find((item) => item.id === activeId) ?? files.find((item) => item.status === 'review');
  const validation = active?.draft ? validateCandidateDraft(active.draft) : null;
  const duplicates = active?.draft ? findCandidateDuplicates(active.draft, existing) : [];
  const exactDuplicate = duplicates.some((item) => item.confidence === 'exact');

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...list].filter((file) => accepted.some((extension) => file.name.toLowerCase().endsWith(extension))).map((file) => ({ id: id(), file, status: 'pending' as const }));
    setFiles((current) => [...current, ...next]);
    if (next[0]) setActiveId(next[0].id);
  };
  const update = (fileId: string, value: Partial<UploadFile>) => setFiles((current) => current.map((item) => item.id === fileId ? { ...item, ...value } : item));
  const updateDraft = (updates: Partial<UploadedCandidate>) => active?.draft && update(active.id, { draft: { ...active.draft, ...updates } });

  const parseOne = async (item: UploadFile) => {
    update(item.id, { status: 'parsing', error: undefined });
    try {
      const parsed = await parseResumeWithAIGateway({ organizationId: activeOrganization.organizationId, file: item.file });
      const now = new Date().toISOString();
      const draft: UploadedCandidate = normalizeUploadedCandidate({
        id: id(), type: 'uploaded', fileName: item.file.name, uploadDate: now,
        name: parsed.name || item.file.name.replace(/\.[^.]+$/, ''), email: parsed.email, phone: parsed.phone, role: parsed.role,
        location: parsed.location, experienceYears: parsed.experienceYears, skills: parsed.skills ?? [], summary: parsed.summary,
        education: parsed.education ?? [], languages: (parsed.languages ?? []).map((language) => ({ ...language, source: 'resume', verified: false })),
        lastActiveAt: now, consent: { status: 'pending', source: 'import' },
        resumeProvenance: { parser: 'server-ai-gateway', parserVersion: 1, fileName: item.file.name, parsedAt: now, reviewedAt: '', validationIssues: [] },
      });
      update(item.id, { status: 'review', draft });
      setActiveId(item.id);
    } catch (error) { update(item.id, { status: 'error', error: error instanceof Error ? error.message : 'Resume parsing failed.' }); }
  };

  const parsePending = async () => { for (const item of files.filter((value) => value.status === 'pending' || value.status === 'error')) await parseOne(item); };
  const approve = () => {
    if (!active?.draft || !validation?.valid || (exactDuplicate && !active.duplicateAcknowledged)) return;
    const now = new Date().toISOString();
    const candidate = normalizeUploadedCandidate({ ...active.draft,
      lastActiveAt: now,
      consent: active.consentConfirmed ? { status: 'permitted', capturedAt: now, expiresAt: consentExpiresAt(now), source: 'candidate' } : { status: 'pending', source: 'import' },
      resumeProvenance: { ...active.draft.resumeProvenance!, reviewedAt: now, validationIssues: [...validation.errors, ...validation.warnings] },
    });
    onUpload?.([candidate]);
    update(active.id, { status: 'saved', draft: candidate });
    showToast(`${candidate.name} reviewed and added to the candidate record.`, 'success');
    const next = files.find((item) => item.id !== active.id && item.status === 'review');
    setActiveId(next?.id ?? active.id);
  };

  return <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
    <header className="flex items-start justify-between border-b border-slate-700 p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-sky-300">Candidate record foundation</p><h2 className="mt-1 text-2xl font-bold text-white">Parse and review CVs</h2><p className="mt-1 text-sm text-slate-400">Files are parsed through the server AI gateway. Nothing is saved until a recruiter reviews it.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_1fr]"><aside className="border-r border-slate-700 p-4"><input id="candidate-cv-files" type="file" multiple accept=".txt,.md,.pdf,.docx" onChange={(event) => addFiles(event.target.files)} className="hidden" /><label htmlFor="candidate-cv-files" className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-slate-600 p-6 text-center hover:border-sky-400"><UploadCloud className="h-8 w-8 text-sky-300" /><span className="mt-2 font-semibold text-white">Select CV files</span><span className="mt-1 text-xs text-slate-500">PDF, DOCX, TXT or Markdown</span></label><button type="button" disabled={!files.some((item) => item.status === 'pending' || item.status === 'error')} onClick={() => void parsePending()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><FileSearch className="h-4 w-4" />Parse pending files</button><div className="mt-4 space-y-2 overflow-y-auto custom-scrollbar">{files.map((item) => <button key={item.id} type="button" onClick={() => setActiveId(item.id)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${active?.id === item.id ? 'border-sky-400/50 bg-sky-400/10' : 'border-slate-700'}`}><FileText className="h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{item.file.name}</p><p className={`mt-0.5 text-xs ${item.status === 'error' ? 'text-red-300' : item.status === 'saved' ? 'text-emerald-300' : 'text-slate-500'}`}>{item.status === 'parsing' ? 'Parsing through gateway…' : item.status}</p></div>{item.status === 'parsing' && <Loader2 className="h-4 w-4 animate-spin text-sky-300" />}{item.status === 'saved' && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}</button>)}</div></aside>
      <main className="min-h-0 overflow-y-auto p-5 custom-scrollbar">{!active && <State title="Add a CV to begin" detail="The parsed record will appear here for validation." />}{active?.status === 'pending' && <State title="Ready to parse" detail="Run the server-side parser to extract a structured candidate draft." />}{active?.status === 'parsing' && <State loading title="Extracting candidate evidence" detail="The server gateway is parsing the attachment and validating its structured response." />}{active?.status === 'error' && <State title="Parsing failed" detail={active.error ?? 'The file could not be parsed.'} error />}{active?.draft && active.status !== 'saved' && <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-xl font-bold text-white">Recruiter review</h3><p className="mt-1 text-sm text-slate-400">Correct extracted values before approving this candidate.</p></div><div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${validation?.valid ? 'bg-emerald-400/10 text-emerald-200' : 'bg-red-400/10 text-red-200'}`}>{validation?.valid ? 'Structurally valid' : 'Needs correction'}</span><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">AI extracted · recruiter unverified</span></div></div>
        {(validation?.errors.length || validation?.warnings.length) ? <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4"><p className="font-semibold text-amber-200">Validation findings</p><ul className="mt-2 space-y-1 text-sm text-amber-100/80">{[...(validation?.errors ?? []), ...(validation?.warnings ?? [])].map((message) => <li key={message}>• {message}</li>)}</ul></div> : null}
        {duplicates.length > 0 && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4"><p className="flex items-center gap-2 font-bold text-amber-200"><AlertTriangle className="h-4 w-4" />Possible duplicate detected</p>{duplicates.slice(0, 3).map((match) => <p key={match.candidate.id} className="mt-2 text-sm text-amber-100/80">{match.candidate.name}: {match.reasons.join(', ')}</p>)}{exactDuplicate && <label className="mt-3 flex items-center gap-2 text-sm text-amber-100"><input type="checkbox" checked={Boolean(active.duplicateAcknowledged)} onChange={(event) => update(active.id, { duplicateAcknowledged: event.target.checked })} />I reviewed the existing record and intentionally want a separate candidate record.</label>}</div>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name *" value={active.draft.name} onChange={(name) => updateDraft({ name })} /><Field label="Email" type="email" value={active.draft.email ?? ''} onChange={(email) => updateDraft({ email })} /><Field label="Phone" value={active.draft.phone ?? ''} onChange={(phone) => updateDraft({ phone })} /><Field label="Current / recent role" value={active.draft.role ?? ''} onChange={(role) => updateDraft({ role })} /><Field label="Location" value={active.draft.location ?? ''} onChange={(location) => updateDraft({ location })} /><Field label="Experience years" type="number" value={String(active.draft.experienceYears ?? '')} onChange={(value) => updateDraft({ experienceYears: value ? Number(value) : undefined })} /><div className="sm:col-span-2"><Field label="Skills (comma separated)" value={active.draft.skills.join(', ')} onChange={(value) => updateDraft({ skills: value.split(',').map((item) => item.trim()).filter(Boolean) })} /></div><div className="sm:col-span-2"><Field label="Languages (Language:CEFR; Language:CEFR)" value={(active.draft.languages ?? []).map((item) => `${item.language}:${item.level}`).join('; ')} onChange={(value) => updateDraft({ languages: parseLanguages(value, 'resume') })} /></div><label className="sm:col-span-2 text-sm font-medium text-slate-300">Professional summary<textarea rows={4} value={active.draft.summary ?? ''} onChange={(event) => updateDraft({ summary: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white" /></label></div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-4"><input type="checkbox" checked={Boolean(active.consentConfirmed)} onChange={(event) => update(active.id, { consentConfirmed: event.target.checked })} className="mt-1" /><span><span className="flex items-center gap-2 font-semibold text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" />Candidate contact permission confirmed today</span><span className="mt-1 block text-xs leading-5 text-slate-400">Permission expires after 28 days. Leave unchecked when consent evidence is unavailable; outreach will be blocked.</span></span></label>
        <div className="flex justify-end"><button type="button" onClick={approve} disabled={!validation?.valid || (exactDuplicate && !active.duplicateAcknowledged)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Save className="h-4 w-4" />Approve and save candidate</button></div></div>}{active?.status === 'saved' && <State title="Candidate saved" detail="The reviewed record is now available in Talent and Boolean search." success />}</main>
    </div></div></div>;
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => <label className="text-sm font-medium text-slate-300">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white" /></label>;
const State: React.FC<{ title: string; detail: string; loading?: boolean; error?: boolean; success?: boolean }> = ({ title, detail, loading, error, success }) => <div className="flex min-h-80 flex-col items-center justify-center text-center">{loading ? <Loader2 className="h-9 w-9 animate-spin text-sky-300" /> : success ? <CheckCircle2 className="h-9 w-9 text-emerald-300" /> : error ? <AlertTriangle className="h-9 w-9 text-red-300" /> : <FileSearch className="h-9 w-9 text-slate-500" />}<p className="mt-3 font-bold text-white">{title}</p><p className="mt-1 max-w-md text-sm text-slate-400">{detail}</p></div>;
export default UploadCvModal;
