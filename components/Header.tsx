import React, { useState } from 'react';
import { Brain, Briefcase, GitBranch, Users, Building2, TrendingUp, Bot, Map, Shield, LayoutGrid, Bell, Menu, X, BarChart2, Sparkles } from 'lucide-react';
import PulseFeed from './PulseFeed';
import { pulseService } from '../services/PulseService';
import { AppView } from '../types';

interface HeaderProps {
    activeView: AppView;
    onViewChange: (view: AppView) => void;
    onOpenSmartSearch?: () => void;
    onOpenRAG?: () => void;
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
            { id: 'jobs', icon: <Briefcase size={18} />, label: 'Jobs', color: 'sky' },
            { id: 'candidates', icon: <Users size={18} />, label: 'Candidates', color: 'sky' },
            { id: 'pipeline', icon: <GitBranch size={18} />, label: 'Pipeline', color: 'sky' },
        ]
    },
    {
        name: 'Intelligence',
        items: [
            { id: 'insights', icon: <BarChart2 size={18} />, label: 'Insights', color: 'purple' },
            { id: 'org-twin', icon: <Building2 size={18} />, label: 'Org Twin', color: 'purple' },
            { id: 'forecast', icon: <TrendingUp size={18} />, label: 'Forecast', color: 'purple' },
            { id: 'mobility', icon: <Map size={18} />, label: 'Mobility', color: 'purple' },
        ]
    },
    {
        name: 'AI & Governance',
        items: [
            { id: 'agents', icon: <Bot size={18} />, label: 'Agents', color: 'emerald' },
            { id: 'autonomous-agents', icon: <Bot size={18} />, label: 'Autonomous', color: 'emerald' },
            { id: 'governance', icon: <Shield size={18} />, label: 'Governance', color: 'emerald' },
            { id: 'war-room', icon: <LayoutGrid size={18} />, label: 'War Room', color: 'pink' },
        ]
    }
];

const Header: React.FC<HeaderProps> = ({ activeView, onViewChange, onOpenSmartSearch, onOpenRAG }) => {
    const [isPulseOpen, setIsPulseOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
                <div className="flex items-center space-x-2">
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
                <nav className="hidden lg:flex items-center space-x-1" role="navigation" aria-label="Main navigation">
                    {NAV_GROUPS.map((group, idx) => (
                        <div key={group.name} className="flex bg-slate-800/50 rounded-full p-1 border border-slate-700/50 mr-2">
                            {group.items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => onViewChange(item.id)}
                                    title={item.label}
                                    aria-label={item.label}
                                    aria-current={activeView === item.id ? 'page' : undefined}
                                    className={`p-2 rounded-full transition-colors ${activeView === item.id
                                        ? `${getActiveColor(item.color)} text-white shadow-md`
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                        }`}
                                >
                                    {item.icon}
                                </button>
                            ))}
                        </div>
                    ))}

                    {/* Pulse Bell */}
                    <button
                        onClick={() => setIsPulseOpen(!isPulseOpen)}
                        title="Talent Pulse"
                        aria-label={`Notifications${pulseService.getUnreadCount() > 0 ? ` (${pulseService.getUnreadCount()} unread)` : ''}`}
                        className={`p-2 rounded-full transition-colors relative ${isPulseOpen ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Bell size={18} aria-hidden="true" />
                        {pulseService.getUnreadCount() > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-slate-900" aria-hidden="true"></span>
                        )}
                    </button>
                </nav>

                {/* Right side buttons */}
                <div className="flex items-center space-x-2">
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
                        className="lg:hidden p-2 rounded-full text-slate-400 hover:text-white relative"
                        aria-label="Notifications"
                    >
                        <Bell size={20} aria-hidden="true" />
                        {pulseService.getUnreadCount() > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        )}
                    </button>

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={isMobileMenuOpen}
                    >
                        {isMobileMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
                    </button>
                </div>
            </header>

            {/* Mobile Navigation Drawer */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 top-16 bg-slate-900/95 backdrop-blur-sm z-40 overflow-y-auto">
                    <nav className="p-4 space-y-4" role="navigation" aria-label="Mobile navigation">
                        {NAV_GROUPS.map(group => (
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
