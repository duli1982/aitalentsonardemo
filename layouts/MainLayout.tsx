import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { useToast } from '../contexts/ToastContext';
import { AlertTriangle, X } from 'lucide-react';
import { AppView } from '../types';
import DegradedModeBanner from '../components/DegradedModeBanner';

interface MainLayoutProps {
    error: string | null;
    setError: (error: string | null) => void;
    onOpenSmartSearch?: () => void;
    onOpenRAG?: () => void;
    onOpenUploadCv?: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ error, setError, onOpenSmartSearch, onOpenRAG, onOpenUploadCv }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Map current path to AppView for Header highlighting
    const activeView: AppView =
        location.pathname === '/pipeline' ? 'pipeline' :
            location.pathname === '/candidates' ? 'candidates' :
                location.pathname === '/insights' ? 'insights' :
                    location.pathname === '/org-twin' ? 'org-twin' :
                        location.pathname === '/forecast' ? 'forecast' :
                                location.pathname === '/agents' ? 'agents' :
                                    location.pathname === '/autonomous-agents' ? 'autonomous-agents' :
                                        location.pathname === '/agent-inbox' ? 'agent-inbox' :
                                            location.pathname === '/mobility' ? 'mobility' :
                                                location.pathname === '/governance' ? 'governance' :
                                                    location.pathname === '/health' ? 'health' :
                                                        'jobs';

    const handleViewChange = (view: AppView) => {
        navigate(view === 'jobs' ? '/' : `/${view}`);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-gray-100 font-sans flex flex-col">
            <Header
                activeView={activeView}
                onViewChange={handleViewChange}
                onOpenSmartSearch={onOpenSmartSearch}
                onOpenRAG={onOpenRAG}
                onOpenUploadCv={onOpenUploadCv}
            />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                <DegradedModeBanner />
            </div>

            {error && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600/90 text-white p-3 rounded-md shadow-lg z-[150] flex items-center max-w-md">
                    <AlertTriangle size={20} className="mr-2" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-4 text-red-200 hover:text-white"><X size={18} /></button>
                </div>
            )}

            <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow transition-all duration-300 ease-in-out flex flex-col">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
