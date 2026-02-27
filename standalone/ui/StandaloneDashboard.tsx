
import React, { useState } from 'react';
import { sonarStandalone } from '../index';
import { Job } from '../../types';

/**
 * The Standalone Triage Dashboard.
 * This will be the main screen in the Google Site embed.
 */
export const StandaloneDashboard: React.FC = () => {
    const [job, setJob] = useState<Partial<Job>>({ title: 'Senior React Developer' });
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        const res = await sonarStandalone.runRediscovery(job as Job);
        if (res.success) {
            setResults(res.data);
        }
        setLoading(false);
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto' }}>
            <header style={{ borderBottom: '2px solid #eee', marginBottom: '20px' }}>
                <h1 style={{ color: '#1a73e8' }}>Talent Sonar Rediscovery</h1>
                <p>Finding "Hidden Gems" in your CRM - 100% Stateless & Compliant</p>
            </header>

            <div style={{ marginBottom: '30px', display: 'flex', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="Job Title (e.g. Senior Java Eng)"
                    value={job.title}
                    onChange={(e) => setJob({ ...job, title: e.target.value })}
                    style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    style={{ padding: '10px 20px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {loading ? 'Searching CRM...' : 'Spot Hidden Gems'}
                </button>
            </div>

            <div className="results">
                {results.map((res, i) => (
                    <div key={i} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>{res.candidateName}</h3>
                            <span style={{ background: '#e6f4ea', color: '#137333', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                                {res.score}% Match
                            </span>
                        </div>
                        <p style={{ color: '#666', fontSize: '14px' }}>{res.fullCandidate.role}</p>

                        {res.evidence && (
                            <div style={{ marginTop: '10px', background: '#f8f9fa', padding: '10px', borderRadius: '4px' }}>
                                <strong style={{ fontSize: '13px' }}>AI Match Insight:</strong>
                                <p style={{ fontSize: '13px', margin: '5px 0' }}>{res.evidence.risk?.statement}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {!loading && results.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', marginTop: '50px' }}>
                    Enter a job title to begin rediscovering talent.
                </div>
            )}
        </div>
    );
};
