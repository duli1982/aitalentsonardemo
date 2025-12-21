import React, { useState, useEffect } from 'react';
import { LayoutGrid, Maximize, MousePointer2, UserPlus, Users, MessageSquare } from 'lucide-react';

interface GhostCursor {
    id: string;
    user: string;
    color: string;
    x: number;
    y: number;
    action?: string;
}

const WarRoomPage: React.FC = () => {
    const [cursors, setCursors] = useState<GhostCursor[]>([
        { id: 'c1', user: 'Sarah (Recruiter)', color: '#3b82f6', x: 200, y: 300 }, // Blue
        { id: 'c2', user: 'Dave (VP Eng)', color: '#a855f7', x: 800, y: 150 }, // Purple
    ]);

    // Simulate multiplayer movement
    useEffect(() => {
        const interval = setInterval(() => {
            setCursors(prev => prev.map(c => ({
                ...c,
                x: c.x + (Math.random() - 0.5) * 50,
                y: c.y + (Math.random() - 0.5) * 50,
                action: Math.random() > 0.8 ? (Math.random() > 0.5 ? 'viewing' : 'moving') : undefined
            })));
        }, 800);
        return () => clearInterval(interval);
    }, []);

    // Mock candidates on the board
    const cards = [
        { id: '1', name: 'Michael Chen', role: 'Senior Data Scientist', stage: 'Onsite', x: 100, y: 100 },
        { id: '2', name: 'Alisa V.', role: 'Product Lead', stage: 'Offer', x: 400, y: 100 },
        { id: '3', name: 'Priya P.', role: 'Senior UX', stage: 'Screen', x: 100, y: 300 },
    ];

    return (
        <div className="h-[calc(100vh-80px)] bg-slate-900 overflow-hidden relative selection-none">
            {/* Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-full px-6 py-2 flex items-center space-x-6 shadow-xl z-20">
                <div className="flex items-center space-x-2 text-white font-bold">
                    <LayoutGrid size={18} className="text-pink-500" />
                    <span>Hiring Committee: Q4 Senior Roles</span>
                </div>
                <div className="w-px h-6 bg-slate-700"></div>
                <div className="flex items-center space-x-2">
                    <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-slate-800 flex items-center justify-center text-xs text-white font-bold" title="Sarah">S</div>
                        <div className="w-8 h-8 rounded-full bg-purple-500 border-2 border-slate-800 flex items-center justify-center text-xs text-white font-bold" title="Dave">D</div>
                        <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-slate-800 flex items-center justify-center text-xs text-white font-bold" title="You">Y</div>
                        <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold">+2</div>
                    </div>
                    <button className="bg-pink-600 hover:bg-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                        <UserPlus size={12} className="mr-1" /> Invite
                    </button>
                    <button className="text-slate-400 hover:text-white">
                        <MessageSquare size={18} />
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="w-full h-full p-10 relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800/20 to-slate-900 mt-10">
                {/* Columns */}
                <div className="grid grid-cols-4 gap-8 h-full opacity-30 pointer-events-none">
                    <div className="border-r border-dashed border-slate-700"></div>
                    <div className="border-r border-dashed border-slate-700"></div>
                    <div className="border-r border-dashed border-slate-700"></div>
                </div>

                {/* Cards */}
                {cards.map(card => (
                    <div
                        key={card.id}
                        className="absolute w-64 bg-slate-800 border-2 border-slate-600 rounded-xl p-4 shadow-2xl hover:border-pink-500 cursor-grab active:cursor-grabbing transition-transform hover:scale-105 z-10"
                        style={{ left: card.x, top: card.y }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-white font-bold">{card.name}</h3>
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded uppercase">{card.stage}</span>
                        </div>
                        <p className="text-slate-400 text-xs mb-3">{card.role}</p>
                        <div className="flex justify-between items-center">
                            <div className="flex space-x-1">
                                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                            </div>
                            <span className="text-[10px] text-slate-500">Updated 2m ago</span>
                        </div>
                    </div>
                ))}

                {/* Ghost Cursors */}
                {cursors.map(cursor => (
                    <div
                        key={cursor.id}
                        className="absolute pointer-events-none transition-all duration-700 ease-in-out z-50"
                        style={{ left: cursor.x, top: cursor.y }}
                    >
                        <MousePointer2
                            size={24}
                            fill={cursor.color}
                            color="white"
                            className="drop-shadow-lg transform -rotate-12"
                        />
                        <div
                            className="absolute left-6 top-2 px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm whitespace-nowrap"
                            style={{ backgroundColor: cursor.color }}
                        >
                            {cursor.user} {cursor.action && <span className="opacity-75 italic">- {cursor.action}...</span>}
                        </div>
                    </div>
                ))}

            </div>

            <div className="absolute bottom-6 right-6 text-slate-600 text-xs font-mono">
                Multiplayer Session Active • Latency 12ms
            </div>
        </div>
    );
};

export default WarRoomPage;
