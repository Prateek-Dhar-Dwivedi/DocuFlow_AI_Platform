import { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";
import { CONFIG, hasPineconeConfigured } from "../config";
import { DocumentChunk, SearchResultItem } from "../types";

let pineconeClient: Pinecone | null = null;

function getClient(): Pinecone | null {
  if (!hasPineconeConfigured()) return null;
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: CONFIG.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
}

function getIndex() {
  const pc = getClient();
  if (!pc) return null;
  return CONFIG.PINECONE_HOST
    ? pc.index(CONFIG.PINECONE_INDEX_NAME, CONFIG.PINECONE_HOST)
    : pc.index(CONFIG.PINECONE_INDEX_NAME);
}

/**
 * Ensures the Pinecone index exists. If not, creates a serverless index with 1536 dimensions.
 */
export async function ensurePineconeIndex(): Promise<void> {
  const pc = getClient();
  if (!pc) return;

  try {
    const indexName = CONFIG.PINECONE_INDEX_NAME;
    const response = await pc.listIndexes();
    const existing = response.indexes?.some((idx) => idx.name === indexName);

    if (!existing) {
      console.log(`[Pinecone] Index "${indexName}" not found. Creating serverless index...`);
      await pc.createIndex({
        name: indexName,
        dimension: 1536,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      console.log(`[Pinecone] Index "${indexName}" created successfully.`);
    }
  } catch (err) {
    console.warn("[Pinecone] Notice checking or creating index:", err);
  }
}

/**
 * Upserts document chunks into Pinecone in batches
 */
export async function upsertChunksToPinecone(chunks: DocumentChunk[]): Promise<void> {
  const pc = getClient();
  if (!pc) return;

  await ensurePineconeIndex();
  const index = getIndex();
  if (!index) return;

  const records = chunks
    .filter((c) => c.contentVector && c.contentVector.length > 0)
    .map((chunk) => ({
      id: chunk.id,
      values: chunk.contentVector!,
      metadata: {
        documentId: chunk.documentId,
        title: chunk.title,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        createdAt: chunk.createdAt,
        source: String(chunk.metadata?.source || "UiPath Bot Ingestion"),
      } as RecordMetadata,
    }));

  // Batch in chunks of 50 to avoid network limits
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await index.upsert({ records: batch });
  }

  console.log(`[Pinecone] Successfully indexed ${records.length} chunks into "${CONFIG.PINECONE_INDEX_NAME}".`);
}

/**
 * Queries Pinecone for top-K matching chunks given a query embedding vector
 */
export async function searchPinecone(
  queryVector: number[],
  topK = 5
): Promise<SearchResultItem[]> {
  const pc = getClient();
  if (!pc) return [];

  try {
    const index = getIndex();
    if (!index) return [];

    const queryResponse = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
    });

    const items: SearchResultItem[] = [];

    for (const match of queryResponse.matches || []) {
      const meta = match.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;

      items.push({
        id: match.id,
        documentId: String(meta.documentId || ""),
        title: String(meta.title || "Untitled"),
        content: String(meta.content || ""),
        score: match.score || 0,
        metadata: meta,
      });
    }

    return items;
  } catch (err) {
    console.error("[Pinecone] Error querying index:", err);
    return [];
  }
}

/**
 * Deletes all chunks associated with a document ID from Pinecone
 */
export async function deleteDocumentFromPinecone(
  documentId: string,
  chunkIds?: string[]
): Promise<void> {
  const pc = getClient();
  if (!pc) return;

  try {
    const index = getIndex();
    if (!index) return;

    if (chunkIds && chunkIds.length > 0) {
      await index.deleteMany({ ids: chunkIds });
      return;
    }

    // Delete by metadata filter
    await index.deleteMany({
      filter: {
        documentId: { $eq: documentId },
      },
    });
  } catch (err) {
    console.warn(`[Pinecone] Deletion notice for document ${documentId}:`, err);
  }
}
