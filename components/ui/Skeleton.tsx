import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'text',
    width,
    height
}) => {
    const baseClasses = "animate-pulse bg-slate-700/50 rounded";
    const variantClasses = {
        text: "h-4 w-full",
        circular: "rounded-full",
        rectangular: ""
    };

    const style = {
        width: width,
        height: height
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
        />
    );
};

export default Skeleton;
