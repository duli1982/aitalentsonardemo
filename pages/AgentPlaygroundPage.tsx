import React, { useState } from 'react';
import { AgentRole, AgentRequest, AgentResponse } from '../types/agent';
import { agentGateway } from '../services/AgentGateway';
import { Bot, User, Shield, Terminal, Send, Database } from 'lucide-react';
import { TIMING } from '../config/timing';

const AgentPlaygroundPage: React.FC = () => {
    const [role, setRole] = useState<AgentRole>('HIRING_MANAGER');
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<{ type: 'user' | 'agent', text: string }[]>([
        { type: 'agent', text: 'Hello. I am the Talent Sonar Gateway. Connect your agent or use this chat to test my API.' }
    ]);
    const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);

    const handleSend = async () => {
        if (!query.trim() || isLoading) return;

        // Add User Message
        setHistory(prev => [...prev, { type: 'user', text: query }]);
        const currentQuery = query;
        setQuery('');
        setIsLoading(true);

        // Construct Request
        // Infer intent loosely for demo
        let intent: 'FIND_CANDIDATES' | 'FIND_CAREER_PATH' | 'GENERAL_QUERY' = 'GENERAL_QUERY';
        if (currentQuery.toLowerCase().includes('find') || currentQuery.toLowerCase().includes('search')) {
            if (role === 'CANDIDATE') intent = 'FIND_CAREER_PATH';
            else intent = 'FIND_CANDIDATES';
        }

        const request: AgentRequest = {
            intent,
            query: currentQuery,
            context: {
                role,
                userId: 'demo_user',
                permissions: []
            }
        };

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, TIMING.AGENT_PLAYGROUND_NETWORK_DELAY_MS));

        // Call Gateway
        const response = await agentGateway.handleRequest(request);
        setLastResponse(response);
        setIsLoading(false);

        // Add Agent Message
        setHistory(prev => [...prev, { type: 'agent', text: response.message }]);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] gap-6 p-2">
            {/* Header Controls */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                <div className="flex items-center">
                    <Bot className="text-purple-400 mr-3" />
                    <div>
                        <h2 className="text-xl font-bold text-white">Agent API Playground</h2>
                        <p className="text-slate-400 text-sm">Simulate external AI agents querying the Talent Sonar brain.</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase font-bold">Acting As</p>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as AgentRole)}
                            className="bg-slate-700 text-white text-sm rounded border border-slate-600 p-1 outline-none"
                        >
                            <option value="HIRING_MANAGER">Hiring Manager Agent</option>
                            <option value="CANDIDATE">Candidate Agent</option>
                            <option value="RECRUITER">Recruiter Agent</option>
                        </select>
                    </div>
                    <div className={`p-2 rounded-full ${role === 'HIRING_MANAGER' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                        <User size={20} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow min-h-0">

                {/* Left: Conversational Interface */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                    <div className="bg-slate-900/50 p-3 border-b border-slate-700 flex items-center">
                        <Terminal size={16} className="text-slate-400 mr-2" />
                        <span className="text-xs font-mono text-slate-300">chat_session_v1.log</span>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {history.map((msg, i) => (
                            <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.type === 'user'
                                    ? 'bg-purple-600 text-white rounded-br-none'
                                    : 'bg-slate-700 text-slate-200 rounded-bl-none'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-700 text-slate-200 rounded-lg rounded-bl-none p-3 text-sm animate-pulse">
                                    Thinking...
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-700 bg-slate-800">
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-4 pr-12 py-3 text-white focus:border-purple-500 outline-none"
                                placeholder="Ask the system something..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            />
                            <button
                                onClick={handleSend}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 hover:bg-slate-700 rounded-full text-purple-400 transition-colors"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                        {role === 'HIRING_MANAGER' && (
                            <div className="mt-2 flex gap-2">
                                <button onClick={() => setQuery("Find internal people who could move into the Production Lead role")} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors">
                                    "Find internal candidates..."
                                </button>
                            </div>
                        )}
                        {role === 'CANDIDATE' && (
                            <div className="mt-2 flex gap-2">
                                <button onClick={() => setQuery("Find internal people who could move into the Production Lead role")} className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-900/50 px-2 py-1 rounded transition-colors" title="This should fail permissions">
                                    "Find other candidates..." (Fail Test)
                                </button>
                                <button onClick={() => setQuery("Show me internal roles where I can use my skills")} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors">
                                    "Show career paths..."
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: API JSON Debugger */}
                <div className="bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden font-mono">
                    <div className="bg-slate-800 p-3 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center">
                            <Database size={16} className="text-blue-400 mr-2" />
                            <span className="text-xs text-blue-300">API Response Payload</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Shield size={14} className={lastResponse?.success ? 'text-green-500' : 'text-red-500'} />
                            <span className={`text-xs ${lastResponse?.success ? 'text-green-500' : 'text-red-500'}`}>
                                {lastResponse ? (lastResponse.success ? '200 OK' : '403 FORBIDDEN') : 'WAITING'}
                            </span>
                        </div>
                    </div>

                    <div className="flex-grow p-4 overflow-auto custom-scrollbar">
                        {lastResponse ? (
                            <pre className="text-xs text-green-400">
                                {JSON.stringify(lastResponse, null, 2)}
                            </pre>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600">
                                <div className="animate-pulse">Waiting for request...</div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AgentPlaygroundPage;
