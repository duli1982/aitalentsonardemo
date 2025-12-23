import React, { useState, useEffect } from 'react';
import { aiService } from '../services/AIService';
import { supabase } from '../services/supabaseClient';
import { Loader2, Database, CheckCircle, AlertCircle, Upload, ArrowRight } from 'lucide-react';
import { migrateAllCandidates, checkMigrationStatus, MigrationProgress } from '../utils/migrateToVectorDB';

const IngestControl: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'generating' | 'embedding' | 'uploading' | 'complete' | 'error'>('idle');
    const [log, setLog] = useState<string[]>([]);
    const [count, setCount] = useState(0);

    // Migration state
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
    const [migrationStatus, setMigrationStatus] = useState<{ total: number; migrated: number } | null>(null);

    const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    // Check migration status on mount
    useEffect(() => {
        checkMigrationStatus().then(setMigrationStatus).catch(console.error);
    }, []);

    const handleIngest = async () => {
        setStatus('generating');
        setLog([]);
        setCount(0);

        try {
            // 1. Generate Random Candidates
            const firstNames = ["James", "Maria", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "Willow", "Kai", "Elara", "Finn"];
            const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Chen", "Kim", "Singh", "Patel"];
            const roles = [
                { title: "Frontend Dev", skills: ["React", "Vue", "Angular", "TypeScript"], desc: "Building responsive UIs." },
                { title: "Backend Eng", skills: ["Node.js", "Python", "Go", "Java"], desc: "Designing scalable APIs." },
                { title: "Data Scientist", skills: ["Python", "PyTorch", "SQL", "Pandas"], desc: "Analyzing complex datasets." },
                { title: "Product Manager", skills: ["Agile", "JIRA", "Roadmap", "Strategy"], desc: "Leading product vision." },
                { title: "DevOps", skills: ["AWS", "Docker", "Kubernetes", "Terraform"], desc: "Optimizing CI/CD pipelines." },
                { title: "UX Designer", skills: ["Figma", "Sketch", "Prototyping", "User Research"], desc: "Creating intuitive user flows." },
                // Non-IT Roles
                { title: "HR Business Partner", skills: ["Employee Relations", "Compliance", "Onboarding", "Culture"], desc: "Aligning people strategy with business goals." },
                { title: "Senior Recruiter", skills: ["Sourcing", "LinkedIn Recruiter", "ATS Management", "Screening"], desc: "Finding top tier talent." },
                { title: "Office Manager", skills: ["Event Planning", "Inventory", "Vendor Management", "Scheduling"], desc: "Ensuring smooth office operations." },
                { title: "Executive Assistant", skills: ["Calendar Management", "Travel Planning", "Excel", "Communication"], desc: "Supporting C-suite executives." }
            ];

            const candidates = Array.from({ length: 5 }).map(() => {
                const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
                const lname = lastNames[Math.floor(Math.random() * lastNames.length)];
                const role = roles[Math.floor(Math.random() * roles.length)];
                const skill = role.skills[Math.floor(Math.random() * role.skills.length)];

                return {
                    name: `${fname} ${lname}`,
                    role: role.title,
                    summary: `${role.title} with 5+ years experience. Expert in ${skill} and ${role.skills[(Math.floor(Math.random() * role.skills.length))]}. ${role.desc} Known for ${['leadership', 'coding speed', 'debugging', 'communication'][Math.floor(Math.random() * 4)]}.`
                };
            });

            addLog(`Generated ${candidates.length} UNIQUE candidate profiles.`);

            setStatus('embedding');
            let successCount = 0;

            for (const c of candidates) {
                addLog(`Embedding: ${c.name}...`);

                // 2. Generate Embedding
                const embeddingRes = await aiService.embedText(c.summary);
                if (!embeddingRes.success || !embeddingRes.data) {
                    addLog(`Failed to embed ${c.name}: ${embeddingRes.error.message}`);
                    continue;
                }

                // 3. Upload to Supabase
                const candidateId = (globalThis as any)?.crypto?.randomUUID?.() ?? crypto.randomUUID();
                const metadata = { id: candidateId, role: c.role, name: c.name, type: 'uploaded', source: 'demo_ingest' };

                // Best-effort: populate candidates + active document if the new schema is deployed.
                try {
                    const { candidatePersistenceService } = await import('../services/CandidatePersistenceService');
                    await candidatePersistenceService.upsertCandidateAndActiveDocument({
                        candidateId,
                        fullName: c.name,
                        title: c.role,
                        skills: [],
                        candidateMetadata: metadata,
                        documentContent: `${c.name} - ${c.role}. ${c.summary}`,
                        documentMetadata: metadata,
                        embedding: embeddingRes.data,
                        source: 'demo_ingest'
                    });
                    successCount++;
                    setCount(successCount);
                    continue;
                } catch {
                    // Fallback to legacy insert below.
                }

                const { error } = await supabase
                    .from('candidate_documents')
                    .insert({
                        content: `${c.name} - ${c.role}. ${c.summary}`,
                        metadata,
                        embedding: embeddingRes.data
                    });

                if (error) {
                    addLog(`Supabase Error (${c.name}): ${error.message}`);
                } else {
                    successCount++;
                    setCount(successCount);
                }
            }

            setStatus('complete');
            addLog(`Successfully ingested ${successCount}/${candidates.length} profiles.`);

        } catch (err) {
            console.error(err);
            setStatus('error');
            addLog(`Critical Error: ${String(err)}`);
        }
    };

    const handleMigrate = async () => {
        setIsMigrating(true);
        setLog([]);
        setMigrationProgress(null);

        try {
            addLog('Starting migration of mock candidates to vector database...');

            const result = await migrateAllCandidates((progress) => {
                setMigrationProgress(progress);
                if (progress.currentCandidate) {
                    addLog(`Processing: ${progress.currentCandidate} (${progress.current}/${progress.total})`);
                }
            });

            if (result.status === 'complete') {
                addLog(`✓ Migration complete! Successfully migrated ${result.successCount}/${result.total} candidates`);
                if (result.failureCount > 0) {
                    addLog(`⚠ ${result.failureCount} candidates failed to migrate. See errors above.`);
                }
                // Refresh migration status
                const newStatus = await checkMigrationStatus();
                setMigrationStatus(newStatus);
            } else {
                addLog(`✗ Migration completed with errors: ${result.errors.join(', ')}`);
            }

            result.errors.forEach(err => addLog(`Error: ${err}`));

        } catch (err) {
            addLog(`✗ Migration failed: ${String(err)}`);
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="p-6 bg-slate-800 rounded-xl border border-slate-700 max-w-2xl mx-auto my-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Database className="mr-2 text-sky-400" />
                Knowledge Graph Ingestion
            </h2>

            <div className="mb-4 text-gray-300 text-sm">
                This tool helps you populate the vector database with candidate profiles.
            </div>

            {/* Migration Status */}
            {migrationStatus && (
                <div className="mb-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white">Mock Data Migration Status</h3>
                        {migrationStatus.needsMigration ? (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded border border-yellow-500/30">
                                Pending
                            </span>
                        ) : (
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded border border-emerald-500/30">
                                Complete
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-3 text-sm">
                        <div className="flex-1">
                            <div className="flex justify-between text-slate-400 mb-1">
                                <span>{migrationStatus.migrated} of {migrationStatus.totalMockCandidates} migrated</span>
                                <span>{Math.round((migrationStatus.migrated / migrationStatus.totalMockCandidates) * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                                    style={{ width: `${(migrationStatus.migrated / migrationStatus.totalMockCandidates) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    {migrationStatus.needsMigration && (
                        <button
                            onClick={handleMigrate}
                            disabled={isMigrating}
                            className="w-full mt-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex justify-center items-center space-x-2"
                        >
                            {isMigrating ? (
                                <>
                                    <Loader2 className="animate-spin h-4 w-4" />
                                    <span>Migrating... {migrationProgress?.current || 0}/{migrationProgress?.total || 0}</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    <span>Migrate Mock Candidates to Vector DB</span>
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-4">
                <button
                    onClick={handleIngest}
                    disabled={status !== 'idle' && status !== 'complete' && status !== 'error'}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex justify-center items-center"
                >
                    {status === 'generating' || status === 'embedding' ? (
                        <><Loader2 className="animate-spin mr-2" /> Processing...</>
                    ) : (
                        "Start Batch Ingestion (Demo: 5 Profiles)"
                    )}
                </button>

                {status === 'complete' && (
                    <div className="bg-emerald-900/30 border border-emerald-500/30 p-4 rounded-lg flex items-center text-emerald-300">
                        <CheckCircle className="mr-2" /> Ingestion Complete! Checked {count} profiles.
                    </div>
                )}

                {status === 'error' && (
                    <div className="bg-red-900/30 border border-red-500/30 p-4 rounded-lg flex items-center text-red-300">
                        <AlertCircle className="mr-2" /> Ingestion Failed. Check logs.
                    </div>
                )}

                <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-gray-400 h-64 overflow-y-auto custom-scrollbar">
                    {log.length === 0 ? <span className="opacity-50">// Process logs will appear here...</span> : log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
            </div>
        </div>
    );
};

export default IngestControl;
