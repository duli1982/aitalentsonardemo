import crypto from 'crypto';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { detectPromptInjection, type InjectionScanResult } from '../../../utils/promptSecurity';
import { scanFileForHiddenText, type HiddenTextScanResult } from '../../../utils/hiddenTextDetection';

export type ExtractedText = {
  text: string;
  sha256: string;
  bytes: number;
  /** Layer 3: Prompt injection scan result (present if text was scanned). */
  injectionScan?: InjectionScanResult;
  /** Layer 4: Hidden text scan result (present for PDF/DOCX files). */
  hiddenTextScan?: HiddenTextScanResult;
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

  // Layer 3: Scan extracted text for prompt injection patterns.
  // We scan BEFORE sanitization to catch invisible chars that sanitization would strip.
  const injectionScan = detectPromptInjection(rawText);
  if (injectionScan.flagged) {
    console.warn(
      `[textExtract] ⚠ Prompt injection detected in uploaded file "${fileName}" ` +
      `(risk score ${injectionScan.riskScore}):`,
      injectionScan.flags
        .filter((f) => f.severity !== 'low')
        .map((f) => `[${f.severity}] ${f.reason}`)
        .join('; ')
    );
  }

  // Layer 4: Scan raw file buffer for hidden text (white text, zero font, hidden properties).
  // This operates on the binary file — not the extracted text — to catch styling-level tricks.
  const hiddenTextScan = scanFileForHiddenText(fileBuffer, mimeType, fileName);
  if (hiddenTextScan.flagged) {
    console.warn(
      `[textExtract] ⚠ Hidden text detected in uploaded file "${fileName}" ` +
      `(${hiddenTextScan.totalIndicators} indicator(s)):`,
      hiddenTextScan.flags
        .filter((f) => f.severity !== 'low')
        .map((f) => `[${f.severity}] ${f.technique}: ${f.description}`)
        .join('; ')
    );
  }

  return {
    text,
    sha256: sha256Hex(fileBuffer),
    bytes: fileBuffer.byteLength,
    injectionScan,
    hiddenTextScan
  };
}

