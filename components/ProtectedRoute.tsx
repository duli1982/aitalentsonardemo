// ProtectedRoute - Route guard for access control
// Wraps routes that require authentication or specific roles

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield, Lock } from 'lucide-react';

type UserRole = 'admin' | 'hiring_manager' | 'recruiter' | 'viewer';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: UserRole;
    requiredRoles?: UserRole[];
    fallbackPath?: string;
}

// Mock authentication state (in real app, this would come from auth context)
const useAuth = () => {
    // Simulated logged-in user
    return {
        isAuthenticated: true,
        user: {
            id: 'user_1',
            name: 'Demo User',
            role: 'hiring_manager' as UserRole,
        }
    };
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requiredRole,
    requiredRoles = [],
    fallbackPath = '/'
}) => {
    const { isAuthenticated, user } = useAuth();
    const location = useLocation();

    // Check authentication
    if (!isAuthenticated) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center p-8 bg-slate-800 rounded-xl border border-slate-700">
                    <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
                    <p className="text-slate-400 mb-4">Please log in to access this page.</p>
                    <Navigate to={fallbackPath} state={{ from: location }} replace />
                </div>
            </div>
        );
    }

    // Check role authorization
    const allowedRoles = requiredRole ? [requiredRole, ...requiredRoles] : requiredRoles;

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center p-8 bg-slate-800 rounded-xl border border-red-500/30">
                    <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                    <p className="text-slate-400 mb-4">
                        You need <span className="text-red-400 font-mono">{allowedRoles.join(' or ')}</span> role to access this page.
                    </p>
                    <p className="text-xs text-slate-500">
                        Current role: <span className="text-slate-300">{user.role}</span>
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
