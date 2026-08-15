import type { UploadedCandidate } from '../types';
import { err, ok, type Result } from '../types/result';
import { validation } from './errorHandling';

export type CsvIngestionResult = { imported: number; rejected: number; errors: Array<{ row: number; message: string }>; candidates: UploadedCandidate[] };

const parseRow = (line: string): string[] => {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += char;
  }
  cells.push(value.trim());
  return cells;
};

export async function ingestCsvCandidates(file: File, organizationId: string): Promise<Result<CsvIngestionResult>> {
  if (!organizationId) return err(validation('CsvIngestionService', 'Select a workspace before importing candidates.'));
  if (!file.name.toLowerCase().endsWith('.csv')) return err(validation('CsvIngestionService', 'Choose a .csv file.'));
  if (file.size > 2 * 1024 * 1024) return err(validation('CsvIngestionService', 'CSV file is too large (max 2MB).'));
  const lines = (await file.text()).split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return err(validation('CsvIngestionService', 'The CSV must include a header and at least one candidate.'));
  const headers = parseRow(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const find = (row: string[], ...names: string[]) => {
    const index = headers.findIndex((header) => names.includes(header));
    return index >= 0 ? row[index]?.trim() || '' : '';
  };
  const errors: Array<{ row: number; message: string }> = [];
  const candidates: UploadedCandidate[] = [];
  for (const [offset, line] of lines.slice(1, 251).entries()) {
    const rowNumber = offset + 2;
    const row = parseRow(line);
    const name = find(row, 'name', 'fullname');
    if (!name) { errors.push({ row: rowNumber, message: 'Name is required.' }); continue; }
    const experience = Number(find(row, 'experience', 'experienceyears')) || 0;
    candidates.push({
      id: globalThis.crypto?.randomUUID?.() || `csv-${Date.now()}-${offset}`,
      name,
      email: find(row, 'email') || undefined,
      phone: find(row, 'phone') || undefined,
      role: find(row, 'title', 'role') || 'Candidate',
      location: find(row, 'location') || 'Not specified',
      experience,
      availability: find(row, 'availability') || 'Unknown',
      skills: find(row, 'skills').split(/[;|]/).map((skill) => skill.trim()).filter(Boolean),
      notes: find(row, 'summary', 'notes') || `Imported locally from ${file.name}`,
      uploadDate: new Date().toISOString(),
      type: 'uploaded',
    });
  }
  return ok({ imported: candidates.length, rejected: errors.length + Math.max(0, lines.length - 251), errors, candidates });
}
