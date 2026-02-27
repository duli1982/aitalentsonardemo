import React, { useState } from 'react';
import { Type } from '@google/genai';
import { X, Mail, Loader2, Copy, Send, Sparkles, CheckCircle } from 'lucide-react';
import type { Candidate, Job } from '../../types';
import { aiService } from '../../services/AIService';
import { useToast } from '../../contexts/ToastContext';

interface EmailTemplateLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidate: Candidate;
    job: Job;
}

type TemplateType = 'rejection_skills_gap' | 'rejection_experience' | 'rejection_culture_fit' | 'offer' | 'follow_up' | 'interview_invitation' | 'thank_you';

type EmailTone = 'friendly' | 'professional' | 'warm' | 'empathetic' | 'direct';

interface PersonalizedEmail {
    subject: string;
    body: string;
    tone: EmailTone;
    personalizedElements: string[];
}

function buildTemplateEmail(params: { templateId: TemplateType; candidate: Candidate; job: Job; additionalContext?: string }): PersonalizedEmail {
    const { templateId, candidate, job, additionalContext } = params;
    const firstName = String(candidate.name || 'there').split(' ')[0];
    const companyName = job.company || 'our team';
    const role = job.title || 'the role';
    const skills = Array.isArray(candidate.skills) ? candidate.skills.slice(0, 4).join(', ') : '';
    const contextLine = additionalContext?.trim() ? `\n\nAdditional context:\n${additionalContext.trim()}\n` : '';

    const base = {
        tone: 'friendly' as EmailTone,
        personalizedElements: [
            `Candidate: ${candidate.name}`,
            `Role: ${role}`,
            skills ? `Skills: ${skills}` : 'Skills: (not provided)'
        ].filter(Boolean)
    };

    switch (templateId) {
        case 'interview_invitation':
            return {
                ...base,
                tone: 'warm',
                subject: `Interview invitation — ${role}`,
                body:
                    `Hi ${firstName},\n\n` +
                    `Thanks again for your interest in the ${role} position at ${companyName}. We’d love to invite you to the next step: an interview with the hiring team.\n\n` +
                    `Could you share a few times that work well for you over the next few days?\n` +
                    `If you have any scheduling constraints, feel free to include them.\n` +
                    `${contextLine}\n` +
                    `Best regards,\nRecruiting Team`
            };
        case 'follow_up':
            return {
                ...base,
                tone: 'friendly',
                subject: `Quick follow-up — ${role}`,
                body:
                    `Hi ${firstName},\n\n` +
                    `Just following up on the ${role} opportunity at ${companyName}. If you’re still interested, I’d be happy to share next steps and answer any questions.\n\n` +
                    `Would you prefer an email follow-up or a quick call?\n` +
                    `${contextLine}\n` +
                    `Best,\nRecruiting Team`
            };
        case 'offer':
            return {
                ...base,
                tone: 'professional',
                subject: `Offer — ${role} at ${companyName}`,
                body:
                    `Hi ${firstName},\n\n` +
                    `We’re excited to share an offer for the ${role} position at ${companyName}.\n\n` +
                    `Next steps:\n` +
                    `- Confirm your availability for a quick call to walk through details\n` +
                    `- Review the written offer and benefits summary\n\n` +
                    `${contextLine}\n` +
                    `Warm regards,\nRecruiting Team`
            };
        case 'rejection_skills_gap':
            return {
                ...base,
                tone: 'empathetic',
                subject: `Update on your application — ${role}`,
                body:
                    `Hi ${firstName},\n\n` +
                    `Thank you for taking the time to speak with us about the ${role} role at ${companyName}.\n\n` +
                    `After reviewing your profile, we’ve decided not to move forward at this time. We’re currently prioritizing candidates with deeper experience in a few specific areas for this role.\n\n` +
                    `We truly appreciate your interest and would welcome you to apply again for future roles that better match your strengths.\n` +
                    `${contextLine}\n` +
                    `Wishing you the best,\nRecruiting Team`
            };
        case 'rejection_experience':
            return {
                ...base,
                tone: 'empathetic',
                subject: `Update on your application — ${role}`,
                body:
                    `Hi ${firstName},\n\n` +
                    `Thank you for your interest in the ${role} role at ${companyName}.\n\n` +
                    `At this stage, we’re moving forward with candidates whose experience more closely aligns with the seniority and scope required for this position.\n\n` +
                    `We appreciate the time you invested and encourage you to apply for future opportunities.\n` +
                    `${contextLine}\n` +
                    `Kind regards,\nRecruiting Team`
            };
        case 'rejection_culture_fit':
            return {
                ...base,
                tone: 'empathetic',
                subject: `Update on your application — ${role}`,
                body:
                    `Hi ${firstName},\n\n` +
                    `Thank you for speaking with us about the ${role} position at ${companyName}.\n\n` +
                    `After careful consideration, we’ve decided not to move forward. This decision is based on overall fit for the current team and role needs.\n\n` +
                    `We appreciate your time and wish you continued success.\n` +
                    `${contextLine}\n` +
                    `Sincerely,\nRecruiting Team`
            };
        case 'thank_you':
        default:
            return {
                ...base,
                tone: 'warm',
                subject: `Thank you — ${role}`,
                body:
                    `Hi ${firstName},\n\n` +
                    `Thank you for your time today. It was great learning more about your background and experience.\n\n` +
                    `We’ll be in touch soon with next steps for the ${role} role at ${companyName}.\n` +
                    `${contextLine}\n` +
                    `Best,\nRecruiting Team`
            };
    }
}

