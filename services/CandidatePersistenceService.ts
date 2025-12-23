import { supabase } from './supabaseClient';

export type PersistCandidateDocumentParams = {
  candidateId: string; // UUID string (stable candidate id used across the app)
  fullName?: string;
  email?: string;
  title?: string;
  location?: string;
  experienceYears?: number;
  seniority?: string;
  skills?: string[];
  candidateMetadata?: Record<string, unknown>;
  documentContent: string;
  documentMetadata: Record<string, unknown>;
  embedding: number[];
  source?: string;
};

function isMissingRelationOrColumn(error: any) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('unknown field') || msg.includes('column') || msg.includes('relation');
}

class CandidatePersistenceService {
  async upsertCandidateAndActiveDocument(params: PersistCandidateDocumentParams): Promise<{ candidateId: string; documentId?: string }> {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const candidateId = params.candidateId;

    // 1) Upsert candidate system-of-record (best-effort; safe to ignore if table not deployed yet).
    try {
      const { error } = await supabase
        .from('candidates')
        .upsert(
          {
            id: candidateId,
            full_name: params.fullName ?? null,
            email: params.email ?? null,
            location: params.location ?? null,
            headline: params.title ?? null,
            experience_years: typeof params.experienceYears === 'number' ? params.experienceYears : null,
            seniority: params.seniority ?? null,
            skills: Array.isArray(params.skills) ? params.skills : [],
            metadata: params.candidateMetadata ?? {},
            updated_at: new Date().toISOString()
          } as any,
          { onConflict: 'id' }
        );
      if (error && !isMissingRelationOrColumn(error)) {
        // Keep going; documents still power search in older setups.
        if (import.meta.env.DEV) console.warn('[CandidatePersistenceService] candidates upsert failed:', error);
      }
    } catch (e) {
      // ignore
    }

    // 2) Deactivate previous active docs for this candidate (best-effort).
    try {
      await supabase.from('candidate_documents').update({ is_active: false, updated_at: new Date().toISOString() } as any).eq('candidate_id', candidateId);
    } catch {
      // ignore
    }

    // 3) Insert new document snapshot (best-effort retry for older schemas).
    const documentInsertPayloadFull = {
      candidate_id: candidateId,
      content: params.documentContent,
      metadata: params.documentMetadata,
      embedding: params.embedding,
      source: params.source ?? null,
      is_active: true,
      updated_at: new Date().toISOString()
    } as any;

    const documentInsertPayloadLegacy = {
      content: params.documentContent,
      metadata: params.documentMetadata,
      embedding: params.embedding
    } as any;

    let documentId: string | undefined;
    const insertAttempt = await supabase.from('candidate_documents').insert(documentInsertPayloadFull).select('id').maybeSingle();
    if (insertAttempt.error) {
      if (!isMissingRelationOrColumn(insertAttempt.error)) {
        throw insertAttempt.error;
      }
      const legacy = await supabase.from('candidate_documents').insert(documentInsertPayloadLegacy).select('id').maybeSingle();
      if (legacy.error) throw legacy.error;
      documentId = legacy.data ? String((legacy.data as any).id) : undefined;
    } else {
      documentId = insertAttempt.data ? String((insertAttempt.data as any).id) : undefined;
    }

    // 4) Update active document pointer (best-effort; safe if candidates table/column not present).
    if (documentId) {
      try {
        await supabase.from('candidates').update({ active_document_id: Number(documentId), updated_at: new Date().toISOString() } as any).eq('id', candidateId);
      } catch {
        // ignore
      }
    }

    return { candidateId, documentId };
  }
}

export const candidatePersistenceService = new CandidatePersistenceService();

