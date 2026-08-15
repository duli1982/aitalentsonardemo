import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react';
import { TIMING } from '../../config/timing';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
    id: string;
    type: ToastType;
    message: string;
    onClose: (id: string) => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ id, type, message, onClose, duration = TIMING.DEFAULT_TOAST_DURATION_MS }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, onClose, duration]);

    const icons = {
        success: <CheckCircle className="h-5 w-5 text-green-400" />,
        error: <AlertTriangle className="h-5 w-5 text-red-400" />,
        info: <Info className="h-5 w-5 text-sky-400" />,
        warning: <AlertTriangle className="h-5 w-5 text-amber-400" />
    };

    const bgColors = {
        success: "bg-slate-800 border-green-500/30",
        error: "bg-slate-800 border-red-500/30",
        info: "bg-slate-800 border-sky-500/30",
        warning: "bg-slate-800 border-amber-500/30"
    };

    return (
        <div className={`flex items-center p-4 mb-3 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-top-2 ${bgColors[type]} min-w-[300px] max-w-md`}>
            <div className="flex-shrink-0 mr-3">
                {icons[type]}
            </div>
            <div className="flex-1 text-sm text-gray-200 font-medium">
                {message}
            </div>
            <button
                onClick={() => onClose(id)}
                className="ml-4 text-gray-400 hover:text-white transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