const EmailTemplateLibraryModal: React.FC<EmailTemplateLibraryModalProps> = ({ isOpen, onClose, candidate, job }) => {
    const { showToast } = useToast();
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
    const [personalizedEmail, setPersonalizedEmail] = useState<PersonalizedEmail | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [additionalContext, setAdditionalContext] = useState('');
    const [editedBody, setEditedBody] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    const templates = [
        { id: 'rejection_skills_gap' as TemplateType, name: 'Rejection - Skills Gap', icon: '🎯', color: 'border-red-500/30 bg-red-500/10' },
        { id: 'rejection_experience' as TemplateType, name: 'Rejection - Experience', icon: '📊', color: 'border-red-500/30 bg-red-500/10' },
        { id: 'rejection_culture_fit' as TemplateType, name: 'Rejection - Culture Fit', icon: '🤝', color: 'border-red-500/30 bg-red-500/10' },
        { id: 'offer' as TemplateType, name: 'Job Offer', icon: '🎉', color: 'border-green-500/30 bg-green-500/10' },
        { id: 'follow_up' as TemplateType, name: 'Follow-Up', icon: '👋', color: 'border-sky-500/30 bg-sky-500/10' },
        { id: 'interview_invitation' as TemplateType, name: 'Interview Invitation', icon: '📅', color: 'border-purple-500/30 bg-purple-500/10' },
        { id: 'thank_you' as TemplateType, name: 'Thank You', icon: '🙏', color: 'border-amber-500/30 bg-amber-500/10' },
    ];

    const handleGenerateEmail = async (templateId: TemplateType) => {
        setSelectedTemplate(templateId);
        setIsGenerating(true);
        try {
            const templateDescriptions: Record<TemplateType, string> = {
                rejection_skills_gap: 'Polite rejection explaining skills gap (empathetic, encouraging)',
                rejection_experience: 'Polite rejection explaining experience/seniority mismatch (empathetic)',
                rejection_culture_fit: 'Polite rejection explaining overall fit (empathetic, neutral)',
                offer: 'Job offer email (professional, clear next steps)',
                follow_up: 'Friendly follow-up email (short, action-oriented)',
                interview_invitation: 'Interview invitation email (warm, scheduling request)',
                thank_you: 'Thank you email after interview (warm, concise)'
            };

            const prompt = `You are a recruitment communication specialist.\n\n` +
                `Generate a ${templateId} email.\n` +
                `Template intent: ${templateDescriptions[templateId]}\n\n` +
                `Candidate:\n- Name: ${candidate.name}\n- Email: ${candidate.email}\n- Title: ${candidate.title || ''}\n- Skills: ${(candidate.skills || []).join(', ')}\n\n` +
                `Job:\n- Title: ${job.title}\n- Department: ${job.department}\n- Location: ${job.location}\n- Company: ${job.company || ''}\n\n` +
                (additionalContext?.trim() ? `Additional context (optional):\n${additionalContext.trim()}\n\n` : '') +
                `Return ONLY valid JSON with keys: subject (string), body (string), tone (one of: friendly, professional, warm, empathetic, direct), personalizedElements (string[]). No markdown.`;

            if (!aiService.isAvailable()) {
                const fallback = buildTemplateEmail({ templateId, candidate, job, additionalContext });
                setPersonalizedEmail(fallback);
                setEditedBody(fallback.body);
                return;
            }

            // Layer 6: Enforce structured output schema at the API level.
            const emailSchema = {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING, description: 'Email subject line.' },
                    body: { type: Type.STRING, description: 'Full email body.' },
                    tone: { type: Type.STRING, description: 'Tone: friendly, professional, warm, empathetic, or direct.' },
                    personalizedElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Elements personalized for this candidate.' }
                },
                required: ['subject', 'body', 'tone', 'personalizedElements']
            };

            const result = await aiService.generateJson<PersonalizedEmail>(prompt, emailSchema);
            if (!result.success || !result.data) {
                const fallback = buildTemplateEmail({ templateId, candidate, job, additionalContext });
                setPersonalizedEmail(fallback);
                setEditedBody(fallback.body);
                return;
            }

            setPersonalizedEmail(result.data);
            setEditedBody(result.data.body);
        } catch (error) {
            console.error('Error generating email:', error);
            const fallback = buildTemplateEmail({ templateId, candidate, job, additionalContext });
            setPersonalizedEmail(fallback);
            setEditedBody(fallback.body);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        const fullEmail = `Subject: ${personalizedEmail?.subject}\n\n${editedBody}`;
        navigator.clipboard.writeText(fullEmail);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleSend = () => {
        showToast(`Demo: email queued for ${candidate.email || 'candidate'}. (Not actually sent)`, 'info', 7000);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110]" onClick={onClose}>
            <div
                className="bg-slate-900 shadow-2xl rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Mail className="text-sky-400" />
                            Email Template Library
                        </h2>
                        <p className="text-gray-400 mt-1">
                            AI-personalized emails for {candidate.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-auto custom-scrollbar p-6">
                    {!personalizedEmail ? (
                        <div className="space-y-6">
                            {/* Template Selection */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Select Email Template</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {templates.map(template => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleGenerateEmail(template.id)}
                                            disabled={isGenerating}
                                            className={`p-4 rounded-xl border ${template.color} hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left`}
                                        >
                                            <div className="text-3xl mb-2">{template.icon}</div>
                                            <div className="text-white font-semibold">{template.name}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Additional Context */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                    Additional Context (Optional)
                                </label>
                                <textarea
                                    value={additionalContext}
                                    onChange={(e) => setAdditionalContext(e.target.value)}
                                    placeholder="Add any specific details to include in the email..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 resize-none"
                                />
                            </div>

                            {isGenerating && (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="h-12 w-12 animate-spin text-sky-500 mb-4" />
                                    <p className="text-gray-300 font-medium">Personalizing email...</p>
                                    <p className="text-gray-500 text-sm mt-2">AI is crafting the perfect message</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Email Preview */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <Mail className="text-sky-400" size={20} />
                                        Email Preview
                                    </h3>
                                    <span className="text-xs px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30 capitalize">
                                        {personalizedEmail.tone} tone
                                    </span>
                                </div>

                                {/* Subject */}
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Subject</label>
                                    <div className="px-4 py-2 bg-slate-900/50 rounded-lg text-white font-medium">
                                        {personalizedEmail.subject}
                                    </div>
                                </div>

                                {/* Body */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Message</label>
                                    <textarea
                                        value={editedBody}
                                        onChange={(e) => setEditedBody(e.target.value)}
                                        rows={12}
                                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 resize-none"
                                    />
                                </div>
                            </div>

                            {/* Personalized Elements */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Sparkles className="text-purple-400" size={16} />
                                    AI Personalization Applied
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {personalizedEmail.personalizedElements.map((element, index) => (
                                        <span
                                            key={index}
                                            className="text-xs px-3 py-1 bg-purple-500/10 text-purple-300 rounded-full border border-purple-500/30"
                                        >
                                            {element}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        <Mail size={14} className="inline text-sky-400 mr-1" />
                        {personalizedEmail ? 'Edit and send or copy to clipboard' : 'Select a template to get started'}
                    </p>
                    <div className="flex gap-3">
                        {personalizedEmail && (
                            <>
                                <button
                                    onClick={() => {
                                        setPersonalizedEmail(null);
                                        setEditedBody('');
                                        setSelectedTemplate(null);
                                    }}
                                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                                >
                                    Back to Templates
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {isCopied ? <CheckCircle size={18} /> : <Copy size={18} />}
                                    {isCopied ? 'Copied!' : 'Copy'}
                                </button>
                                <button
                                    onClick={handleSend}
                                    className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <Send size={18} />
                                    Send Email
                                </button>
                            </>
                        )}
                        {!personalizedEmail && (
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailTemplateLibraryModal;
