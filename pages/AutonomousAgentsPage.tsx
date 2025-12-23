import React from 'react';
import { Bot } from 'lucide-react';

import AutonomousAgentsControl from '../components/AutonomousAgentsControl';
import AutonomousAnalyticsControl from '../components/AutonomousAnalyticsControl';
import AutonomousInterviewControl from '../components/AutonomousInterviewControl';
import AutonomousSchedulingControl from '../components/AutonomousSchedulingControl';
import AutonomousScreeningControl from '../components/AutonomousScreeningControl';
import { useData } from '../contexts/DataContext';

const AutonomousAgentsPage: React.FC = () => {
    const { jobs } = useData();

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100">
            <div className="container mx-auto p-6 max-w-6xl">
                <div className="mb-8">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-lg">
                            <Bot className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                            Autonomous Agents
                        </h1>
                    </div>
                    <p className="text-slate-400 ml-14">
                        Background workers that monitor and assist while the app is open. Agents are recommend-only by default and surface
                        proposals in Pulse and the Agent Inbox for you to review before applying.
                    </p>
                </div>

                <AutonomousAgentsControl jobs={jobs} />

                <div className="mt-8">
                    <AutonomousScreeningControl jobs={jobs} />
                </div>

                <div className="mt-8">
                    <AutonomousSchedulingControl jobs={jobs} />
                </div>

                <div className="mt-8">
                    <AutonomousInterviewControl jobs={jobs} />
                </div>

                <div className="mt-8">
                    <AutonomousAnalyticsControl jobs={jobs} />
                </div>
            </div>
        </div>
    );
};

export default AutonomousAgentsPage;
