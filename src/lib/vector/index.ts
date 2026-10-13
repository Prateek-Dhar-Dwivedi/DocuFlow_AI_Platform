import { CONFIG, hasPineconeConfigured, hasAzureSearchConfigured } from "../config";
import { DocumentChunk, DocumentRecord, SearchResultItem } from "../types";
import {
  upsertChunksToPinecone,
  searchPinecone,
  deleteDocumentFromPinecone,
} from "./pinecone";
import {
  indexDocumentChunks as indexToAzureSearch,
  searchChunks as searchAzure,
  deleteDocument as deleteFromAzure,
  listDocuments as listFromMemory,
} from "../azure/search";

// Global document tracker for quick UI dashboard listings
const globalStore = global as unknown as {
  __docRegistry?: Map<string, DocumentRecord>;
};
if (!globalStore.__docRegistry) {
  globalStore.__docRegistry = new Map();
}
const docRegistry = globalStore.__docRegistry;

export function getActiveVectorProvider(): "pinecone" | "azure" | "local" {
  if (hasPineconeConfigured()) return "pinecone";
  if (hasAzureSearchConfigured()) return "azure";
  return "local";
}

export async function storeChunks(chunks: DocumentChunk[]): Promise<void> {
  if (chunks.length === 0) return;

  const first = chunks[0];
  const docRecord: DocumentRecord = {
    id: first.documentId,
    title: first.title,
    source: (first.metadata?.source as string) || "UiPath Bot Ingestion",
    chunkCount: chunks.length,
    totalCharacters: chunks.reduce((acc, c) => acc + c.content.length, 0),
    createdAt: first.createdAt,
    metadata: first.metadata,
  };
  docRegistry.set(first.documentId, docRecord);

  const provider = getActiveVectorProvider();

  if (provider === "pinecone") {
    await upsertChunksToPinecone(chunks);
  } else if (provider === "azure") {
    await indexToAzureSearch(chunks);
  } else {
    // Memory fallback inside search.ts
    await indexToAzureSearch(chunks);
  }
}

export async function queryVectorStore(
  queryVector: number[],
  queryText?: string,
  topK = 5
): Promise<SearchResultItem[]> {
  const provider = getActiveVectorProvider();

  if (provider === "pinecone") {
    const results = await searchPinecone(queryVector, topK);
    if (results.length > 0) return results;
  }

  // Fallback to Azure or local memory store
  return searchAzure(queryVector, queryText, topK);
}

export async function getAllDocuments(): Promise<DocumentRecord[]> {
  if (docRegistry.size > 0) {
    return Array.from(docRegistry.values());
  }
  return listFromMemory();
}

export async function removeDocument(documentId: string): Promise<void> {
  docRegistry.delete(documentId);

  const provider = getActiveVectorProvider();
  if (provider === "pinecone") {
    await deleteDocumentFromPinecone(documentId);
  }
  await deleteFromAzure(documentId);
}
