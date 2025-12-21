import React from 'react';
import Header from '../components/Header';
import IngestControl from '../components/IngestControl';
import BulkIngestionControl from '../components/BulkIngestionControl';
import GraphMigrationControl from '../components/GraphMigrationControl';

const IngestPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <Header />
            <div className="pt-24 px-4 sm:px-6 max-w-7xl mx-auto pb-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Admin: Data Ingestion
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Control panel for ingesting synthetic data into the vector database.
                    </p>
                </div>

                {/* Bulk Generation (New!) */}
                <BulkIngestionControl />

                {/* Knowledge Graph Migration (Phase 2) */}
                <GraphMigrationControl />

                {/* Standard Batch Ingestion & Migration */}
                <IngestControl />
            </div>
        </div>
    );
};

export default IngestPage;
