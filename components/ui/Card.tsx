// Card - Atomic UI primitive with compound pattern
// Flexible card component with Header, Body, Footer slots

import React, { createContext, useContext } from 'react';

interface CardContextValue {
    variant: 'default' | 'elevated' | 'outlined' | 'glass';
}

const CardContext = createContext<CardContextValue>({ variant: 'default' });

interface CardProps {
    children: React.ReactNode;
    variant?: CardContextValue['variant'];
    className?: string;
    onClick?: () => void;
}

const variantStyles: Record<CardContextValue['variant'], string> = {
    default: 'bg-slate-800 border border-slate-700',
    elevated: 'bg-slate-800 border border-slate-700 shadow-xl shadow-black/20',
    outlined: 'bg-transparent border-2 border-slate-600',
    glass: 'bg-slate-800/50 backdrop-blur-lg border border-slate-700/50',
};

const Card: React.FC<CardProps> & {
    Header: typeof CardHeader;
    Body: typeof CardBody;
    Footer: typeof CardFooter;
} = ({ children, variant = 'default', className = '', onClick }) => {
    return (
        <CardContext.Provider value={{ variant }}>
            <div
                onClick={onClick}
                className={`
                    rounded-xl overflow-hidden
                    ${variantStyles[variant]}
                    ${onClick ? 'cursor-pointer hover:border-slate-500 transition-colors' : ''}
                    ${className}
                `}
            >
                {children}
            </div>
        </CardContext.Provider>
    );
};

// Card.Header
interface CardHeaderProps {
    children: React.ReactNode;
    className?: string;
}

const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => (
    <div className={`px-4 py-3 border-b border-slate-700/50 ${className}`}>
        {children}
    </div>
);

// Card.Body
interface CardBodyProps {
    children: React.ReactNode;
    className?: string;
}

const CardBody: React.FC<CardBodyProps> = ({ children, className = '' }) => (
    <div className={`px-4 py-4 ${className}`}>
        {children}
    </div>
);

// Card.Footer
interface CardFooterProps {
    children: React.ReactNode;
    className?: string;
}

const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => (
    <div className={`px-4 py-3 border-t border-slate-700/50 bg-slate-900/30 ${className}`}>
        {children}
    </div>
);

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
