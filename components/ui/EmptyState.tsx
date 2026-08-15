import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    className = ''
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center h-full ${className}`}>
            <div className="bg-slate-800/50 p-4 rounded-full mb-4">
                <Icon className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-2">{title}</h3>
            <p className="text-sm text-slate-500 max-w-xs mb-6">{description}</p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm font-medium transition-colors"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
