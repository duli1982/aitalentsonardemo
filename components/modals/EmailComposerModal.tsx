import React, { useEffect, useMemo, useState } from 'react';
import { X, Mail, Copy, ExternalLink, Sparkles } from 'lucide-react';
import type { Candidate, Job } from '../../types';
import type { RecruitingScorecardRecord } from '../../services/RecruitingScorecardService';
import type { ScreeningResult } from '../../services/AutonomousScreeningAgent';
import type { DecisionArtifactRecord } from '../../services/DecisionArtifactService';
import type { PipelineEventRecord } from '../../services/PipelineEventService';
import { aiService } from '../../services/AIService';
import { TIMING } from '../../config/timing';

type EmailPurpose = 'outreach' | 'follow_up' | 'interview_invitation' | 'rejection' | 'offer' | 'thank_you';

interface EmailComposerModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidate: Candidate;
    job: Job;
    scorecard?: RecruitingScorecardRecord;
    latestScreening?: ScreeningResult;
    latestShortlist?: DecisionArtifactRecord;
    pipelineEvents?: PipelineEventRecord[];
}

type IncludeKey = 'scorecard' | 'screening_summary' | 'pipeline_stage' | 'shortlist_summary';

function formatDateTime(value?: string | Date): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
}

function safePercent(value: number | undefined): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    return `${Math.round(value)}%`;
}

function decisionToHuman(decision?: string): string {
    if (!decision) return '';
    return decision.replace(/_/g, ' ');
}

function buildFacts(params: {
    candidate: Candidate;
    job: Job;
    scorecard?: RecruitingScorecardRecord;
    latestScreening?: ScreeningResult;
    latestShortlist?: DecisionArtifactRecord;
    pipelineEvents?: PipelineEventRecord[];
    includes: Record<IncludeKey, boolean>;
}): string[] {
    const { candidate, job, scorecard, latestScreening, latestShortlist, pipelineEvents, includes } = params;
    const facts: string[] = [];

    facts.push(`Candidate: ${candidate.name}${candidate.location ? ` (${candidate.location})` : ''}`);
    facts.push(`Role: ${job.title}${job.department ? `, ${job.department}` : ''}${job.location ? ` — ${job.location}` : ''}`);

    if (includes.scorecard && scorecard) {
        facts.push(`Recruiting scorecard: ${safePercent(scorecard.overallScore)} (confidence: ${Math.round((scorecard.confidence ?? 0) * 100)}%).`);
    }

    if (includes.shortlist_summary && latestShortlist?.summary) {
        facts.push(`Shortlist analysis: ${decisionToHuman(latestShortlist.decision)}${typeof latestShortlist.score === 'number' ? ` (${latestShortlist.score}/100)` : ''}.`);
        facts.push(`Shortlist summary: ${latestShortlist.summary}`);
    }

    if (includes.screening_summary && latestScreening) {
        facts.push(`Latest screening: ${decisionToHuman(latestScreening.recommendation)} (${latestScreening.score}/100) on ${formatDateTime(latestScreening.screenedAt)}.`);
        if (latestScreening.summary) facts.push(`Screening summary: ${latestScreening.summary}`);
    }

    if (includes.pipeline_stage && pipelineEvents && pipelineEvents.length > 0) {
        const lastMove = pipelineEvents.find((e) => e.eventType === 'STAGE_MOVED' && e.toStage) ?? pipelineEvents[0];
        if (lastMove?.toStage) {
            facts.push(`Current pipeline stage: ${lastMove.toStage} (updated ${formatDateTime(lastMove.createdAt)}).`);
        }
    }

    return facts;
}

function defaultPurpose(params: { latestScreening?: ScreeningResult; latestShortlist?: DecisionArtifactRecord }): EmailPurpose {
    const screeningDecision = params.latestScreening?.recommendation;
    if (screeningDecision === 'FAIL') return 'rejection';
    if (screeningDecision === 'PASS' || screeningDecision === 'STRONG_PASS' || screeningDecision === 'BORDERLINE') return 'interview_invitation';
    if (params.latestShortlist?.decision === 'FAIL' || params.latestShortlist?.decision === 'REJECTED') return 'rejection';
    return 'outreach';
}

