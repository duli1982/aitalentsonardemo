import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Play, Pause, Clock, CheckCircle, AlertCircle, Zap, Link as LinkIcon } from 'lucide-react';
import type { Job } from '../types';
import { autonomousSchedulingAgent, type MeetingProvider, type ScheduledInterview } from '../services/AutonomousSchedulingAgent';
import { agentSettingsService } from '../services/AgentSettingsService';
import { TIMING } from '../config/timing';

interface AutonomousSchedulingControlProps {
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

const buildIcs = (interview: ScheduledInterview) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toUtcStamp = (d: Date) => {
        const x = new Date(d);
        return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`;
    };

    const start = new Date(interview.scheduledTime);
    const end = new Date(start.getTime() + 30 * 60 * 1000); // default 30 min
    const summary = `Interview: ${interview.candidateName} - ${interview.jobTitle}`;
    const description = `Interview type: ${interview.interviewType}\\nMeeting: ${interview.meetingProvider === 'ms_teams' ? 'MS Teams' : 'Google Meet'}\\nLink: ${interview.meetingLink}`;

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Talent Sonar//Scheduling Agent//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${interview.id}@talent-sonar`,
        `DTSTAMP:${toUtcStamp(new Date())}`,
        `DTSTART:${toUtcStamp(start)}`,
        `DTEND:${toUtcStamp(end)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `URL:${interview.meetingLink}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
};

const downloadIcs = (interview: ScheduledInterview) => {
    const content = buildIcs(interview);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${interview.candidateName.replace(/\s+/g, '_')}_${interview.jobTitle.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

const AutonomousSchedulingControl: React.FC<AutonomousSchedulingControlProps> = ({ jobs }) => {
    const [status, setStatus] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [meetingProvider, setMeetingProvider] = useState<MeetingProvider>('google_meet');

    const [candidateName, setCandidateName] = useState('');
    const [candidateEmail, setCandidateEmail] = useState('');
    const [jobId, setJobId] = useState<string>('');
    const [interviewType, setInterviewType] = useState<'phone' | 'video' | 'onsite'>('video');
    const [rescheduleForInterviewId, setRescheduleForInterviewId] = useState<string | null>(null);
    const [rescheduleRequestedBy, setRescheduleRequestedBy] = useState<'candidate' | 'hiring_manager'>('candidate');
    const [rescheduleReason, setRescheduleReason] = useState('');

    const upcoming = useMemo(() => autonomousSchedulingAgent.getUpcomingInterviews(), [status]);

    useEffect(() => {
        const settings = agentSettingsService.getAgent('scheduling');
        autonomousSchedulingAgent.initialize({ enabled: settings.enabled, mode: settings.mode });
        setMeetingProvider(autonomousSchedulingAgent.getMeetingProvider());
        const refresh = () => setStatus(autonomousSchedulingAgent.getStatus());
        refresh();
        const interval = setInterval(refresh, TIMING.SCHEDULING_CONTROL_REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!jobId && jobs.length > 0) setJobId(jobs[0].id);
    }, [jobId, jobs]);

    const handleToggle = () => {
        const newState = !status?.enabled;
        agentSettingsService.setEnabled('scheduling', newState);
        autonomousSchedulingAgent.setEnabled(newState);
        setTimeout(() => setStatus(autonomousSchedulingAgent.getStatus()), TIMING.UI_DELAY_MS);
    };

    const handleManualRun = async () => {
        setIsRefreshing(true);
        try {
            await autonomousSchedulingAgent.triggerProcessing();
            setTimeout(() => setStatus(autonomousSchedulingAgent.getStatus()), TIMING.MEDIUM_UI_DELAY_MS);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSubmitReschedule = async (interviewId: string) => {
        setIsRefreshing(true);
        try {
            autonomousSchedulingAgent.requestReschedule({
                interviewId,
                requestedBy: rescheduleRequestedBy,
                reason: rescheduleReason.trim() || undefined,
                requestedAt: new Date()
            });

            // Process immediately for demo responsiveness.
            await autonomousSchedulingAgent.triggerProcessing();
            setTimeout(() => setStatus(autonomousSchedulingAgent.getStatus()), TIMING.MEDIUM_UI_DELAY_MS);
        } finally {
            setIsRefreshing(false);
            setRescheduleForInterviewId(null);
            setRescheduleRequestedBy('candidate');
            setRescheduleReason('');
        }
    };

    const handleProviderChange = (provider: MeetingProvider) => {
        setMeetingProvider(provider);
        autonomousSchedulingAgent.setMeetingProvider(provider);
        setTimeout(() => setStatus(autonomousSchedulingAgent.getStatus()), TIMING.FAST_UI_DELAY_MS);
    };

    const handleQueue = () => {
        const selectedJob = jobs.find((j) => j.id === jobId);
        if (!selectedJob) return;
        if (!candidateName.trim() || !candidateEmail.trim()) return;

        autonomousSchedulingAgent.requestScheduling({
            candidateId: `manual_${Date.now()}`,
            candidateName: candidateName.trim(),
            candidateEmail: candidateEmail.trim(),
            jobId: selectedJob.id,
            jobTitle: selectedJob.title,
            interviewType,
            requestedAt: new Date()
        });

        setCandidateName('');
        setCandidateEmail('');
        setTimeout(() => setStatus(autonomousSchedulingAgent.getStatus()), TIMING.FAST_UI_DELAY_MS);
    };

    if (!status) return <div className="text-slate-400">Loading scheduling agent status...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${status.enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                            <Calendar className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Autonomous Scheduling Agent</h3>
                            <p className="text-sm text-slate-400">{status.enabled ? 'Running in background' : 'Paused'}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleToggle}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                            status.enabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                    >
                        {status.enabled ? (
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
                        <p className="text-sm font-semibold text-white">{formatTime(status.lastRun)}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Next Run</span>
                        </div>
                        <p className="text-sm font-semibold text-white">{formatNextRun(status.nextRun)}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">Queue</span>
                        </div>
                        <p className="text-lg font-semibold text-white">{status.queueSize}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">Upcoming</span>
                        </div>
                        <p className="text-lg font-semibold text-white">{status.upcomingCount}</p>
                    </div>
                </div>

                <div className="mt-6 flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1">
                        <label className="block text-xs text-slate-400 mb-1">Meeting Provider</label>
                        <select
                            value={meetingProvider}
                            onChange={(e) => handleProviderChange(e.target.value as MeetingProvider)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="google_meet">Google Meet</option>
                            <option value="ms_teams">MS Teams</option>
                        </select>
                        <p className="mt-1 text-[11px] text-slate-500">
                            Meet uses `meet.google.com/new`. Teams link is a placeholder unless you integrate Microsoft Graph.
                        </p>
                    </div>
                    <button
                        onClick={handleManualRun}
                        disabled={isRefreshing}
                        className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60"
                    >
                        <Zap className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{isRefreshing ? 'Running…' : 'Run Now'}</span>
                    </button>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h4 className="text-lg font-semibold text-white mb-4">Queue Interview Request</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Candidate Name</label>
                        <input
                            value={candidateName}
                            onChange={(e) => setCandidateName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                            placeholder="Jane Doe"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Candidate Email</label>
                        <input
                            value={candidateEmail}
                            onChange={(e) => setCandidateEmail(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                            placeholder="jane@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Job</label>
                        <select
                            value={jobId}
                            onChange={(e) => setJobId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                        >
                            {jobs.map((j) => (
                                <option key={j.id} value={j.id}>
                                    {j.title}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Interview Type</label>
                        <select
                            value={interviewType}
                            onChange={(e) => setInterviewType(e.target.value as any)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="video">Video</option>
                            <option value="phone">Phone</option>
                            <option value="onsite">Onsite</option>
                        </select>
                    </div>
                </div>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={handleQueue}
                        disabled={!candidateName.trim() || !candidateEmail.trim() || !jobId}
                        className="px-4 py-2 rounded-lg font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                    >
                        Add to Queue
                    </button>
                </div>
            </div>

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
                                            {i.jobTitle} • {i.interviewType} • {new Date(i.scheduledTime).toLocaleString()}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {i.meetingProvider === 'ms_teams' ? 'MS Teams' : 'Google Meet'}
                                        </div>
                                        {(i.rescheduleHistory?.length || 0) > 0 && (
                                            <div className="text-xs text-slate-500 mt-1">
                                                Rescheduled {i.rescheduleHistory!.length} time{i.rescheduleHistory!.length !== 1 ? 's' : ''}
                                            </div>
                                        )}
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
                                            onClick={() => downloadIcs(i)}
                                            className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold inline-flex items-center gap-2"
                                        >
                                            <Calendar className="h-4 w-4" />
                                            Download .ics
                                        </button>
                                        <button
                                            onClick={() => setRescheduleForInterviewId(rescheduleForInterviewId === i.id ? null : i.id)}
                                            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                                        >
                                            Request Reschedule
                                        </button>
                                    </div>
                                </div>

                                {rescheduleForInterviewId === i.id && (
                                    <div className="mt-4 border-t border-slate-700 pt-4 space-y-3">
                                        <div className="flex flex-col md:flex-row gap-3">
                                            <div className="md:w-56">
                                                <label className="block text-xs text-slate-400 mb-1">Requested by</label>
                                                <select
                                                    value={rescheduleRequestedBy}
                                                    onChange={(e) => setRescheduleRequestedBy(e.target.value as any)}
                                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                                                >
                                                    <option value="candidate">Candidate</option>
                                                    <option value="hiring_manager">Hiring Manager</option>
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-slate-400 mb-1">Reason (optional)</label>
                                                <input
                                                    value={rescheduleReason}
                                                    onChange={(e) => setRescheduleReason(e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                                                    placeholder="e.g., conflict, illness, time zone issue..."
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setRescheduleForInterviewId(null)}
                                                className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleSubmitReschedule(i.id)}
                                                disabled={isRefreshing}
                                                className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50"
                                            >
                                                {isRefreshing ? 'Processing...' : 'Submit Reschedule'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
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
                            This agent periodically processes a scheduling queue and simulates candidate selection of time slots. It records upcoming interviews and
                            posts events to the Pulse Feed. For real calendar syncing and MS Teams meeting links, you’d integrate Google Calendar / Microsoft Graph.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutonomousSchedulingControl;
