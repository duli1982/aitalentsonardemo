/**
 * Hidden Text Detection — Layer 4
 *
 * Detects invisible or hidden text embedded in PDF and DOCX files.
 * These are common prompt injection vectors where attackers hide
 * instructions using:
 *
 * PDF:
 *   - Text rendering mode 3 (invisible)
 *   - Font size 0 or near-zero
 *   - White text on white background (1 1 1 rg, 1 g)
 *   - Text positioned off-page
 *
 * DOCX:
 *   - Hidden text property (<w:vanish/>)
 *   - Zero font size (<w:sz w:val="0"/>)
 *   - White/near-white font color (<w:color w:val="FFFFFF"/>)
 *   - Tiny font sizes used to hide text visually
 *
 * Zero external dependencies — uses only Node built-ins (zlib, Buffer).
 */

import { inflateRawSync } from 'zlib';

// ── Types ────────────────────────────────────────────────────────────

export type HiddenTextTechnique =
  | 'invisible_render_mode'
  | 'zero_font_size'
  | 'white_text'
  | 'offpage_text'
  | 'hidden_property'
  | 'micro_font'
  | 'white_on_white';

export type HiddenTextSeverity = 'low' | 'medium' | 'high';

export interface HiddenTextFlag {
  technique: HiddenTextTechnique;
  severity: HiddenTextSeverity;
  description: string;
  /** Extracted snippet of the hidden content (truncated). */
  snippet?: string;
  /** Number of occurrences found. */
  count: number;
}

export interface HiddenTextScanResult {
  /** True if any medium/high severity flags were found. */
  flagged: boolean;
  /** Total number of hidden text indicators found. */
  totalIndicators: number;
  /** Individual flags. */
  flags: HiddenTextFlag[];
  /** File type that was scanned. */
  fileType: 'pdf' | 'docx' | 'unknown';
}

const CLEAN_RESULT: HiddenTextScanResult = {
  flagged: false,
  totalIndicators: 0,
  flags: [],
  fileType: 'unknown'
};

// ── PDF Hidden Text Detection ────────────────────────────────────────

/**
 * PDF content streams use operators like:
 *   - `Tr` — text rendering mode (3 = invisible)
 *   - `Tf` — font size (0 = invisible)
 *   - `rg` / `RG` — RGB color (1 1 1 = white)
 *   - `g` / `G` — grayscale (1 = white)
 *   - `Td` / `Tm` — text positioning (large negative = off-page)
 *
 * We scan both raw and deflated streams for these patterns.
 */

/** Try to extract and inflate FlateDecode streams from a PDF buffer. */
function extractPdfStreams(buffer: Buffer): string[] {
  const raw = buffer.toString('latin1');
  const streams: string[] = [];

  // Also scan the raw buffer as-is (catches uncompressed streams and metadata)
  streams.push(raw);

  // Find stream...endstream blocks
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRe.exec(raw)) !== null) {
    const streamData = match[1];
    // Try to inflate (most PDF streams use FlateDecode)
    try {
      const buf = Buffer.from(streamData, 'latin1');
      const inflated = inflateRawSync(buf);
      streams.push(inflated.toString('latin1'));
    } catch {
      // Not compressed or different compression — use raw
      streams.push(streamData);
    }
  }

  return streams;
}