function buildDraft(params: {
    purpose: EmailPurpose;
    candidate: Candidate;
    job: Job;
    facts: string[];
    additionalContext: string;
}): { subject: string; body: string } {
    const { purpose, candidate, job, facts, additionalContext } = params;

    const greeting = `Hi ${candidate.name?.split(' ')[0] || 'there'},`;
    const closing = `\n\nBest regards,\nRecruiting Team`;
    const contextLine = additionalContext.trim() ? `\n\nAdditional context:\n${additionalContext.trim()}` : '';

    const shortWhy = facts
        .filter((f) => f.toLowerCase().includes('shortlist summary:') || f.toLowerCase().includes('screening summary:'))
        .slice(0, 1)
        .map((f) => f.replace(/^Shortlist summary:\s*/i, '').replace(/^Screening summary:\s*/i, ''))
        .join('\n');

    switch (purpose) {
        case 'interview_invitation': {
            const subject = `Next steps for ${job.title}`;
            const body =
                `${greeting}\n\n` +
                `Thanks again for your time so far. We’d love to move forward with the next step for the ${job.title} role.\n\n` +
                (shortWhy ? `Quick note from our review:\n${shortWhy}\n\n` : '') +
                `Are you available this week for a short call? If you share a couple of time windows, we’ll coordinate the invite.\n` +
                contextLine +
                closing;
            return { subject, body };
        }
        case 'rejection': {
            const subject = `Update on ${job.title}`;
            const body =
                `${greeting}\n\n` +
                `Thank you for taking the time to speak with us and for your interest in the ${job.title} role.\n\n` +
                `After careful consideration, we won’t be moving forward at this stage. This decision is specific to our current needs and timing, and we truly appreciate your effort.\n\n` +
                `If you’d like, we can keep your profile in mind for future opportunities that are a closer match.\n` +
                contextLine +
                closing;
            return { subject, body };
        }
        case 'follow_up': {
            const subject = `Following up on ${job.title}`;
            const body =
                `${greeting}\n\n` +
                `Just following up regarding the ${job.title} role. If you’re still interested, I’d love to align on next steps.\n\n` +
                `Would you be open to a quick chat this week?` +
                contextLine +
                closing;
            return { subject, body };
        }
        case 'offer': {
            const subject = `Offer: ${job.title}`;
            const body =
                `${greeting}\n\n` +
                `We’re excited to share that we’d like to extend an offer for the ${job.title} role.\n\n` +
                `If you’re available, we can walk through details (compensation, start date, and any questions) on a short call.\n` +
                contextLine +
                closing;
            return { subject, body };
        }
        case 'thank_you': {
            const subject = `Thank you`;
            const body =
                `${greeting}\n\n` +
                `Thank you again for your time and for the conversation about the ${job.title} role.\n\n` +
                `If anything changes on your side, feel free to reply here. We’ll be in touch soon with next steps.\n` +
                contextLine +
                closing;
            return { subject, body };
        }
        case 'outreach':
        default: {
            const subject = `${job.title} opportunity`;
            const body =
                `${greeting}\n\n` +
                `I came across your profile and thought you could be a strong fit for our ${job.title} role.\n\n` +
                (shortWhy ? `What stood out:\n${shortWhy}\n\n` : '') +
                `If you’re open to it, I’d love to share more details and hear what you’re looking for. Would you be available for a quick chat?` +
                contextLine +
                closing;
            return { subject, body };
        }
    }
}

function buildMailtoLink(params: { to: string; subject: string; body: string }): string {
    const subject = encodeURIComponent(params.subject);
    const body = encodeURIComponent(params.body);
    return `mailto:${encodeURIComponent(params.to)}?subject=${subject}&body=${body}`;
}

