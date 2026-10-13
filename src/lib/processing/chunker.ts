import { CONFIG } from "../config";
import { DocumentChunk, DocumentMetadata } from "../types";

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export function chunkText(
  documentId: string,
  title: string,
  fullText: string,
  metadata: DocumentMetadata = {},
  options?: ChunkOptions
): DocumentChunk[] {
  const chunkSize = options?.chunkSize ?? CONFIG.CHUNK_SIZE;
  const chunkOverlap = options?.chunkOverlap ?? CONFIG.CHUNK_OVERLAP;

  const cleanedText = fullText.replace(/\r\n/g, "\n").trim();
  if (!cleanedText) {
    return [];
  }

  const rawChunks: string[] = [];
  let startIndex = 0;

  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= cleanedText.length) {
      rawChunks.push(cleanedText.substring(startIndex).trim());
      break;
    }

    // Look for natural breaking points near endIndex:
    // 1. Paragraph break (\n\n)
    // 2. Line break (\n)
    // 3. Sentence end (. )
    // 4. Space (' ')
    let splitIndex = -1;
    const windowStart = Math.max(startIndex + chunkSize / 2, endIndex - 150);
    const candidateSub = cleanedText.substring(windowStart, endIndex + 50);

    const paraIdx = candidateSub.lastIndexOf("\n\n");
    if (paraIdx !== -1) {
      splitIndex = windowStart + paraIdx + 2;
    } else {
      const sentenceIdx = candidateSub.search(/[.!?]\s+[A-Z0-9]/);
      if (sentenceIdx !== -1) {
        splitIndex = windowStart + sentenceIdx + 2;
      } else {
        const spaceIdx = candidateSub.lastIndexOf(" ");
        if (spaceIdx !== -1) {
          splitIndex = windowStart + spaceIdx + 1;
        }
      }
    }

    if (splitIndex === -1 || splitIndex <= startIndex) {
      splitIndex = endIndex;
    }

    const chunkContent = cleanedText.substring(startIndex, splitIndex).trim();
    if (chunkContent.length > 0) {
      rawChunks.push(chunkContent);
    }

    // Advance startIndex by chunk size minus overlap
    startIndex = Math.max(splitIndex - chunkOverlap, startIndex + 1);
  }

  const totalChunks = rawChunks.length;
  const now = new Date().toISOString();

  return rawChunks.map((content, idx) => ({
    id: `${documentId}_chunk_${idx}`,
    documentId,
    title,
    content,
    chunkIndex: idx,
    totalChunks,
    metadata: {
      ...metadata,
      title,
      chunkIndex: idx,
      totalChunks,
    },
    createdAt: now,
  }));
}
