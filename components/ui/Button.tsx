// Button - Atomic UI primitive
// Consistent styling with variants and sizes

import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-lg shadow-sky-500/25',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600',
    ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
};

const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    disabled,
    className = '',
    ...props
}) => {
    return (
        <button
            disabled={disabled || isLoading}
            className={`
                inline-flex items-center justify-center gap-2
                font-semibold rounded-lg
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                ${variantStyles[variant]}
                ${sizeStyles[size]}
                ${className}
            `}
            {...props}
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : leftIcon}
            {children}
            {!isLoading && rightIcon}
        </button>
    );
};

export default Button;
