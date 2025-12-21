// Badge - Atomic UI primitive
// Status indicators, tags, and labels

import React from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-slate-700 text-slate-300',
    primary: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
};

const dotColors: Record<BadgeVariant, string> = {
    default: 'bg-slate-400',
    primary: 'bg-sky-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    info: 'bg-purple-400',
};

const sizeStyles: Record<BadgeSize, string> = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
};

const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'default',
    size = 'sm',
    dot = false,
    className = '',
}) => {
    return (
        <span
            className={`
                inline-flex items-center gap-1.5
                font-medium rounded-full uppercase tracking-wide
                ${variantStyles[variant]}
                ${sizeStyles[size]}
                ${className}
            `}
        >
            {dot && (
                <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
            )}
            {children}
        </span>
    );
};

export default Badge;
