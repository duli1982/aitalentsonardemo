import React, { useMemo, useState, useEffect } from 'react';
import type { Candidate, Job, PipelineStage } from '../types';
import { useData } from '../contexts/DataContext';
import CandidateFilters from './candidates/CandidateFilters';
import CandidateList from './candidates/CandidateList';
import CandidateDetail from './candidates/CandidateDetail';
import ComparisonModal from './modals/ComparisonModal';
import BulkOutreachModal from './modals/BulkOutreachModal';
import { FilterCriteria } from '../services/geminiService';
import { TrendingUp, Mail, Database, Users as UsersIcon, Loader2, RefreshCw, Filter, ChevronDown, MoreHorizontal } from 'lucide-react';
import FairnessWidget from './FairnessWidget';
import { useSearchParams } from 'react-router-dom';
import { useAllSupabaseCandidates } from '../hooks/useAllSupabaseCandidates';

interface CandidatesViewProps {
  selectedCandidateId: string | null;
  onSelectCandidate: (id: string) => void;
  onInitiateAnalysis: (candidate: Candidate, job: Job) => void;
  onUpdateCandidate: (candidateId: string, updatedData: Partial<Candidate>) => void;
  onAddCandidateToPipeline: (candidate: Candidate, jobId: string, initialStage?: PipelineStage) => void;
  onUpdateCandidateStage: (candidateId: string, jobId: string, newStage: PipelineStage) => void;
}

