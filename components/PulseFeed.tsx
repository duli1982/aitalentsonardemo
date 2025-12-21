import React, { useEffect, useState } from 'react';
import { pulseService } from '../services/PulseService';
import { PulseAlert } from '../types/pulse';
import { Bell, AlertTriangle, Zap, TrendingUp, UserMinus, X } from 'lucide-react';

interface PulseFeedProps {
    isOpen: boolean;
    onClose: () => void;
}

const PulseFeed: React.FC<PulseFeedProps> = ({ isOpen, onClose }) => {
    const [alerts, setAlerts] = useState<PulseAlert[]>(pulseService.getAlerts());

    useEffect(() => {
        // Subscribe to real-time updates
        const unsubscribe = pulseService.subscribe((updatedAlerts) => {
            setAlerts(updatedAlerts);
        });

        // Initial load
        setAlerts(pulseService.getAlerts());

        return () => unsubscribe();
    }, []);

    if (!isOpen) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'ATTRITION_RISK': return <UserMinus size={16} className="text-red-400" />;
            case 'MARKET_SIGNAL': return <TrendingUp size={16} className="text-blue-400" />;
            case 'OPPORTUNITY': return <Zap size={16} className="text-yellow-400" />;
            default: return <AlertTriangle size={16} className="text-slate-400" />;
        }
    };

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'border-red-500/50 bg-red-500/10';
            case 'OPPORTUNITY': return 'border-yellow-500/50 bg-yellow-500/10';
            default: return 'border-slate-700 bg-slate-800';
        }
    };

    return (
        <div className="absolute top-16 right-4 w-96 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80 backdrop-blur">
                <h3 className="text-white font-bold flex items-center gap-2">
                    <Zap className="text-sky-400" size={18} />
                    Talent Pulse
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                    <X size={18} />
                </button>
            </div>

            <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-2 space-y-2">
                {alerts.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                        No active signals. System is quiet.
                    </div>
                )}
                {alerts.map(alert => (
                    <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${getSeverityStyles(alert.severity)} transition-all hover:scale-[1.01] cursor-pointer`}
                        onClick={() => pulseService.markAsRead(alert.id)}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                                {getIcon(alert.type)}
                                <span className={`text-xs font-bold uppercase tracking-wider ${alert.isRead ? 'text-slate-500' : 'text-white'}`}>
                                    {alert.type.replace('_', ' ')}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <h4 className={`text-sm font-semibold mb-1 ${alert.isRead ? 'text-slate-400' : 'text-white'}`}>
                            {alert.title}
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {alert.message}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PulseFeed;
