import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, CheckCircle2, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { consentExpiresAt, findCandidateDuplicates, normalizeUploadedCandidate } from '../services/CandidateRecordService';
import { talentAttractionService } from '../services/TalentAttractionService';
import type { UploadedCandidate } from '../types';

const CampaignLandingPage: React.FC = () => {
  const { campaignId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const { jobs, internalCandidates, pastCandidates, uploadedCandidates, setUploadedCandidates } = useData();
  const { showToast } = useToast();
  const campaign = talentAttractionService.getCampaign(activeOrganization.organizationId, campaignId);
  const brand = talentAttractionService.getBrand(activeOrganization.organizationId);
  const job = jobs.find((item) => item.id === campaign?.jobId);
  const existingCandidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', location: campaign?.location ?? '', consent: false });
  const [error, setError] = useState('');
  const [savedCandidateId, setSavedCandidateId] = useState('');

  useEffect(() => {
    if (!campaign) return;
    const viewKey = `attraction:view:${campaign.id}`;
    if (!sessionStorage.getItem(viewKey)) {
      talentAttractionService.recordEvent(activeOrganization.organizationId, { campaignId: campaign.id, type: 'landing_view', source: 'qr_landing' });
      sessionStorage.setItem(viewKey, '1');
    }
    if (searchParams.get('source') === 'qr') {
      const scanKey = `attraction:scan:${campaign.id}`;
      if (!sessionStorage.getItem(scanKey)) {
        talentAttractionService.recordEvent(activeOrganization.organizationId, { campaignId: campaign.id, type: 'qr_scan', source: 'qr_landing' });
        sessionStorage.setItem(scanKey, '1');
      }
    }
  }, [activeOrganization.organizationId, campaign, searchParams]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!campaign) return;
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Enter a valid email address.'); return; }
    if (!form.consent) { setError('Consent is required before this profile can be added to the talent community.'); return; }
    const capturedAt = new Date().toISOString();
    const candidate: UploadedCandidate = normalizeUploadedCandidate({
      id: globalThis.crypto?.randomUUID?.() ?? `campaign-${Date.now()}`,
      type: 'uploaded',
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      location: form.location.trim() || campaign.location,
      role: job?.title ?? campaign.targetSkills[0] ?? 'Talent community member',
      skills: campaign.targetSkills,
      summary: `Candidate joined through the ${campaign.name} attraction campaign. Profile enrichment is pending recruiter review.`,
      uploadDate: capturedAt,
      lastActiveAt: capturedAt,
      consent: { status: 'permitted', capturedAt, expiresAt: consentExpiresAt(capturedAt), source: 'candidate' },
      profileStatus: 'partial',
      metadata: { attractionCampaignId: campaign.id, attractionCampaignName: campaign.name, attributionSource: searchParams.get('source') ?? 'landing_page' },
    });
    const duplicates = findCandidateDuplicates(candidate, existingCandidates);
    const exact = duplicates.find((match) => match.confidence === 'exact');
    if (exact) { setError(`A candidate record already uses this contact information: ${exact.candidate.name}. Ask a recruiter to update the existing record.`); return; }
    setUploadedCandidates((current) => [candidate, ...current]);
    talentAttractionService.recordEvent(activeOrganization.organizationId, { campaignId: campaign.id, type: 'lead', source: 'qr_landing', candidateId: candidate.id });
    talentAttractionService.recordEvent(activeOrganization.organizationId, { campaignId: campaign.id, type: 'application', source: 'qr_landing', candidateId: candidate.id, metadata: { consentExpiresAt: candidate.consent?.expiresAt ?? '' } });
    setSavedCandidateId(candidate.id);
    showToast('Candidate record created with 28-day consent.', 'success');
  };

  if (!campaign) return <State title="Campaign not found" detail="This campaign link is unavailable in the current workspace." />;
  if (!['approved', 'active'].includes(campaign.status)) return <State title="Campaign is not live" detail="A manager must approve this campaign before candidate intake opens." />;
  if (savedCandidateId) return <div className="mx-auto max-w-2xl py-16"><section className="rounded-3xl border border-emerald-400/30 bg-slate-800 p-10 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" /><h1 className="mt-4 text-3xl font-bold text-white">You are in the talent community</h1><p className="mt-3 text-slate-300">Your consent is valid for 28 days. A recruiter can now review and enrich your profile.</p><button type="button" onClick={() => navigate(`/candidates/${savedCandidateId}`)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 font-bold text-white">Open candidate record <ArrowRight className="h-4 w-4" /></button></section></div>;

  return <div className="mx-auto grid max-w-5xl gap-6 py-8 lg:grid-cols-[1.05fr_.95fr]">
    <section className="rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-800 to-pink-950 p-7 sm:p-9">
      <p className="text-sm font-bold text-pink-300">{brand.organizationName} talent community</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight text-white">{campaign.name}</h1>
      <p className="mt-4 text-base leading-7 text-slate-300">{campaign.objective}</p>
      {campaign.location && <p className="mt-5 flex items-center gap-2 text-sm text-slate-300"><MapPin className="h-4 w-4 text-sky-300" />{campaign.location}</p>}
      <div className="mt-6 flex flex-wrap gap-2">{campaign.targetSkills.map((skill) => <span key={skill} className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">{skill}</span>)}</div>
      <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-950/30 p-4"><p className="flex items-center gap-2 font-bold text-white"><Sparkles className="h-4 w-4 text-pink-300" />What happens next</p><p className="mt-2 text-sm leading-6 text-slate-400">We create a structured candidate record tagged to this campaign. A recruiter reviews it before any hiring decision.</p></div>
    </section>
    <form onSubmit={submit} className="rounded-3xl border border-slate-700 bg-slate-800 p-7 sm:p-9">
      <div className="flex items-center gap-2 text-emerald-300"><BadgeCheck className="h-5 w-5" /><p className="font-bold">Fast expression of interest</p></div>
      <h2 className="mt-2 text-2xl font-bold text-white">Join this opportunity</h2>
      <div className="mt-6 space-y-4"><Field label="Full name" value={form.name} onChange={(name) => setForm({ ...form, name })} /><Field label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} /><Field label="Phone (optional)" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} /><Field label="Location" value={form.location} onChange={(location) => setForm({ ...form, location })} /></div>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/35 p-4"><input type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} className="mt-1 h-4 w-4" /><span className="text-sm leading-6 text-slate-300">I consent to my profile being stored and used for relevant recruiting contact for 28 days. I can opt out at any time.</span></label>
      {error && <p className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      <button type="submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-3 font-bold text-white">Create my candidate record <ArrowRight className="h-4 w-4" /></button>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{brand.legalDisclaimer}</p>
    </form>
  </div>;
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => <label className="block text-xs font-bold text-slate-400">{label}<input required={label === 'Full name' || label === 'Email'} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-pink-400" /></label>;
const State: React.FC<{ title: string; detail: string }> = ({ title, detail }) => <div className="mx-auto max-w-xl py-20 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-slate-500" /><h1 className="mt-4 text-2xl font-bold text-white">{title}</h1><p className="mt-2 text-slate-400">{detail}</p></div>;

export default CampaignLandingPage;
