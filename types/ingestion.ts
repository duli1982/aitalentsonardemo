export type CandidateImportRecord = {
  sourceRow?: number;
  fullName: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  experienceYears?: number;
  skills: string[];
  summary?: string;
};

export type ConnectorRowError = { row: number; message: string };

/**
 * Contract implemented by every external candidate-data connector.
 * Connectors normalize their source into this record before persistence.
 */
export interface CandidateIngestionConnector {
  readonly key: string;
  readonly displayName: string;
  parse(input: string): { records: CandidateImportRecord[]; errors: ConnectorRowError[] };
  buildDocumentContent(record: CandidateImportRecord): string;
}