function scanPdfForHiddenText(buffer: Buffer): HiddenTextScanResult {
  const flags: HiddenTextFlag[] = [];
  const streams = extractPdfStreams(buffer);
  const allContent = streams.join('\n');

  // 1. Invisible text rendering mode: `3 Tr`
  const invisibleRenderMatches = allContent.match(/\b3\s+Tr\b/g);
  if (invisibleRenderMatches && invisibleRenderMatches.length > 0) {
    flags.push({
      technique: 'invisible_render_mode',
      severity: 'high',
      description: `PDF uses text rendering mode 3 (invisible) — text is present but not drawn. ${invisibleRenderMatches.length} occurrence(s).`,
      count: invisibleRenderMatches.length
    });
  }

  // 2. Zero or near-zero font size: `0 Tf` or `0.0 Tf` or `0.001 Tf`
  const zeroFontMatches = allContent.match(/\b0(\.0+)?\s+Tf\b/g);
  if (zeroFontMatches && zeroFontMatches.length > 0) {
    flags.push({
      technique: 'zero_font_size',
      severity: 'high',
      description: `PDF sets font size to 0 — text exists but is invisible. ${zeroFontMatches.length} occurrence(s).`,
      count: zeroFontMatches.length
    });
  }

  // 2b. Micro font sizes (0.001 - 0.5 pt) — technically visible but unreadable
  const microFontMatches = allContent.match(/\b0\.[0-4]\d*\s+Tf\b/g);
  if (microFontMatches && microFontMatches.length > 0) {
    flags.push({
      technique: 'micro_font',
      severity: 'medium',
      description: `PDF uses micro font sizes (< 0.5pt) — text is technically rendered but invisible to human eye. ${microFontMatches.length} occurrence(s).`,
      count: microFontMatches.length
    });
  }

  // 3. White RGB fill color: `1 1 1 rg` (non-stroking) or `1 1 1 RG` (stroking)
  const whiteRgbFill = allContent.match(/\b1(?:\.0+)?\s+1(?:\.0+)?\s+1(?:\.0+)?\s+rg\b/g);
  const whiteRgbStroke = allContent.match(/\b1(?:\.0+)?\s+1(?:\.0+)?\s+1(?:\.0+)?\s+RG\b/g);
  const whiteRgbCount = (whiteRgbFill?.length || 0) + (whiteRgbStroke?.length || 0);
  if (whiteRgbCount > 0) {
    flags.push({
      technique: 'white_text',
      severity: 'high',
      description: `PDF sets text color to white (1 1 1 rg/RG) — text blends with white background. ${whiteRgbCount} occurrence(s).`,
      count: whiteRgbCount
    });
  }

  // 4. White grayscale: `1 g` (non-stroking) or `1 G` (stroking)
  // Be careful: `1 g` can appear in other contexts. Only flag if near text operators.
  const whiteGrayFill = allContent.match(/\b1(?:\.0+)?\s+g\b/g);
  const whiteGrayStroke = allContent.match(/\b1(?:\.0+)?\s+G\b/g);
  const whiteGrayCount = (whiteGrayFill?.length || 0) + (whiteGrayStroke?.length || 0);
  // Only flag if there's a significant number (isolated `1 g` can be benign in graphics)
  if (whiteGrayCount >= 3) {
    flags.push({
      technique: 'white_on_white',
      severity: 'medium',
      description: `PDF uses white grayscale color operators (1 g/G) near text — possible white-on-white text. ${whiteGrayCount} occurrence(s).`,
      count: whiteGrayCount
    });
  }

  // 5. Large negative text positioning (off-page): check Td/TD with large negative values
  const offpageMatches = allContent.match(/-[5-9]\d{3,}\s+-?\d+\s+Td/g);
  if (offpageMatches && offpageMatches.length > 0) {
    flags.push({
      technique: 'offpage_text',
      severity: 'high',
      description: `PDF positions text far off-page (large negative coordinates). ${offpageMatches.length} occurrence(s).`,
      count: offpageMatches.length
    });
  }

  const totalIndicators = flags.reduce((sum, f) => sum + f.count, 0);
  return {
    flagged: flags.some((f) => f.severity !== 'low'),
    totalIndicators,
    flags,
    fileType: 'pdf'
  };
}

// ── DOCX Hidden Text Detection ───────────────────────────────────────

/**
 * DOCX files are ZIP archives containing XML files.
 * Hidden text is marked in the XML with specific elements:
 *   - <w:vanish/> or <w:vanish w:val="true"/> — Word's hidden text property
 *   - <w:sz w:val="0"/> — zero font size
 *   - <w:color w:val="FFFFFF"/> — white text color
 *   - <w:webHidden/> — web-hidden text
 *
 * We parse the ZIP without external libraries using the Central Directory.
 */

interface ZipEntry {
  filename: string;
  data: Buffer;
}