const CandidatesView: React.FC<CandidatesViewProps> = ({ selectedCandidateId, onSelectCandidate, onInitiateAnalysis, onUpdateCandidate, onAddCandidateToPipeline, onUpdateCandidateStage }) => {
  const { internalCandidates, pastCandidates, uploadedCandidates, jobs } = useData();
  const [searchParams] = useSearchParams();

  // Data source toggle: 'demo' or 'supabase'
  const [dataSource, setDataSource] = useState<'demo' | 'supabase'>('demo');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'past' | 'uploaded'>('all');
  const [skillFilter, setSkillFilter] = useState<string[]>(searchParams.get('skills') ? searchParams.get('skills')?.split(',') || [] : []);
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isComparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [isBulkOutreachModalOpen, setBulkOutreachModalOpen] = useState(false);
  const [selectedJobForComparison, setSelectedJobForComparison] = useState<Job | null>(null);

  // Fetch Supabase candidates
  const {
    candidates: supabaseCandidates,
    isLoading: isLoadingSupabase,
    hasMore: hasMoreSupabase,
    loadMore: loadMoreSupabase,
    refresh: refreshSupabase,
    total: supabaseTotal
  } = useAllSupabaseCandidates({
    enabled: dataSource === 'supabase',
    limit: 100
  });

  // Calculate active filter count
  const activeFilterCount = [searchTerm, typeFilter !== 'all', skillFilter.length > 0, roleFilter, locationFilter].filter(Boolean).length;

  // Get all candidates based on data source
  const demoCandidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  const allCandidates = useMemo(() =>
    dataSource === 'supabase' ? supabaseCandidates : demoCandidates,
    [dataSource, supabaseCandidates, demoCandidates]
  );

  // Auto-select first candidate if none is selected
  useEffect(() => {
    if (!selectedCandidateId && allCandidates.length > 0) {
      onSelectCandidate(allCandidates[0].id);
    }
  }, [selectedCandidateId, allCandidates, onSelectCandidate]);

  const handleAiFilterUpdate = (criteria: FilterCriteria) => {
    if (criteria.type) setTypeFilter(criteria.type);
    if (criteria.skills) setSkillFilter(criteria.skills);
    if (criteria.role) setRoleFilter(criteria.role);
    setSearchTerm('');
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setSkillFilter([]);
    setRoleFilter('');
    setLocationFilter('');
  };

  const handleToggleComparisonMode = () => {
    setComparisonMode((prev) => {
      const next = !prev;
      if (!next) setSelectedForComparison([]);
      return next;
    });
    setSidebarMenuOpen(false);
  };

  const filteredCandidates = useMemo(() => {
    return allCandidates.filter(candidate => {
      const matchesSearch = searchTerm === '' || candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'all' || candidate.type === typeFilter;

      const matchesSkills = skillFilter.length === 0 || skillFilter.every(skill =>
        candidate.skills.some(cSkill => cSkill.toLowerCase().includes(skill.toLowerCase()))
      );

      const matchesRole = roleFilter === '' || (candidate.role && candidate.role.toLowerCase().includes(roleFilter.toLowerCase()));

      const matchesLocation = locationFilter === '' || (candidate.location && candidate.location.toLowerCase().includes(locationFilter.toLowerCase()));

      return matchesSearch && matchesType && matchesSkills && matchesRole && matchesLocation;
    });
  }, [allCandidates, searchTerm, typeFilter, skillFilter, roleFilter, locationFilter]);

  const selectedCandidate = useMemo(() =>
    allCandidates.find(c => c.id === selectedCandidateId),
    [allCandidates, selectedCandidateId]
  );

  const handleToggleComparison = (id: string) => {
    setSelectedForComparison(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleCompare = () => {
    if (selectedForComparison.length >= 2 && jobs.length > 0) {
      setComparisonModalOpen(true);
    }
  };

  const comparisonCandidates = useMemo(() =>
    allCandidates.filter(c => selectedForComparison.includes(c.id)),
    [allCandidates, selectedForComparison]
  );

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      {/* Sidebar List */}
      <div className="w-full md:w-1/3 lg:w-1/4 bg-slate-800 rounded-xl shadow-xl flex flex-col overflow-hidden sticky top-4 h-[calc(100vh-120px)]">
        {/* Compact Sidebar Header */}
        <div className="p-4 border-b border-slate-700 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-base font-semibold text-sky-300">Candidates</div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-700/70 border border-slate-600 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDataSource('demo')}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${dataSource === 'demo' ? 'bg-slate-900/50 text-white' : 'text-slate-300 hover:text-white'}`}
                  title="Demo pool"
                >
                  <UsersIcon className="h-3.5 w-3.5" />
                  Demo
                </button>
                <button
                  type="button"
                  onClick={() => setDataSource('supabase')}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${dataSource === 'supabase' ? 'bg-slate-900/50 text-white' : 'text-slate-300 hover:text-white'}`}
                  title="Supabase"
                >
                  <Database className="h-3.5 w-3.5" />
                  DB
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedFilters((v) => !v)}
                className={`p-2 rounded-lg border ${showAdvancedFilters ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-slate-600 bg-slate-700/60 text-slate-200 hover:bg-slate-700'}`}
                title="Filters"
              >
                <Filter className="h-4 w-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSidebarMenuOpen((v) => !v)}
                  className={`p-2 rounded-lg border ${sidebarMenuOpen ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-slate-600 bg-slate-700/60 text-slate-200 hover:bg-slate-700'}`}
                  title="More"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {sidebarMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden">
                    <button
                      type="button"
                      onClick={handleToggleComparisonMode}
                      className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 flex items-center justify-between"
                    >
                      <span>{comparisonMode ? 'Exit comparison' : 'Compare candidates'}</span>
                      {comparisonMode && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                          {selectedForComparison.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowInsights((v) => !v);
                        setSidebarMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 flex items-center justify-between"
                    >
                      <span>Insights</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showInsights ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div>
              {dataSource === 'supabase'
                ? (isLoadingSupabase ? 'Loading Supabase…' : `${supabaseTotal} in Supabase`)
                : `${demoCandidates.length} in Demo`}
            </div>
            {dataSource === 'supabase' && (
              <button
                type="button"
                onClick={refreshSupabase}
                disabled={isLoadingSupabase}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700/60 border border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                title="Refresh Supabase"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingSupabase ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>

          <CandidateFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            onAiFilterUpdate={handleAiFilterUpdate}
            variant="compact"
            showTitle={false}
            showAiSearch={showAdvancedFilters}
          />

          {showAdvancedFilters && (
            <div className="pt-2 border-t border-slate-700 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  placeholder="Role…"
                  className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-sm text-white outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Location…"
                  className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-sm text-white outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <input
                type="text"
                value={skillFilter.join(', ')}
                onChange={(e) => setSkillFilter(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Skills (comma separated)…"
                className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-sm text-white outline-none focus:ring-2 focus:ring-sky-500"
              />

              {activeFilterCount > 0 && (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-sky-300">{activeFilterCount}</span> filter{activeFilterCount > 1 ? 's' : ''} active
                  </div>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs text-red-400 hover:text-red-300 font-semibold"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Filters & Clear */}
        {activeFilterCount > 0 && !showAdvancedFilters && (
          <div className="px-4 py-2 border-b border-slate-700 flex justify-between items-center">
            <span className="text-xs text-gray-400">
              <span className="font-medium text-sky-400">{activeFilterCount}</span> filter{activeFilterCount > 1 ? 's' : ''} active
            </span>
            <button
              onClick={handleClearFilters}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              Clear All
            </button>
          </div>
        )}

        {showInsights && (
          <div className="px-4 py-3 border-b border-slate-700 space-y-3">
            <FairnessWidget
              candidates={filteredCandidates}
              allCandidates={allCandidates}
              onAddCandidate={() => { /* TODO: wire if needed */ }}
            />

            {dataSource === 'supabase' && !isLoadingSupabase && supabaseCandidates.length > 0 && (
              <div className="p-2 bg-gradient-to-r from-sky-900/30 to-purple-900/30 border border-sky-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-sky-400 flex-shrink-0" />
                  <p className="text-[10px] text-sky-200">
                    <span className="font-semibold">Knowledge Graph Active:</span> Company/school data from 10,000 candidates
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <CandidateList
          candidates={filteredCandidates}
          selectedCandidateId={selectedCandidateId}
          onSelectCandidate={onSelectCandidate}
          totalCandidates={allCandidates.length}
          comparisonMode={comparisonMode}
          selectedForComparison={selectedForComparison}
          onToggleComparison={handleToggleComparison}
          isLoading={dataSource === 'supabase' && isLoadingSupabase}
        />

        {/* Load More Button for Supabase */}
        {dataSource === 'supabase' && hasMoreSupabase && !isLoadingSupabase && (
          <div className="px-4 pb-3">
            <button
              onClick={loadMoreSupabase}
              className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold rounded-lg shadow flex items-center justify-center gap-2 transition-all text-sm border border-slate-600"
            >
              <RefreshCw className="h-4 w-4" />
              Load More Candidates
            </button>
          </div>
        )}

        {/* Floating Compare Button */}
        {comparisonMode && selectedForComparison.length >= 2 && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/90 backdrop-blur space-y-2">
            <button
              onClick={handleCompare}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-all"
            >
              <TrendingUp size={18} />
              Compare {selectedForComparison.length} Candidates
            </button>
            <button
              onClick={() => setBulkOutreachModalOpen(true)}
              className="w-full py-3 px-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-sky-900/30 flex items-center justify-center gap-2 transition-all"
            >
              <Mail size={18} />
              Draft Outreach ({selectedForComparison.length})
            </button>
          </div>
        )}
      </div>

      {/* Main Detail View */}
      <div className="w-full md:w-2/3 lg:w-3/4 bg-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col">
        <CandidateDetail
          candidate={selectedCandidate}
          jobs={jobs}
          onInitiateAnalysis={onInitiateAnalysis}
          onAddToPipeline={onAddCandidateToPipeline}
          onUpdateCandidateStage={onUpdateCandidateStage}
        />
      </div>

      {/* Comparison Modal */}
      {isComparisonModalOpen && jobs.length > 0 && (
        <ComparisonModal
          isOpen={isComparisonModalOpen}
          onClose={() => setComparisonModalOpen(false)}
          candidates={comparisonCandidates}
          job={jobs[0]}
        />
      )}

      {/* Bulk Outreach Modal */}
      {isBulkOutreachModalOpen && jobs.length > 0 && (
        <BulkOutreachModal
          isOpen={isBulkOutreachModalOpen}
          onClose={() => setBulkOutreachModalOpen(false)}
          candidates={comparisonCandidates}
          job={jobs[0]}
        />
      )}
    </div>
  );
};

export default CandidatesView;
