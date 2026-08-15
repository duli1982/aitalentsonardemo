import React, { useState } from 'react';
import { Brain, Briefcase, ClipboardCheck, GitBranch, Users, Building2, TrendingUp, Bot, Inbox, Map, Shield, LayoutGrid, Bell, Menu, X, BarChart2, Sparkles, UploadCloud, ChevronDown, LogOut, Gauge, Search } from 'lucide-react';
import PulseFeed from './PulseFeed';
import { pulseService } from '../services/PulseService';
import { AppView } from '../types';
import AgentStatusIndicator from './AgentStatusIndicator';
import { useAuth } from '../contexts/AuthContext';
import { canAccessWorkforcePlanning, canViewTeamPerformance } from '../utils/permissions';

interface HeaderProps {
    activeView: AppView;
    onViewChange: (view: AppView) => void;
    onOpenSmartSearch?: () => void;
    onOpenRAG?: () => void;
    onOpenUploadCv?: () => void;
    showNavigation?: boolean;
    showMobileNavigation?: boolean;
    onOpenGlobalSearch?: () => void;
}

interface NavItem {
    id: AppView;
    icon: React.ReactNode;
    label: string;
    color: string;
}

const NAV_GROUPS: { name: string; items: NavItem[] }[] = [
    {
        name: 'Core',
        items: [
            { id: 'command-center', icon: <Gauge size={18} />, label: 'Command Center', color: 'sky' },
            { id: 'my-work', icon: <ClipboardCheck size={18} />, label: 'My Work', color: 'sky' },
            { id: 'jobs', icon: <Briefcase size={18} />, label: 'Jobs', color: 'sky' },
            { id: 'candidates', icon: <Users size={18} />, label: 'Candidates', color: 'sky' },
            { id: 'pipeline', icon: <GitBranch size={18} />, label: 'Pipeline', color: 'sky' },
            { id: 'hiring-manager', icon: <Users size={18} />, label: 'Hiring Manager', color: 'sky' },
            { id: 'attraction', icon: <Sparkles size={18} />, label: 'Talent Attraction', color: 'pink' },
            { id: 'screening-engagement', icon: <ClipboardCheck size={18} />, label: 'Screening & Plans', color: 'pink' },
        ]
    },
    {
        name: 'Intelligence',
        items: [
            { id: 'manager-dashboard', icon: <BarChart2 size={18} />, label: 'Manager Dashboard', color: 'purple' },
            { id: 'insights', icon: <BarChart2 size={18} />, label: 'Insights', color: 'purple' },
            { id: 'org-twin', icon: <Building2 size={18} />, label: 'Workforce Planning', color: 'purple' },
            { id: 'forecast', icon: <TrendingUp size={18} />, label: 'Forecast', color: 'purple' },
            { id: 'mobility', icon: <Map size={18} />, label: 'Internal Mobility', color: 'purple' },
        ]
    },
    {
        name: 'AI & Governance',
        items: [
            { id: 'agents', icon: <Bot size={18} />, label: 'Agents', color: 'emerald' },
            { id: 'autonomous-agents', icon: <Bot size={18} />, label: 'Autonomous', color: 'emerald' },
            { id: 'agent-inbox', icon: <Inbox size={18} />, label: 'Inbox', color: 'emerald' },
            { id: 'governance', icon: <Shield size={18} />, label: 'Governance', color: 'emerald' },
            { id: 'war-room', icon: <LayoutGrid size={18} />, label: 'War Room', color: 'pink' },
        ]
    }
];

