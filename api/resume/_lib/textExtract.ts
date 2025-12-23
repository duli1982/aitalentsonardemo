import crypto from 'crypto';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export type ExtractedText = {
  text: string;
  sha256: string;
  bytes: number;
};

function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromFile(fileBuffer: Buffer, mimeType: string, fileName: string): Promise<ExtractedText> {
  const lower = fileName.toLowerCase();
  let rawText = '';

  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    const parsed = await pdfParse(fileBuffer);
    rawText = parsed.text || '';
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    rawText = result.value || '';
  } else if (mimeType.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    rawText = fileBuffer.toString('utf8');
  } else {
    // Best-effort: treat as utf8 text
    rawText = fileBuffer.toString('utf8');
  }

  const text = normalizeText(rawText);
  return { text, sha256: sha256Hex(fileBuffer), bytes: fileBuffer.byteLength };
}

