import React from 'react';
import CsvIngestionControl from '../components/CsvIngestionControl';
import JobIntelligenceControl from '../components/JobIntelligenceControl';

const IngestPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <div className="pt-24 px-4 sm:px-6 max-w-7xl mx-auto pb-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Admin: Data Ingestion
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Import candidate records into this browser's local workspace and inspect public job-board data.
                    </p>
                </div>

                <CsvIngestionControl />

                <JobIntelligenceControl />

            </div>
        </div>
    );
};

export default IngestPage;