const EmailComposerModal: React.FC<EmailComposerModalProps> = ({
    isOpen,
    onClose,
    candidate,
    job,
    scorecard,
    latestScreening,
    latestShortlist,
    pipelineEvents = []
}) => {
    const [purpose, setPurpose] = useState<EmailPurpose>(() => defaultPurpose({ latestScreening, latestShortlist }));
    const [includes, setIncludes] = useState<Record<IncludeKey, boolean>>({
        scorecard: Boolean(scorecard),
        screening_summary: Boolean(latestScreening),
        shortlist_summary: Boolean(latestShortlist?.summary),
        pipeline_stage: pipelineEvents.length > 0
    });
    const [additionalContext, setAdditionalContext] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [copied, setCopied] = useState(false);
    const [isPolishing, setIsPolishing] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const eventsForJob = useMemo(() => pipelineEvents.filter((e) => e.jobId === job.id), [pipelineEvents, job.id]);

    const facts = useMemo(
        () =>
            buildFacts({
                candidate,
                job,
                scorecard,
                latestScreening,
                latestShortlist,
                pipelineEvents: eventsForJob,
                includes
            }),
        [candidate, job, scorecard, latestScreening, latestShortlist, eventsForJob, includes]
    );

    useEffect(() => {
        if (!isOpen) return;
        const next = buildDraft({ purpose, candidate, job, facts, additionalContext });
        setSubject(next.subject);
        setBody(next.body);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, purpose, candidate.id, job.id, JSON.stringify(facts), additionalContext]);

    useEffect(() => {
        if (!isOpen) return;
        setPurpose(defaultPurpose({ latestScreening, latestShortlist }));
        setIncludes({
            scorecard: Boolean(scorecard),
            screening_summary: Boolean(latestScreening),
            shortlist_summary: Boolean(latestShortlist?.summary),
            pipeline_stage: pipelineEvents.length > 0
        });
        setAdditionalContext('');
        setCopied(false);
        setShowAdvanced(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, candidate.id, job.id]);

    const handleToggleInclude = (key: IncludeKey) => {
        setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleCopy = async () => {
        const full = `Subject: ${subject}\n\n${body}`;
        try {
            await navigator.clipboard.writeText(full);
            setCopied(true);
            setTimeout(() => setCopied(false), TIMING.CLIPBOARD_COPY_RESET_MS);
        } catch {
            // ignore
        }
    };

    const handlePolish = async () => {
        setIsPolishing(true);
        try {
            const prompt =
                `Rewrite the email below to be friendly, empathetic, and to-the-point for a recruiter. ` +
                `Keep it concise. Do not mention AI. Return ONLY the email body.\n\n` +
                `Context facts:\n- ${facts.join('\n- ')}\n\n` +
                `Current email:\n${body}`;

            const result = await aiService.generateText(prompt);
            if (result.success && result.data) {
                setBody(result.data);
            }
        } finally {
            setIsPolishing(false);
        }
    };

    if (!isOpen) return null;

    const mailto = buildMailtoLink({ to: candidate.email || '', subject, body });

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110]" onClick={onClose}>
            <div
                className="bg-slate-900 shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Mail className="text-sky-400" />
                            Compose Email
                        </h2>
                        <p className="text-gray-400 mt-1">
                            {candidate.name} • {job.title}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-grow overflow-auto custom-scrollbar p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-400 mb-1">To</label>
                            <div className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                                {candidate.email || 'No email on record'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1">Purpose</label>
                            <select
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value as EmailPurpose)}
                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                            >
                                <option value="outreach">Outreach</option>
                                <option value="follow_up">Follow-up</option>
                                <option value="interview_invitation">Interview Invitation</option>
                                <option value="rejection">Rejection</option>
                                <option value="offer">Offer</option>
                                <option value="thank_you">Thank You</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-gray-400 mb-2">What we’re using</label>
                            <button
                                className="text-xs text-slate-300 hover:text-white"
                                onClick={() => setShowAdvanced((prev) => !prev)}
                            >
                                {showAdvanced ? 'Hide advanced' : 'Advanced'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => handleToggleInclude('scorecard')}
                                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                    includes.scorecard ? 'bg-sky-500/15 text-sky-200 border-sky-500/40' : 'bg-slate-800/40 text-slate-300 border-slate-700'
                                }`}
                            >
                                Latest scorecard
                            </button>
                            <button
                                type="button"
                                onClick={() => handleToggleInclude('screening_summary')}
                                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                    includes.screening_summary ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' : 'bg-slate-800/40 text-slate-300 border-slate-700'
                                }`}
                            >
                                Screening summary
                            </button>
                            <button
                                type="button"
                                onClick={() => handleToggleInclude('shortlist_summary')}
                                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                    includes.shortlist_summary ? 'bg-purple-500/15 text-purple-200 border-purple-500/40' : 'bg-slate-800/40 text-slate-300 border-slate-700'
                                }`}
                            >
                                Shortlist notes
                            </button>
                            <button
                                type="button"
                                onClick={() => handleToggleInclude('pipeline_stage')}
                                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                    includes.pipeline_stage ? 'bg-amber-500/15 text-amber-200 border-amber-500/40' : 'bg-slate-800/40 text-slate-300 border-slate-700'
                                }`}
                            >
                                Pipeline stage
                            </button>
                        </div>

                        {showAdvanced && (
                            <div className="mt-3 bg-slate-800/30 border border-slate-700 rounded-lg p-3">
                                <div className="text-xs text-slate-300 mb-2">Facts (preview)</div>
                                <pre className="text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">{facts.map((f) => `• ${f}`).join('\n')}</pre>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Subject</label>
                        <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Message</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={10}
                            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Personalize (optional)</label>
                        <textarea
                            value={additionalContext}
                            onChange={(e) => setAdditionalContext(e.target.value)}
                            rows={3}
                            placeholder="Add any specific detail you want included (e.g., availability, salary range, location constraints)…"
                            className="w-full px-3 py-2 bg-slate-900/40 border border-slate-700 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500 resize-none"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        Uses saved screening/scorecard signals when available
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCopy}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Copy size={16} />
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        <a
                            href={mailto}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                            <ExternalLink size={16} />
                            Open Email
                        </a>
                        <button
                            onClick={handlePolish}
                            disabled={isPolishing}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 disabled:opacity-60 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                        >
                            <Sparkles size={16} />
                            {isPolishing ? 'Polishing…' : 'Polish'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailComposerModal;