const Header: React.FC<HeaderProps> = ({ activeView, onViewChange, onOpenSmartSearch, onOpenRAG, onOpenUploadCv, showNavigation = true, showMobileNavigation = true, onOpenGlobalSearch }) => {
    const [isPulseOpen, setIsPulseOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isOrganizationMenuOpen, setIsOrganizationMenuOpen] = useState(false);
    const { user, memberships, activeOrganization, setActiveOrganization, signOut, isDemoMode } = useAuth();
    const showWorkforcePlanning = canAccessWorkforcePlanning(activeOrganization?.role);
    const showManagerDashboard = canViewTeamPerformance(activeOrganization?.role);
    const visibleGroups = NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => (item.id !== 'org-twin' || showWorkforcePlanning) && (item.id !== 'manager-dashboard' || showManagerDashboard)) }));

    const getActiveColor = (color: string) => {
        const colors: Record<string, string> = {
            sky: 'bg-sky-600',
            purple: 'bg-purple-600',
            emerald: 'bg-emerald-600',
            pink: 'bg-pink-600'
        };
        return colors[color] || 'bg-sky-600';
    };

    const handleNavClick = (view: AppView) => {
        onViewChange(view);
        setIsMobileMenuOpen(false);
    };

    return (
        <>
            <header className="bg-slate-900 border-b border-slate-700 h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-50">
                {/* Logo */}
                <div className="flex items-center space-x-2 lg:hidden">
                    <div className="bg-gradient-to-tr from-sky-500 to-indigo-600 p-2 rounded-lg shadow-lg shadow-sky-900/20">
                        <Brain className="text-white h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
                    </div>
                    <div className="hidden sm:block">
                        <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-400">
                            Talent Sonar
                        </h1>
                    </div>
                </div>

                {/* Desktop Navigation */}
                {showNavigation && <nav className="hidden lg:flex items-center space-x-1" role="navigation" aria-label="Main navigation">
                    {visibleGroups.map((group) => (
                        <div key={group.name} className="flex bg-slate-800/50 rounded-full p-1 border border-slate-700/50 mr-2">
                            {group.items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => onViewChange(item.id)}
                                    title={item.label}
                                    aria-label={item.label}
                                    aria-current={activeView === item.id ? 'page' : undefined}
                                    className={`${item.id === 'command-center' ? 'px-3' : 'p-2'} rounded-full transition-colors inline-flex items-center gap-2 ${activeView === item.id
                                        ? `${getActiveColor(item.color)} text-white shadow-md`
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                        }`}
                                >
                                    {item.icon}
                                    {item.id === 'command-center' && <span className="hidden xl:inline text-xs font-semibold">Command Center</span>}
                                </button>
                            ))}
                        </div>
                    ))}

                    {/* Pulse Bell */}
	                    <button
	                        onClick={() => setIsPulseOpen(!isPulseOpen)}
	                        title="Talent Pulse"
	                        aria-label={`Notifications${pulseService.getUnreadCount() > 0 ? ` (${pulseService.getUnreadCount()} unread)` : ''}`}
	                        className={`p-2 rounded-full transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${isPulseOpen ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}
	                    >
                        <Bell size={18} aria-hidden="true" />
                        {pulseService.getUnreadCount() > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-slate-900" aria-hidden="true"></span>
                        )}
                    </button>
                </nav>}

                {/* Right side buttons */}
                <div className="flex items-center space-x-2">
                    <AgentStatusIndicator onOpenAutonomousAgents={() => onViewChange('autonomous-agents')} />
                    {onOpenGlobalSearch && <button type="button" onClick={onOpenGlobalSearch} className="hidden md:inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"><Search className="h-4 w-4 text-sky-300" />Search <span className="rounded border border-slate-600 px-1 text-[10px] text-slate-500">⌘K</span></button>}

                    <div className="relative hidden md:block">
                        <button
                            type="button"
                            onClick={() => setIsOrganizationMenuOpen((value) => !value)}
                            className="flex max-w-56 items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                            aria-expanded={isOrganizationMenuOpen}
                        >
                            <Building2 className="h-4 w-4 text-sky-300" />
                            <span className="truncate">{activeOrganization?.organizationName ?? 'No workspace'}</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {isOrganizationMenuOpen && (
                            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
                                <p className="px-2 py-1 text-xs text-slate-500">{user?.email ?? 'Local demo'}</p>
                                {memberships.map((membership) => (
                                    <button key={membership.organizationId} type="button" onClick={() => { setActiveOrganization(membership.organizationId); setIsOrganizationMenuOpen(false); }} className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-800 ${membership.organizationId === activeOrganization?.organizationId ? 'text-sky-300' : 'text-slate-200'}`}>
                                        <span className="block truncate">{membership.organizationName}</span>
                                        <span className="text-xs text-slate-500">{membership.role}</span>
                                    </button>
                                ))}
                                {!isDemoMode && <button type="button" onClick={() => void signOut()} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-slate-800 px-2 pt-3 text-sm text-slate-300 hover:text-white"><LogOut className="h-4 w-4" />Sign out</button>}
                            </div>
                        )}
                    </div>

                    {/* Upload CVs */}
                    {onOpenUploadCv && (
                        <button
                            onClick={onOpenUploadCv}
                            className="hidden sm:flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-full transition-all text-xs md:text-sm shadow-lg border border-slate-700"
                            title="Upload CVs - Create draft candidates for review"
                            aria-label="Upload CVs"
                            type="button"
                        >
                            <UploadCloud className="h-4 w-4 mr-1 md:mr-2" aria-hidden="true" />
                            <span className="hidden md:inline">Upload CVs</span>
                        </button>
                    )}

                    {/* Smart Search Button */}
                    {onOpenSmartSearch && (
                        <button
                            onClick={onOpenSmartSearch}
                            className="hidden sm:flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold rounded-full transition-all text-xs md:text-sm shadow-lg"
                            title="AI Smart Search - Search the Knowledge Graph"
                            aria-label="AI Smart Search"
                        >
                            <Sparkles className="h-4 w-4 mr-1 md:mr-2" aria-hidden="true" />
                            <span className="hidden md:inline">Smart Search</span>
                        </button>
                    )}

                    {/* RAG Query Button */}
                    {onOpenRAG && (
                        <button
                            onClick={onOpenRAG}
                            className="hidden sm:flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-full transition-all text-xs md:text-sm shadow-lg"
                            title="RAG Query - AI-powered responses with candidate context"
                            aria-label="RAG Query"
                        >
                            <Brain className="h-4 w-4 mr-1 md:mr-2" aria-hidden="true" />
                            <span className="hidden md:inline">RAG Query</span>
                        </button>
                    )}

                    {/* Mobile Pulse Bell */}
	                    <button
	                        onClick={() => setIsPulseOpen(!isPulseOpen)}
	                        className="lg:hidden p-2 rounded-full text-slate-400 hover:text-white relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
	                        aria-label="Notifications"
	                        type="button"
	                    >
                        <Bell size={20} aria-hidden="true" />
                        {pulseService.getUnreadCount() > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        )}
                    </button>

                    {/* Mobile Menu Toggle */}
                    {showMobileNavigation && <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={isMobileMenuOpen}
                    >
                        {isMobileMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
                    </button>}
                </div>
            </header>

            {/* Mobile Navigation Drawer */}
            {showMobileNavigation && isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 top-16 bg-slate-900/95 backdrop-blur-sm z-40 overflow-y-auto">
                    <nav className="p-4 space-y-4" role="navigation" aria-label="Mobile navigation">
                        {visibleGroups.map(group => (
                            <div key={group.name}>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                                    {group.name}
                                </h3>
                                <div className="space-y-1">
                                    {group.items.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleNavClick(item.id)}
                                            aria-current={activeView === item.id ? 'page' : undefined}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeView === item.id
                                                ? `${getActiveColor(item.color)} text-white`
                                                : 'text-slate-300 hover:bg-slate-800'
                                                }`}
                                        >
                                            {item.icon}
                                            <span className="font-medium">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Mobile Action Buttons */}
                        <div className="pt-4 border-t border-slate-700 space-y-2">
                            {onOpenUploadCv && (
                                <button
                                    onClick={() => { onOpenUploadCv(); setIsMobileMenuOpen(false); }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white font-semibold rounded-lg border border-slate-700"
                                >
                                    <UploadCloud size={18} aria-hidden="true" />
                                    Upload CVs
                                </button>
                            )}
                            {onOpenSmartSearch && (
                                <button
                                    onClick={() => { onOpenSmartSearch(); setIsMobileMenuOpen(false); }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold rounded-lg"
                                >
                                    <Sparkles size={18} aria-hidden="true" />
                                    Smart Search
                                </button>
                            )}
                            {onOpenRAG && (
                                <button
                                    onClick={() => { onOpenRAG(); setIsMobileMenuOpen(false); }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg"
                                >
                                    <Brain size={18} aria-hidden="true" />
                                    RAG Query
                                </button>
                            )}
                        </div>
                    </nav>
                </div>
            )}

            <PulseFeed isOpen={isPulseOpen} onClose={() => setIsPulseOpen(false)} />
        </>
    );
};

export default Header;
