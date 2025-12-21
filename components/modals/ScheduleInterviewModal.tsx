import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Clock, Copy, Loader2, TrendingUp, X } from 'lucide-react';
import type { Candidate, Job } from '../../types';
import { autonomousSchedulingAgent, type MeetingProvider } from '../../services/AutonomousSchedulingAgent';

type UrgencyLevel = 'low' | 'medium' | 'high';

interface TimeSlot {
    dateTime: string;
    timezone: string;
    acceptanceProbability: number;
    rationale: string;
}

interface InterviewScheduleSuggestion {
    urgencyLevel: UrgencyLevel;
    recommendedSlots: TimeSlot[];
    notes: string;
}

interface ScheduleInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidate: Candidate;
    job: Job;
}

const ScheduleInterviewModal: React.FC<ScheduleInterviewModalProps> = ({ isOpen, onClose, candidate, job }) => {
    const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
    const [suggestion, setSuggestion] = useState<InterviewScheduleSuggestion | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [copiedSlot, setCopiedSlot] = useState<number | null>(null);
    const [meetingProvider, setMeetingProvider] = useState<MeetingProvider>('google_meet');

    useEffect(() => {
        if (!isOpen) return;
        void generateSchedule();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, candidate.id, job.id]);

    const generateSchedule = async () => {
        setIsLoading(true);
        try {
            setSuggestion(buildLocalScheduleSuggestion());
        } catch (error) {
            console.error('Error generating schedule:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const buildLocalScheduleSuggestion = (): InterviewScheduleSuggestion => {
        const now = new Date();

        const makeSlot = (daysFromNow: number, hour: number, probability: number, rationale: string): TimeSlot => {
            const d = new Date(now);
            d.setDate(now.getDate() + daysFromNow);
            d.setHours(hour, 0, 0, 0);
            return { dateTime: d.toISOString(), timezone, acceptanceProbability: probability, rationale };
        };

        return {
            urgencyLevel: 'medium',
            recommendedSlots: [
                makeSlot(2, 11, 82, 'Late morning slots tend to have high acceptance and low conflict rates.'),
                makeSlot(4, 14, 74, 'Afternoon option for candidates with morning commitments.'),
                makeSlot(6, 10, 68, 'Earlier option for faster turnaround when urgency is higher.')
            ],
            notes: 'Generated locally (no AI). Use “Queue Scheduling” to have the Scheduling Agent confirm and create a meeting link.'
        };
    };

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        return {
            date: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        };
    };

    const handleCopySlot = (index: number, slot: TimeSlot) => {
        const formatted = formatDateTime(slot.dateTime);
        const text = `Interview Invitation - ${job.title}\n\nCandidate: ${candidate.name}\nDate: ${formatted.date}\nTime: ${formatted.time} (${slot.timezone})\n\nPlease confirm your availability.`;
        navigator.clipboard.writeText(text);
        setCopiedSlot(index);
        setTimeout(() => setCopiedSlot(null), 2000);
    };

    const getUrgencyColor = (level: UrgencyLevel) => {
        switch (level) {
            case 'high':
                return 'text-red-400 bg-red-500/10 border-red-500/30';
            case 'medium':
                return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'low':
                return 'text-green-400 bg-green-500/10 border-green-500/30';
            default:
                return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    const getProbabilityColor = (prob: number) => {
        if (prob >= 80) return 'text-green-400';
        if (prob >= 60) return 'text-amber-400';
        return 'text-orange-400';
    };

    const handleQueueScheduling = async () => {
        if (!candidate.email) {
            alert('This candidate has no email on file. Add an email to queue scheduling.');
            return;
        }

        autonomousSchedulingAgent.initialize();
        autonomousSchedulingAgent.setMeetingProvider(meetingProvider);
        autonomousSchedulingAgent.requestScheduling({
            candidateId: candidate.id,
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            jobId: job.id,
            jobTitle: job.title,
            interviewType: 'video',
            requestedAt: new Date()
        });

        try {
            await autonomousSchedulingAgent.triggerProcessing();
        } catch (e) {
            console.warn('[ScheduleInterviewModal] Failed to trigger scheduling agent processing:', e);
        }

        alert('Scheduling queued. Check Talent Pulse and the candidate’s pipeline stage for updates.');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110]" onClick={onClose}>
            <div className="bg-slate-900 shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Calendar className="text-sky-400" />
                            Interview Scheduler
                        </h2>
                        <p className="text-gray-400 mt-1">Suggested time slots for {candidate.name} → {job.title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-grow overflow-auto custom-scrollbar p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-12 w-12 animate-spin text-sky-500 mb-4" />
                            <p className="text-gray-300 font-medium">Generating time slots...</p>
                            <p className="text-gray-500 text-sm mt-2">No AI required</p>
                        </div>
                    ) : suggestion ? (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between gap-4 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
                                <div>
                                    <p className="text-white font-semibold">Meeting provider</p>
                                    <p className="text-gray-400 text-sm">Used when the agent creates a meeting link.</p>
                                </div>
                                <select value={meetingProvider} onChange={(e) => setMeetingProvider(e.target.value as MeetingProvider)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2">
                                    <option value="google_meet">Google Meet</option>
                                    <option value="ms_teams">MS Teams</option>
                                </select>
                            </div>

                            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Schedule Overview</h3>
                                        <p className="text-gray-400">
                                            Candidate: <span className="text-white font-medium">{candidate.name}</span>
                                        </p>
                                        <p className="text-gray-400">
                                            Role: <span className="text-white font-medium">{job.title}</span>
                                        </p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-lg border ${getUrgencyColor(suggestion.urgencyLevel)}`}>
                                        <p className="text-sm font-semibold uppercase">{suggestion.urgencyLevel} urgency</p>
                                    </div>
                                </div>
                                <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                                    <p className="text-gray-500 mt-1">{suggestion.notes}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <Clock className="text-sky-400" />
                                    Recommended Time Slots
                                </h3>
                                <div className="space-y-4">
                                    {suggestion.recommendedSlots.map((slot, index) => {
                                        const formatted = formatDateTime(slot.dateTime);
                                        return (
                                            <div key={`${slot.dateTime}-${index}`} className="bg-slate-800/30 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-grow">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="text-2xl font-bold text-sky-400">#{index + 1}</span>
                                                            <div>
                                                                <p className="text-white font-semibold text-lg">{formatted.date}</p>
                                                                <p className="text-gray-400 text-sm">{formatted.time} → {slot.timezone}</p>
                                                            </div>
                                                        </div>
                                                        <p className="text-gray-300 text-sm mt-2">{slot.rationale}</p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <TrendingUp size={16} className={getProbabilityColor(slot.acceptanceProbability)} />
                                                            <span className={`text-lg font-bold ${getProbabilityColor(slot.acceptanceProbability)}`}>{slot.acceptanceProbability}%</span>
                                                        </div>
                                                        <button onClick={() => handleCopySlot(index, slot)} className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Copy invitation">
                                                            {copiedSlot === index ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-400">No schedule available.</div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        <Calendar size={14} className="inline text-sky-400 mr-1" />
                        Local suggestions (no AI)
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors">
                            Close
                        </button>
                        <button onClick={handleQueueScheduling} disabled={isLoading || !suggestion} className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50">
                            Queue Scheduling
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduleInterviewModal;