/**
 * Parse a ZIP buffer and extract specified entries.
 * Uses the Central Directory at the end of the file for reliable parsing.
 */
function extractZipEntries(buffer: Buffer, targetFiles: string[]): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const targetSet = new Set(targetFiles.map((f) => f.toLowerCase()));

  // Find End of Central Directory record (PK\x05\x06)
  // It's at the end of the file (last 65KB max due to comment field)
  let eocdOffset = -1;
  const searchStart = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (
      buffer[i] === 0x50 &&
      buffer[i + 1] === 0x4b &&
      buffer[i + 2] === 0x05 &&
      buffer[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) return entries;

  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);

  if (cdOffset >= buffer.length || cdOffset + cdSize > buffer.length) return entries;

  // Walk Central Directory entries (PK\x01\x02)
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;

  while (pos < cdEnd - 46) {
    if (
      buffer[pos] !== 0x50 ||
      buffer[pos + 1] !== 0x4b ||
      buffer[pos + 2] !== 0x01 ||
      buffer[pos + 3] !== 0x02
    ) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const filenameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localHeaderOffset = buffer.readUInt32LE(pos + 42);

    const filename = buffer.toString('utf8', pos + 46, pos + 46 + filenameLen);

    if (targetSet.has(filename.toLowerCase())) {
      // Read local file header to get actual data offset
      if (localHeaderOffset + 30 < buffer.length) {
        const localFilenameLen = buffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
        const dataOffset = localHeaderOffset + 30 + localFilenameLen + localExtraLen;

        if (dataOffset + compressedSize <= buffer.length) {
          const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);

          try {
            if (compressionMethod === 0) {
              entries.push({ filename, data: compressedData });
            } else if (compressionMethod === 8) {
              const inflated = inflateRawSync(compressedData);
              entries.push({ filename, data: inflated });
            }
          } catch {
            // Skip entries that fail to decompress
          }
        }
      }
    }

    pos += 46 + filenameLen + extraLen + commentLen;
  }

  return entries;
}

/** Extract text content near a hidden element for context. */
function extractNearbyText(xml: string, matchIndex: number, radius = 200): string {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(xml.length, matchIndex + radius);
  const region = xml.slice(start, end);

  // Extract text between <w:t> tags in the region
  const textMatches = region.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
  if (!textMatches) return '';

  return textMatches
    .map((m) => m.replace(/<[^>]+>/g, ''))
    .join(' ')
    .trim()
    .slice(0, 120);
}

