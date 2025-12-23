import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Play, Pause, Clock, CheckCircle, AlertCircle, Zap, Link as LinkIcon, FileText, X } from 'lucide-react';
import type { Candidate, Job } from '../types';
import { useData } from '../contexts/DataContext';
import { supabase } from '../services/supabaseClient';
import { autonomousSchedulingAgent, type ScheduledInterview } from '../services/AutonomousSchedulingAgent';
import { autonomousInterviewAgent, type InterviewSession } from '../services/AutonomousInterviewAgent';
import { agentSettingsService } from '../services/AgentSettingsService';

interface AutonomousInterviewControlProps {
    jobs: Job[];
}

const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
};

const formatNextRun = (date: Date | null) => {
    if (!date) return 'Disabled';
    const now = Date.now();
    const next = new Date(date).getTime();
    const diff = next - now;
    if (diff < 0) return 'Running soon...';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
};

const resolveSupabaseCandidateById = async (id: string): Promise<Candidate | null> => {
    if (!supabase) return null;
    try {
        // Prefer system-of-record view (candidate_id is the stable identifier used across the app).
        const viewAttempt = await supabase
            .from('candidate_documents_view')
            .select('candidate_id, name, email, title, location, experience_years, skills, content, document_metadata')
            .eq('candidate_id', id)
            .maybeSingle();

        const legacyAttempt = viewAttempt.error
            ? await supabase
                .from('candidate_documents')
                .select('id, metadata, content')
                .eq('metadata->>id', id)
                .maybeSingle()
            : null;

        const { data, error } = viewAttempt.error ? (legacyAttempt as any) : (viewAttempt as any);

        if (error || !data) return null;
        const metadata = ((data as any).document_metadata || (data as any).metadata) || {};
        const content = typeof (data as any).content === 'string' ? (data as any).content : '';
        const nameFromContent = content.includes(' - ') ? content.split(' - ')[0].trim() : '';

        return {
            id: String((data as any).candidate_id ?? metadata.id ?? (data as any).id),
            name: (data as any).name || metadata.name || metadata.full_name || nameFromContent || 'Unknown',
            email: (data as any).email || metadata.email || '',
            role: (data as any).title || metadata.role || metadata.title || 'Candidate',
            type: 'uploaded' as const,
            skills: Array.isArray((data as any).skills) ? (data as any).skills : Array.isArray(metadata.skills) ? metadata.skills : [],
            location: (data as any).location || metadata.location || '',
            experience: (data as any).experience_years || metadata.experience || 0,
            availability: metadata.availability || '',
            matchScores: {},
            feedback: {}
        } as Candidate;
    } catch {
        return null;
    }
};

