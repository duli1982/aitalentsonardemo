import React from 'react';
import { Activity, BarChart2, Bot, Brain, BriefcaseBusiness, Building2, ClipboardCheck, Gauge, GitBranch, Inbox, LayoutGrid, Map, Megaphone, Shield, TrendingUp, Users } from 'lucide-react';
import type { AppView } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { canAccessWorkforcePlanning, canViewTeamPerformance } from '../utils/permissions';

type SidebarItem = { id: AppView; label: string; icon: React.ReactNode; badge?: 'inbox' };
const groups: Array<{ label: string; items: SidebarItem[] }> = [
  { label: 'Workspace', items: [
    { id: 'command-center', label: 'Command Center', icon: <Gauge className="h-5 w-5" /> },
    { id: 'my-work', label: 'My work', icon: <ClipboardCheck className="h-5 w-5" /> },
    { id: 'jobs', label: 'Requisitions', icon: <BriefcaseBusiness className="h-5 w-5" /> },
    { id: 'candidates', label: 'Talent', icon: <Users className="h-5 w-5" /> },
    { id: 'talent-pools', label: 'Talent pools', icon: <Users className="h-5 w-5" /> },
    { id: 'pipeline', label: 'Pipeline', icon: <GitBranch className="h-5 w-5" /> },
    { id: 'agent-inbox', label: 'Review inbox', icon: <Inbox className="h-5 w-5" />, badge: 'inbox' },
    { id: 'follow-ups', label: 'My follow-ups', icon: <Activity className="h-5 w-5" /> },
    { id: 'engagement', label: 'Engagement hub', icon: <Megaphone className="h-5 w-5" /> },
    { id: 'screening-engagement', label: 'Screening & plans', icon: <ClipboardCheck className="h-5 w-5" /> },
    { id: 'conversation-platform', label: 'Assessments & navigator', icon: <ClipboardCheck className="h-5 w-5" /> },
    { id: 'attraction', label: 'Talent attraction', icon: <Megaphone className="h-5 w-5" /> },
    { id: 'hiring-manager', label: 'Hiring manager', icon: <Users className="h-5 w-5" /> },
  ] },
  { label: 'Intelligence', items: [
    { id: 'manager-dashboard', label: 'Manager dashboard', icon: <BarChart2 className="h-5 w-5" /> },
    { id: 'insights', label: 'Insights', icon: <BarChart2 className="h-5 w-5" /> },
    { id: 'org-twin', label: 'Workforce planning', icon: <Building2 className="h-5 w-5" /> },
    { id: 'forecast', label: 'Forecast', icon: <TrendingUp className="h-5 w-5" /> },
    { id: 'mobility', label: 'Internal mobility', icon: <Map className="h-5 w-5" /> },
  ] },
  { label: 'Automation & governance', items: [
    { id: 'autonomous-agents', label: 'Automations', icon: <Bot className="h-5 w-5" /> },
    { id: 'agents', label: 'Agent studio', icon: <Activity className="h-5 w-5" /> },
    { id: 'governance', label: 'Governance', icon: <Shield className="h-5 w-5" /> },
    { id: 'war-room', label: 'War room', icon: <LayoutGrid className="h-5 w-5" /> },
  ] },
];

const AppSidebar: React.FC<{ activeView: AppView; onViewChange: (view: AppView) => void }> = ({ activeView, onViewChange }) => {
  const { activeOrganization } = useAuth();
  const showWorkforcePlanning = canAccessWorkforcePlanning(activeOrganization?.role);
  const showManagerDashboard = canViewTeamPerformance(activeOrganization?.role);
  return <aside className="hidden h-screen min-h-0 w-72 shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-slate-950 lg:flex">
    <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6"><div className="rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 p-2.5 shadow-lg shadow-sky-950/50"><Brain className="h-6 w-6 text-white" /></div><div><p className="text-lg font-bold tracking-tight text-white">Talent Sonar</p><p className="text-xs text-slate-500">Recruiting workspace</p></div></div>
    <div className="px-4 pt-5"><button type="button" onClick={() => onViewChange('command-center')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${activeView === 'command-center' ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/30' : 'bg-slate-900 text-slate-200 hover:bg-slate-800'}`}><Gauge className="h-5 w-5" /> Today’s Command Center</button></div>
    <nav className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5" aria-label="Primary navigation">{groups.map((group) => <div key={group.label} className="mb-6"><p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">{group.label}</p><div className="space-y-1">{group.items.filter((item) => item.id !== 'command-center' && (item.id !== 'org-twin' || showWorkforcePlanning) && (item.id !== 'manager-dashboard' || showManagerDashboard)).map((item) => <button key={item.id} type="button" onClick={() => onViewChange(item.id)} aria-current={activeView === item.id ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${activeView === item.id ? 'bg-slate-800 font-semibold text-sky-200' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}><span className={activeView === item.id ? 'text-sky-300' : 'text-slate-500'}>{item.icon}</span><span className="flex-1">{item.label}</span>{item.badge && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">Review</span>}</button>)}</div></div>)}</nav>
    <div className="border-t border-slate-800 p-4"><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><p className="truncate text-sm font-semibold text-slate-200">{activeOrganization?.organizationName ?? 'No workspace selected'}</p><p className="mt-1 text-xs text-slate-500">Switch workspace from the top bar</p></div></div>
  </aside>;
};

export default AppSidebar;