function scanDocxForHiddenText(buffer: Buffer): HiddenTextScanResult {
  const flags: HiddenTextFlag[] = [];

  // Extract word/document.xml and word/styles.xml from the DOCX ZIP
  const entries = extractZipEntries(buffer, [
    'word/document.xml',
    'word/styles.xml'
  ]);

  if (entries.length === 0) {
    return { ...CLEAN_RESULT, fileType: 'docx' };
  }

  const allXml = entries.map((e) => e.data.toString('utf8')).join('\n');

  // 1. <w:vanish/> or <w:vanish w:val="true"/> — Word's "hidden text" property
  // This is the most explicit way to hide text in Word
  const vanishMatches = allXml.match(/<w:vanish\s*(?:w:val\s*=\s*"(?:true|1|on)")?\s*\/?>/gi);
  if (vanishMatches && vanishMatches.length > 0) {
    // Get a snippet of the hidden text
    const firstIdx = allXml.search(/<w:vanish/i);
    const snippet = extractNearbyText(allXml, firstIdx);

    flags.push({
      technique: 'hidden_property',
      severity: 'high',
      description: `DOCX uses <w:vanish> (hidden text property) — text is present in the document but flagged as hidden. ${vanishMatches.length} occurrence(s).`,
      snippet: snippet || undefined,
      count: vanishMatches.length
    });
  }

  // 2. <w:webHidden/> — web-hidden text
  const webHiddenMatches = allXml.match(/<w:webHidden\s*\/?>/gi);
  if (webHiddenMatches && webHiddenMatches.length > 0) {
    flags.push({
      technique: 'hidden_property',
      severity: 'medium',
      description: `DOCX uses <w:webHidden> — text hidden in web view. ${webHiddenMatches.length} occurrence(s).`,
      count: webHiddenMatches.length
    });
  }

  // 3. Zero or near-zero font size: <w:sz w:val="0"/> to <w:sz w:val="2"/>
  // Word font sizes are in half-points, so val="2" = 1pt, val="1" = 0.5pt, val="0" = 0pt
  const zeroSizeMatches = allXml.match(/<w:sz\s+w:val\s*=\s*"[012]"\s*\/?>/gi);
  if (zeroSizeMatches && zeroSizeMatches.length > 0) {
    const firstIdx = allXml.search(/<w:sz\s+w:val\s*=\s*"[012]"/i);
    const snippet = extractNearbyText(allXml, firstIdx);

    flags.push({
      technique: 'zero_font_size',
      severity: 'high',
      description: `DOCX uses zero/near-zero font size (0-1pt) — text is technically present but invisible. ${zeroSizeMatches.length} occurrence(s).`,
      snippet: snippet || undefined,
      count: zeroSizeMatches.length
    });
  }

  // 4. White font color: <w:color w:val="FFFFFF"/> or near-white
  const whiteColorMatches = allXml.match(/<w:color\s+w:val\s*=\s*"(?:FFFFFF|ffffff|FFF[EF][EF][EF]|fff[ef][ef][ef])"\s*\/?>/gi);
  if (whiteColorMatches && whiteColorMatches.length > 0) {
    const firstIdx = allXml.search(/<w:color\s+w:val\s*=\s*"(?:FFFFFF|ffffff|FFF|fff)/i);
    const snippet = extractNearbyText(allXml, firstIdx);

    flags.push({
      technique: 'white_text',
      severity: 'high',
      description: `DOCX uses white/near-white font color — text blends with white background. ${whiteColorMatches.length} occurrence(s).`,
      snippet: snippet || undefined,
      count: whiteColorMatches.length
    });
  }

  // 5. Very small font sizes (val="3" to val="6" = 1.5pt to 3pt) — suspicious but not definitive
  const microSizeMatches = allXml.match(/<w:sz\s+w:val\s*=\s*"[3-6]"\s*\/?>/gi);
  if (microSizeMatches && microSizeMatches.length >= 3) {
    flags.push({
      technique: 'micro_font',
      severity: 'medium',
      description: `DOCX uses very small font sizes (1.5-3pt) in ${microSizeMatches.length} places — may be hiding text visually.`,
      count: microSizeMatches.length
    });
  }

  const totalIndicators = flags.reduce((sum, f) => sum + f.count, 0);
  return {
    flagged: flags.some((f) => f.severity !== 'low'),
    totalIndicators,
    flags,
    fileType: 'docx'
  };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Scan a file buffer for hidden text techniques.
 * Dispatches to the correct scanner based on MIME type or file extension.
 *
 * @param buffer   — raw file bytes
 * @param mimeType — MIME type of the file
 * @param fileName — original filename (for extension-based fallback)
 */
export function scanFileForHiddenText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): HiddenTextScanResult {
  const lower = fileName.toLowerCase();

  try {
    if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
      return scanPdfForHiddenText(buffer);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lower.endsWith('.docx')
    ) {
      return scanDocxForHiddenText(buffer);
    }
  } catch (error) {
    console.warn('[hiddenTextDetection] Scan failed:', error);
  }

  // Unsupported file type or scan error — return clean result
  return { ...CLEAN_RESULT };
}

/**
 * Human-readable summary of hidden text findings.
 * Returns null if no issues found.
 */
export function getHiddenTextWarning(result: HiddenTextScanResult): string | null {
  if (!result.flagged) return null;

  const techniques = result.flags
    .filter((f) => f.severity !== 'low')
    .map((f) => f.description)
    .slice(0, 3)
    .join('; ');

  return `Hidden text detected in ${result.fileType.toUpperCase()} (${result.totalIndicators} indicator(s)): ${techniques}`;
}
