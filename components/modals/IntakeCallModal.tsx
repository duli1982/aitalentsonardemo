import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, MicOff, Phone, PhoneOff, Loader2, Users, Plus, Trash2 } from 'lucide-react';
import type { Job, IntakeParticipant, IntakeCallSession, IntakeTranscriptLine } from '../../types';
import { intakeCallService } from '../../services/IntakeCallService';
import { useToast } from '../../contexts/ToastContext';

interface IntakeCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  onScorecardReady: (sessionId: string) => void;
}

const ROLE_OPTIONS: IntakeParticipant['role'][] = ['hiring_manager', 'recruiter', 'talent_advisor', 'other'];

const roleLabel = (role: IntakeParticipant['role']) => {
  switch (role) {
    case 'hiring_manager': return 'Hiring Manager';
    case 'recruiter': return 'Recruiter';
    case 'talent_advisor': return 'Talent Advisor';
    default: return 'Other';
  }
};

const IntakeCallModal: React.FC<IntakeCallModalProps> = ({ isOpen, onClose, job, onScorecardReady }) => {
  const { showToast } = useToast();

  // Participants setup
  const [participants, setParticipants] = useState<IntakeParticipant[]>([
    { name: '', role: 'recruiter' },
    { name: '', role: 'hiring_manager' },
  ]);

  // Call state
  const [session, setSession] = useState<IntakeCallSession | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.transcript?.length]);

  if (!isOpen) return null;

  const updateParticipant = (idx: number, field: keyof IntakeParticipant, value: string) => {
    setParticipants((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const addParticipant = () => {
    setParticipants((prev) => [...prev, { name: '', role: 'other' }]);
  };

  const removeParticipant = (idx: number) => {
    if (participants.length <= 2) return;
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
  };

  const startCall = () => {
    const validParticipants = participants.filter((p) => p.name.trim());
    if (validParticipants.length < 2) {
      showToast('At least 2 participants with names are required.', 'warning');
      return;
    }

    const newSession = intakeCallService.startSession(job, validParticipants);
    setSession(newSession);
    setIsLive(true);
    showToast('Intake call started. Begin discussing the role!', 'info');
  };

  const toggleMic = () => {
    if (!session) return;
    if (isMicOn) {
      intakeCallService.stopSpeechRecognition();
      setIsMicOn(false);
    } else {
      const speaker = participants[activeSpeaker];
      const started = intakeCallService.startSpeechRecognition(
        session.id,
        speaker?.name || 'Unknown',
        speaker?.role || 'other'
      );
      if (started) {
        setIsMicOn(true);
      } else {
        showToast('Speech recognition not available in this browser. Use manual input.', 'warning');
      }
    }
  };

  const addManualLine = () => {
    if (!session || !manualInput.trim()) return;
    const speaker = participants[activeSpeaker];
    intakeCallService.addTranscriptLine(
      session.id,
      speaker?.name || 'Unknown',
      speaker?.role || 'other',
      manualInput.trim()
    );
    setManualInput('');
    // Refresh session to pick up new lines
    const updated = intakeCallService.getSession(session.id);
    if (updated) setSession({ ...updated });
  };

  const endCall = async () => {
    if (!session) return;
    if (session.transcript.length === 0) {
      showToast('No transcript lines captured. Add some notes before ending.', 'warning');
      return;
    }

    setIsProcessing(true);
    intakeCallService.stopSpeechRecognition();
    setIsMicOn(false);

    try {
      const scorecard = await intakeCallService.endSessionAndGenerateScorecard(session.id);
      setIsLive(false);
      setIsProcessing(false);

      if (scorecard) {
        showToast('Scorecard generated! Review the criteria now.', 'info');
        onScorecardReady(session.id);
        onClose();
      } else {
        showToast('Failed to generate scorecard. Please try again.', 'error');
      }
    } catch (err) {
      console.error('[IntakeCallModal] Error ending call:', err);
      setIsProcessing(false);
      showToast('Error generating scorecard.', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addManualLine();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-sky-400 flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Intake Call {isLive && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">{job.title} — {job.department}</p>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!isLive && !isProcessing && (
            <>
              {/* Participant Setup */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Participants
                </h3>
                <div className="space-y-2">
                  {participants.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Name"
                        value={p.name}
                        onChange={(e) => updateParticipant(idx, 'name', e.target.value)}
                        className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <select
                        value={p.role}
                        onChange={(e) => updateParticipant(idx, 'role', e.target.value as IntakeParticipant['role'])}
                        className="bg-slate-700 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{roleLabel(r)}</option>
                        ))}
                      </select>
                      {participants.length > 2 && (
                        <button onClick={() => removeParticipant(idx)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addParticipant}
                  className="mt-2 text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add participant
                </button>
              </div>

              {/* Start Button */}
              <button
                onClick={startCall}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="h-4 w-4" /> Start Intake Call
              </button>
            </>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mb-3 text-sky-400" />
              <p className="text-sm font-medium">Analyzing transcript & generating scorecard...</p>
              <p className="text-xs mt-1">This may take a moment.</p>
            </div>
          )}

          {isLive && session && (
            <>
              {/* Transcript */}
              <div className="bg-slate-900 rounded-lg p-3 max-h-64 overflow-y-auto border border-slate-700">
                <h3 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Transcript</h3>
                {session.transcript.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No transcript lines yet. Speak or type below.</p>
                ) : (
                  <div className="space-y-1.5">
                    {session.transcript.map((line) => (
                      <div key={line.id} className="text-sm">
                        <span className="font-medium text-sky-300">{line.speaker}</span>
                        <span className="text-slate-500 text-xs ml-1">({roleLabel(line.speakerRole)})</span>
                        <span className="text-slate-300 ml-1.5">{line.text}</span>
                      </div>
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>
                )}
              </div>

              {/* Speaker Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Speaking as:</span>
                {participants.filter((p) => p.name.trim()).map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSpeaker(idx)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      activeSpeaker === idx
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                        : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* Manual Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type what was said..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  onClick={addManualLine}
                  disabled={!manualInput.trim()}
                  className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMic}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isMicOn
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {isMicOn ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isMicOn ? 'Stop Mic' : 'Start Mic'}
                </button>

                <button
                  onClick={endCall}
                  className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
                >
                  <PhoneOff className="h-4 w-4" /> End Call & Generate Scorecard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntakeCallModal;
