import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { useToast } from '../contexts/ToastContext';
import { AlertTriangle, X } from 'lucide-react';
import { AppView } from '../types';
import DegradedModeBanner from '../components/DegradedModeBanner';
import AppSidebar from '../components/AppSidebar';
import GlobalSearch from '../components/GlobalSearch';

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
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setGlobalSearchOpen(true); } if (event.key === 'Escape') setGlobalSearchOpen(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

    // Map current path to AppView for Header highlighting
    const activeView: AppView =
        location.pathname === '/' ? 'command-center' :
        location.pathname.startsWith('/requisitions/') ? 'jobs' :
        location.pathname.startsWith('/candidates/') ? 'candidates' :
        location.pathname === '/pipeline' ? 'pipeline' :
            location.pathname === '/talent-pools' ? 'talent-pools' :
            location.pathname === '/candidates' ? 'candidates' :
                location.pathname === '/insights' ? 'insights' :
                    location.pathname === '/manager-dashboard' || location.pathname === '/portfolio-analytics' ? 'manager-dashboard' :
                    location.pathname === '/my-work' ? 'my-work' :
                    location.pathname === '/org-twin' ? 'org-twin' :
                        location.pathname === '/forecast' ? 'forecast' :
                                location.pathname === '/agents' ? 'agents' :
                                    location.pathname === '/autonomous-agents' ? 'autonomous-agents' :
                                        location.pathname === '/agent-inbox' ? 'agent-inbox' :
                                            location.pathname === '/hiring-manager' ? 'hiring-manager' :
                                                location.pathname === '/follow-ups' ? 'follow-ups' :
                                                    location.pathname === '/engagement' ? 'engagement' :
                                                    location.pathname === '/screening-engagement' ? 'screening-engagement' :
                                                    location.pathname === '/conversation-platform' ? 'conversation-platform' :
                                                    location.pathname === '/attraction' || location.pathname.startsWith('/campaigns/') ? 'attraction' :
                                            location.pathname === '/mobility' ? 'mobility' :
                                            location.pathname === '/governance' ? 'governance' :
                                                location.pathname === '/war-room' ? 'war-room' :
                                                    location.pathname === '/health' ? 'health' :
                                                        'jobs';

    const handleViewChange = (view: AppView) => {
        navigate(view === 'command-center' ? '/' : `/${view}`);
    };

    return (
        <div className="h-screen overflow-hidden bg-slate-950 text-gray-100 font-sans lg:flex">
            <AppSidebar activeView={activeView} onViewChange={handleViewChange} />
            <div className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto">
                <Header
                    activeView={activeView}
                    onViewChange={handleViewChange}
                    onOpenSmartSearch={onOpenSmartSearch}
                    onOpenRAG={onOpenRAG}
                    onOpenUploadCv={onOpenUploadCv}
                    showNavigation={false}
                    showMobileNavigation
                    onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
                />

                <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6 lg:px-8">
                    <DegradedModeBanner />
                </div>

            {error && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600/90 text-white p-3 rounded-md shadow-lg z-[150] flex items-center max-w-md">
                    <AlertTriangle size={20} className="mr-2" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-4 text-red-200 hover:text-white"><X size={18} /></button>
                </div>
            )}

            <main className="mx-auto flex w-full max-w-[1600px] flex-grow flex-col p-4 sm:p-6 lg:p-8">
                <Outlet />
            </main>
            <GlobalSearch isOpen={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
            </div>
        </div>
    );
};

export default MainLayout;
