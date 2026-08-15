import React, { useState } from 'react';
import { auditService } from '../services/AuditService';
import { ComplianceRule, AuditLogEntry, DecisionReceipt } from '../types/audit';
import { Shield, FileText, Activity, Lock, CheckCircle, AlertCircle, ToggleRight, ToggleLeft, Search } from 'lucide-react';

const GovernancePage: React.FC = () => {
    const [rules, setRules] = useState<ComplianceRule[]>(auditService.getRules());
    const [logs, setLogs] = useState<AuditLogEntry[]>(auditService.getLogs());
    const [selectedReceipt, setSelectedReceipt] = useState<DecisionReceipt | null>(null);

    const handleToggleRule = (id: string) => {
        auditService.toggleRule(id);
        setRules([...auditService.getRules()]); // Refresh
        setLogs(auditService.getLogs()); // Refresh logs to see the toggle action
    };

    const handleSimulateReceipt = () => {
        const receipt = auditService.generateDecisionReceipt('Michael Chen', 1);
        setSelectedReceipt(receipt);
    };

    return (
        <div className="h-[calc(100vh-80px)] overflow-y-auto p-6 space-y-8 custom-scrollbar">

            {/* Header */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex justify-between items-center">
                <div className="flex items-center">
                    <Shield className="text-emerald-400 mr-3" size={28} />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Governance & Explainability Center</h1>
                        <p className="text-slate-400">Monitor AI compliance, manage regional rules, and audit decisions.</p>
                    </div>
                </div>
                <div className="flex space-x-4">
                    <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg flex flex-col items-center">
                        <span className="text-emerald-400 font-bold text-xl">100%</span>
                        <span className="text-xs text-slate-500 uppercase">Compliance</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg flex flex-col items-center">
                        <span className="text-white font-bold text-xl">{logs.length}</span>
                        <span className="text-xs text-slate-500 uppercase">Audit Logs</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Compliance Rules Engine */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                        <Lock className="text-emerald-400 mr-2" size={20} />
                        Active Policies & Guardrails
                    </h2>
                    <div className="space-y-4">
                        {rules.map(rule => (
                            <div key={rule.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-white font-semibold">{rule.region}</span>
                                        <span className="text-xs text-slate-500 px-2 py-0.5 border border-slate-600 rounded">
                                            {rule.category}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400">{rule.description}</p>
                                </div>
                                <button
                                    onClick={() => handleToggleRule(rule.id)}
                                    className={`transition-colors ${rule.isEnabled ? 'text-emerald-400' : 'text-slate-600'}`}
                                >
                                    {rule.isEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Explainability Search */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                        <Search className="text-sky-400 mr-2" size={20} />
                        Explainability Receipt Viewer
                    </h2>
                    <div className="bg-slate-900 rounded-lg p-6 flex flex-col items-center justify-center flex-grow space-y-4 border border-slate-700 border-dashed">
                        {!selectedReceipt ? (
                            <>
                                <FileText className="text-slate-600" size={48} />
                                <p className="text-slate-500 text-center text-sm px-8">
                                    Select a candidate or decision ID to view a full "Glass Box" explanation of the AI's reasoning.
                                </p>
                                <button
                                    onClick={handleSimulateReceipt}
                                    className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
                                >
                                    Simulate Audit Request
                                </button>
                            </>
                        ) : (
                            <div className="w-full text-left space-y-4">
                                <div className="border-b border-slate-700 pb-2 flex justify-between items-center">
                                    <span className="text-sky-400 font-mono text-xs">{selectedReceipt.decisionId}</span>
                                    <span className="text-slate-500 text-xs">{new Date(selectedReceipt.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase font-bold">Explanation</div>
                                    <p className="text-white text-sm bg-slate-800 p-3 rounded mt-1 border border-slate-700">"{selectedReceipt.explanation}"</p>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-2">Top Factors</div>
                                    <div className="space-y-2">
                                        {selectedReceipt.factors.map((f: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between text-sm">
                                                <span className="text-slate-300">{f.factor}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-1.5 bg-slate-700 rounded overflow-hidden">
                                                        <div className="h-full bg-emerald-500" style={{ width: `${f.weight * 100}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-mono text-slate-500">{(f.weight * 100).toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedReceipt(null)}
                                    className="text-xs text-sky-400 hover:underline w-full text-center mt-4"
                                >
                                    Clear Receipt
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Audit Logs */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Activity className="text-slate-400 mr-2" size={20} />
                    System Audit Logs
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs text-slate-500 border-b border-slate-700">
                                <th className="p-3 uppercase">Timestamp</th>
                                <th className="p-3 uppercase">Actor</th>
                                <th className="p-3 uppercase">Action</th>
                                <th className="p-3 uppercase">Details</th>
                                <th className="p-3 uppercase text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {logs.map(log => (
                                <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                                    <td className="p-3 text-slate-400 font-mono text-xs">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                    <td className="p-3 text-white font-medium">{log.actor}</td>
                                    <td className="p-3 text-sky-300">{log.action}</td>
                                    <td className="p-3 text-slate-400 truncate max-w-md">{log.details}</td>
                                    <td className="p-3 text-center">
                                        {log.complianceChecksPassed
                                            ? <CheckCircle size={16} className="text-emerald-500 inline" />
                                            : <AlertCircle size={16} className="text-red-500 inline" />
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default GovernancePage;