const AutonomousInterviewControl: React.FC<AutonomousInterviewControlProps> = ({ jobs }) => {
    const { internalCandidates, pastCandidates, uploadedCandidates } = useData();

    const [status, setStatus] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [speaker, setSpeaker] = useState<'interviewer' | 'candidate'>('interviewer');
    const [lineText, setLineText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const allCandidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
    const sessions = useMemo(() => autonomousInterviewAgent.getSessions(), [status]);

    const upcoming = useMemo(() => autonomousSchedulingAgent.getUpcomingInterviews(), [status]);

    const activeSession = useMemo(() => {
        if (!activeSessionId) return null;
        return autonomousInterviewAgent.getSessionById(activeSessionId) || null;
    }, [activeSessionId, status]);

    useEffect(() => {
        const scheduling = agentSettingsService.getAgent('scheduling');
        const interview = agentSettingsService.getAgent('interview');
        autonomousSchedulingAgent.initialize({ enabled: scheduling.enabled, mode: scheduling.mode });
        autonomousInterviewAgent.initialize({ enabled: interview.enabled, mode: interview.mode });

        const refresh = () => setStatus({
            interview: autonomousInterviewAgent.getStatus(),
            scheduling: autonomousSchedulingAgent.getStatus()
        });
        refresh();
        const interval = setInterval(refresh, 15000);
        return () => clearInterval(interval);
    }, []);

    const toggleAgent = () => {
        const enabled = !!status?.interview?.enabled;
        agentSettingsService.setEnabled('interview', !enabled);
        autonomousInterviewAgent.setEnabled(!enabled);
        setTimeout(() => setStatus({
            interview: autonomousInterviewAgent.getStatus(),
            scheduling: autonomousSchedulingAgent.getStatus()
        }), 100);
    };

    const startFromScheduled = async (interview: ScheduledInterview) => {
        const job = jobs.find((j) => j.id === interview.jobId);
        if (!job) return;

        let candidate = allCandidates.find((c) => c.id === String(interview.candidateId));
        if (!candidate) {
            candidate = await resolveSupabaseCandidateById(String(interview.candidateId)) || undefined;
        }

        if (!candidate) {
            // Fallback candidate shell
            candidate = {
                id: String(interview.candidateId),
                name: interview.candidateName,
                email: '',
                role: 'Candidate',
                type: 'uploaded' as const,
                skills: [],
                location: '',
                experience: 0,
                availability: '',
                matchScores: {},
                feedback: {}
            } as Candidate;
        }

        const session = autonomousInterviewAgent.startSession({ interview, candidate, job });
        setActiveSessionId(session.id);
        setLineText('');
    };

    const handleAddLine = () => {
        if (!activeSessionId) return;
        if (!lineText.trim()) return;

        autonomousInterviewAgent.addTranscriptLine(activeSessionId, {
            speaker,
            text: lineText.trim()
        });
        setLineText('');
        setTimeout(() => setStatus({
            interview: autonomousInterviewAgent.getStatus(),
            scheduling: autonomousSchedulingAgent.getStatus()
        }), 50);
    };

    const startSpeech = () => {
        if (!activeSessionId) return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const last = event.results?.[event.results.length - 1];
            const transcript = last?.[0]?.transcript;
            if (!transcript) return;

            autonomousInterviewAgent.addTranscriptLine(activeSessionId, {
                speaker,
                text: String(transcript).trim()
            });
            setTimeout(() => setStatus({
                interview: autonomousInterviewAgent.getStatus(),
                scheduling: autonomousSchedulingAgent.getStatus()
            }), 50);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    const stopSpeech = () => {
        const r = recognitionRef.current;
        if (r) {
            r.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
    };

    const handleGenerateQuestions = async () => {
        if (!activeSessionId || !activeSession) return;
        setIsRefreshing(true);
        try {
            const candidate = allCandidates.find((c) => c.id === activeSession.candidateId) || await resolveSupabaseCandidateById(activeSession.candidateId);
            const job = jobs.find((j) => j.id === activeSession.jobId);
            if (!job || !candidate) return;
            await autonomousInterviewAgent.generateQuestionSet(activeSessionId, candidate, job);
            setTimeout(() => setStatus({
                interview: autonomousInterviewAgent.getStatus(),
                scheduling: autonomousSchedulingAgent.getStatus()
            }), 100);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleEndSession = async () => {
        if (!activeSessionId) return;
        setIsRefreshing(true);
        try {
            await autonomousInterviewAgent.endSession(activeSessionId);
            setTimeout(() => setStatus({
                interview: autonomousInterviewAgent.getStatus(),
                scheduling: autonomousSchedulingAgent.getStatus()
            }), 150);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (!status) return <div className="text-slate-400">Loading interview agent...</div>;

    const interviewStatus = status.interview;

    return (
        <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${interviewStatus.enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                            <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Autonomous Interview Agent</h3>
                            <p className="text-sm text-slate-400">{interviewStatus.enabled ? 'Monitoring interviews' : 'Paused'}</p>
                        </div>
                    </div>

                    <button
                        onClick={toggleAgent}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                            interviewStatus.enabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                    >
                        {interviewStatus.enabled ? (
                            <>
                                <Pause className="h-4 w-4" />
                                <span>Pause Agent</span>
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4" />
                                <span>Start Agent</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Last Run</span>
                        </div>
                        <p className="text-sm font-semibold text-white">{formatTime(interviewStatus.lastRun)}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Next Run</span>
                        </div>
                        <p className="text-sm font-semibold text-white">{formatNextRun(interviewStatus.nextRun)}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">Sessions</span>
                        </div>
                        <p className="text-lg font-semibold text-white">{interviewStatus.totalSessions}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">Upcoming</span>
                        </div>
                        <p className="text-lg font-semibold text-white">{upcoming.length}</p>
                    </div>
                </div>
            </div>

            {activeSession ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                        <div>
                            <div className="text-lg font-semibold text-white">{activeSession.candidateName}</div>
                            <div className="text-sm text-slate-400">{activeSession.jobTitle}</div>
                            <div className="text-xs text-slate-500 mt-1">Started: {new Date(activeSession.startedAt).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={activeSession.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold inline-flex items-center gap-2"
                            >
                                <LinkIcon className="h-4 w-4" />
                                Join {activeSession.meetingProvider === 'ms_teams' ? 'Teams' : 'Meet'}
                            </a>
                            <button
                                type="button"
                                onClick={() => setActiveSessionId(null)}
                                className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold inline-flex items-center gap-2"
                            >
                                <X className="h-4 w-4" />
                                Close
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-semibold text-white">Key Questions</div>
                                <button
                                    onClick={handleGenerateQuestions}
                                    disabled={isRefreshing}
                                    className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {isRefreshing ? 'Generating...' : 'AI regenerate'}
                                </button>
                            </div>
                            <div className="space-y-2">
                                {activeSession.questions.map((q) => {
                                    const missing = activeSession.missingQuestions.includes(q);
                                    return (
                                        <div key={q} className="flex items-start gap-2 text-sm">
                                            <span className={`mt-0.5 h-2 w-2 rounded-full ${missing ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                            <div className="text-slate-200">{q}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            {activeSession.missingQuestions.length > 0 && (
                                <div className="mt-3 text-xs text-amber-300">
                                    Missing coverage: {activeSession.missingQuestions.length} question{activeSession.missingQuestions.length !== 1 ? 's' : ''}
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                            <div className="text-sm font-semibold text-white mb-3">Transcript</div>
                            <div className="max-h-64 overflow-auto space-y-2 pr-1">
                                {activeSession.transcript.length === 0 ? (
                                    <div className="text-sm text-slate-400">No transcript yet. Add notes or start mic transcription.</div>
                                ) : (
                                    activeSession.transcript.map((t) => (
                                        <div key={t.id} className="text-sm">
                                            <div className="text-[10px] text-slate-500">
                                                {new Date(t.timestamp).toLocaleTimeString()} · {t.speaker}
                                            </div>
                                            <div className="text-slate-200 whitespace-pre-wrap">{t.text}</div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="mt-3 space-y-2">
                                <div className="flex gap-2">
                                    <select
                                        value={speaker}
                                        onChange={(e) => setSpeaker(e.target.value as any)}
                                        className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="interviewer">Interviewer</option>
                                        <option value="candidate">Candidate</option>
                                    </select>
                                    <button
                                        onClick={isListening ? stopSpeech : startSpeech}
                                        disabled={!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)}
                                        className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm inline-flex items-center gap-2 disabled:opacity-60"
                                    >
                                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                        {isListening ? 'Stop mic' : 'Start mic'}
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={lineText}
                                        onChange={(e) => setLineText(e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                                        placeholder="Add note / transcript line..."
                                    />
                                    <button
                                        onClick={handleAddLine}
                                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                                    >
                                        Add
                                    </button>
                                </div>
                                <button
                                    onClick={handleEndSession}
                                    disabled={isRefreshing}
                                    className="w-full px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    <Zap className="h-4 w-4" />
                                    {isRefreshing ? 'Generating...' : 'End & generate debrief'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {activeSession.debrief && (
                        <div className="mt-4 bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                            <div className="text-sm font-semibold text-white mb-2">Debrief</div>
                            <div className="text-sm text-slate-200 whitespace-pre-wrap">{activeSession.debrief.summary}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                <div>
                                    <div className="text-xs text-slate-400 mb-1">Strengths</div>
                                    <ul className="text-sm text-slate-200 list-disc list-inside space-y-1">
                                        {activeSession.debrief.strengths.map((x) => <li key={x}>{x}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400 mb-1">Concerns</div>
                                    <ul className="text-sm text-slate-200 list-disc list-inside space-y-1">
                                        {activeSession.debrief.concerns.map((x) => <li key={x}>{x}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {upcoming.length > 0 && (
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                                <CheckCircle className="h-5 w-5 mr-2 text-emerald-400" />
                                Upcoming Interviews (Next 7 Days)
                            </h4>
                            <div className="space-y-3">
                                {upcoming.map((i) => (
                                    <div key={i.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                            <div>
                                                <div className="font-semibold text-white">{i.candidateName}</div>
                                                <div className="text-sm text-slate-400">
                                                    {i.jobTitle} · {i.interviewType} · {new Date(i.scheduledTime).toLocaleString()}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {i.meetingProvider === 'ms_teams' ? 'MS Teams' : 'Google Meet'}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <a
                                                    href={i.meetingLink}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold inline-flex items-center gap-2"
                                                >
                                                    <LinkIcon className="h-4 w-4" />
                                                    Meeting Link
                                                </a>
                                                <button
                                                    onClick={() => startFromScheduled(i)}
                                                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-2"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                    Start Session
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {sessions.length > 0 && (
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                            <h4 className="text-lg font-semibold text-white mb-4">Recent Sessions</h4>
                            <div className="space-y-3">
                                {sessions.slice(0, 8).map((s: InterviewSession) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setActiveSessionId(s.id)}
                                        className="w-full text-left bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:bg-slate-800/60 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-white font-semibold">{s.candidateName}</div>
                                                <div className="text-sm text-slate-400">{s.jobTitle}</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {new Date(s.startedAt).toLocaleString()} {s.endedAt ? '· completed' : '· in progress'}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {s.meetingProvider === 'ms_teams' ? 'Teams' : 'Meet'}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="h-5 w-5 text-sky-400 mt-0.5" />
                            <div>
                                <h5 className="font-medium text-sky-300 mb-1">How it works</h5>
                                <p className="text-sm text-slate-300">
                                    This demo Interview Agent tracks key questions, captures a transcript (manual or mic speech-to-text when supported),
                                    highlights missed topics, and generates a debrief. For real joining/transcription in Google Meet or MS Teams,
                                    you’d integrate platform APIs and a transcription provider.
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AutonomousInterviewControl;
