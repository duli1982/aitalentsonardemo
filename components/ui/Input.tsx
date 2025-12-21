// Input - Atomic UI primitive
// Consistent input styling with variants and states

import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    className = '',
    id,
    ...props
}, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className="w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                    {label}
                </label>
            )}

            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {leftIcon}
                    </div>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    className={`
                        w-full px-4 py-2.5
                        bg-slate-900 border rounded-lg
                        text-white placeholder-slate-500
                        transition-colors duration-200
                        focus:outline-none focus:ring-2 focus:ring-sky-500/50
                        ${error
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-slate-700 focus:border-sky-500'
                        }
                        ${leftIcon ? 'pl-10' : ''}
                        ${rightIcon ? 'pr-10' : ''}
                        ${className}
                    `}
                    {...props}
                />

                {rightIcon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {rightIcon}
                    </div>
                )}
            </div>

            {error && (
                <p className="mt-1.5 text-xs text-red-400">{error}</p>
            )}

            {hint && !error && (
                <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
