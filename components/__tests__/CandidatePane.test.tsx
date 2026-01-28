import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CandidatePane } from '../CandidatePane';
import { createMockCandidate, createMockJob } from '../../src/test/utils/testHelpers';

describe('CandidatePane Component', () => {
    const mockCandidate = createMockCandidate({
        id: 'cand_1',
        name: 'Alice Johnson',
        role: 'Senior Frontend Engineer',
        skills: ['React', 'TypeScript', 'Node.js'],
        location: 'San Francisco',
        experience: 5
    });

    const mockJob = createMockJob({
        id: 'job_1',
        title: 'Senior Frontend Engineer',
        requiredSkills: ['React', 'TypeScript']
    });

    const defaultProps = {
        candidate: mockCandidate,
        job: mockJob,
        onAnalyze: vi.fn(),
        onAddToPipeline: vi.fn(),
        onOutreach: vi.fn(),
        onViewProfile: vi.fn(),
        onRecordAssessment: vi.fn()
    };

    it('should render candidate information', () => {
        render(<CandidatePane {...defaultProps} />);

        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        expect(screen.getByText('Senior Frontend Engineer')).toBeInTheDocument();
    });

    it('should display candidate skills', () => {
        render(<CandidatePane {...defaultProps} />);

        expect(screen.getByText('React')).toBeInTheDocument();
        expect(screen.getByText('TypeScript')).toBeInTheDocument();
        expect(screen.getByText('Node.js')).toBeInTheDocument();
    });

    it('should display candidate location', () => {
        render(<CandidatePane {...defaultProps} />);

        expect(screen.getByText(/San Francisco/)).toBeInTheDocument();
    });

    it('should call onAnalyze when Analyze button is clicked', async () => {
        render(<CandidatePane {...defaultProps} />);

        const analyzeButton = screen.getByText(/Analyze/i);
        fireEvent.click(analyzeButton);

        await waitFor(() => {
            expect(defaultProps.onAnalyze).toHaveBeenCalledWith(mockCandidate);
        });
    });

    it('should call onAddToPipeline when Add to Pipeline button is clicked', async () => {
        render(<CandidatePane {...defaultProps} />);

        const addButton = screen.getByText(/Add to Pipeline/i);
        fireEvent.click(addButton);

        await waitFor(() => {
            expect(defaultProps.onAddToPipeline).toHaveBeenCalledWith(mockCandidate);
        });
    });

    it('should call onRecordAssessment when Record Assessment button is clicked', async () => {
        render(<CandidatePane {...defaultProps} />);

        const assessmentButton = screen.getByLabelText(/Record Assessment/i);
        fireEvent.click(assessmentButton);

        await waitFor(() => {
            expect(defaultProps.onRecordAssessment).toHaveBeenCalledWith(mockCandidate);
        });
    });

    it('should display match score when available', () => {
        const candidateWithScore = {
            ...mockCandidate,
            matchScores: { [mockJob.id]: 85 }
        };

        render(<CandidatePane {...defaultProps} candidate={candidateWithScore} />);

        expect(screen.getByText(/85/)).toBeInTheDocument();
    });

    it('should display match rationale when available', () => {
        const candidateWithRationale = {
            ...mockCandidate,
            matchRationales: {
                [mockJob.id]: 'Strong candidate with excellent React skills'
            }
        };

        render(<CandidatePane {...defaultProps} candidate={candidateWithRationale} />);

        expect(screen.getByText(/excellent React skills/i)).toBeInTheDocument();
    });

    it('should handle missing optional data gracefully', () => {
        const minimalCandidate = {
            ...mockCandidate,
            skills: [],
            location: '',
            matchScores: undefined,
            matchRationales: undefined
        };

        expect(() => {
            render(<CandidatePane {...defaultProps} candidate={minimalCandidate} />);
        }).not.toThrow();
    });

    it('should render in 6-column grid layout', () => {
        const { container } = render(<CandidatePane {...defaultProps} />);

        const gridContainer = container.querySelector('.grid-cols-6');
        expect(gridContainer).toBeInTheDocument();
    });
});
