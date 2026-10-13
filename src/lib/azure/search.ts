import {
  SearchClient,
  SearchIndexClient,
  AzureKeyCredential,
  VectorizedQuery,
} from "@azure/search-documents";
import { CONFIG, hasAzureSearchConfigured } from "../config";
import { DocumentChunk, DocumentRecord, SearchResultItem } from "../types";

// In-memory fallback repository when Azure AI Search credentials are not yet configured
class MemoryVectorStore {
  private chunks: Map<string, DocumentChunk> = new Map();

  async upsert(chunks: DocumentChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }

  async search(
    queryVector: number[],
    queryText?: string,
    topK = 5
  ): Promise<SearchResultItem[]> {
    const results: SearchResultItem[] = [];

    for (const chunk of this.chunks.values()) {
      let score = 0;

      // Cosine similarity if vectors exist
      if (chunk.contentVector && queryVector.length === chunk.contentVector.length) {
        let dot = 0;
        let magA = 0;
        let magB = 0;
        for (let i = 0; i < queryVector.length; i++) {
          dot += queryVector[i] * chunk.contentVector[i];
          magA += queryVector[i] * queryVector[i];
          magB += chunk.contentVector[i] * chunk.contentVector[i];
        }
        score = dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
      } else if (queryText) {
        // Simple keyword match score
        const terms = queryText.toLowerCase().split(/\s+/);
        const contentLower = chunk.content.toLowerCase();
        const matches = terms.filter((t) => contentLower.includes(t)).length;
        score = matches / (terms.length || 1);
      }

      results.push({
        id: chunk.id,
        documentId: chunk.documentId,
        title: chunk.title,
        content: chunk.content,
        score,
        metadata: chunk.metadata,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async listDocuments(): Promise<DocumentRecord[]> {
    const docMap = new Map<string, { count: number; chars: number; chunk: DocumentChunk }>();

    for (const chunk of this.chunks.values()) {
      const existing = docMap.get(chunk.documentId);
      if (existing) {
        existing.count += 1;
        existing.chars += chunk.content.length;
      } else {
        docMap.set(chunk.documentId, {
          count: 1,
          chars: chunk.content.length,
          chunk,
        });
      }
    }

    return Array.from(docMap.entries()).map(([docId, data]) => ({
      id: docId,
      title: data.chunk.title,
      source: (data.chunk.metadata?.source as string) || "UiPath Bot Ingestion",
      chunkCount: data.count,
      totalCharacters: data.chars,
      createdAt: data.chunk.createdAt,
      metadata: data.chunk.metadata,
    }));
  }

  async deleteDocument(documentId: string): Promise<number> {
    let deleted = 0;
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}

// Global singleton for fallback memory store during development
const globalStore = global as unknown as { __memoryStore?: MemoryVectorStore };
if (!globalStore.__memoryStore) {
  globalStore.__memoryStore = new MemoryVectorStore();
}
const memoryStore = globalStore.__memoryStore;

let searchClient: SearchClient<Record<string, unknown>> | null = null;
let indexClient: SearchIndexClient | null = null;

function getSearchClients() {
  if (!hasAzureSearchConfigured()) {
    return null;
  }

  if (!searchClient || !indexClient) {
    const credential = new AzureKeyCredential(CONFIG.AZURE_SEARCH_KEY);
    indexClient = new SearchIndexClient(CONFIG.AZURE_SEARCH_ENDPOINT, credential);
    searchClient = new SearchClient(
      CONFIG.AZURE_SEARCH_ENDPOINT,
      CONFIG.AZURE_SEARCH_INDEX_NAME,
      credential
    );
  }

  return { searchClient, indexClient };
}

/**
 * Automatically creates the Azure AI Search index with vector search profile if it doesn't exist
 */
export async function ensureSearchIndex(): Promise<void> {
  const clients = getSearchClients();
  if (!clients) return;

  try {
    const indexName = CONFIG.AZURE_SEARCH_INDEX_NAME;
    const existingIndexes = clients.indexClient.listIndexes();
    for await (const idx of existingIndexes) {
      if (idx.name === indexName) {
        return; // Index already exists
      }
    }

    console.log(`[Azure Search] Creating vector index "${indexName}"...`);
    await clients.indexClient.createIndex({
      name: indexName,
      fields: [
        { name: "id", type: "Edm.String", key: true, filterable: true },
        { name: "documentId", type: "Edm.String", filterable: true, facetable: true },
        { name: "title", type: "Edm.String", searchable: true, filterable: true },
        { name: "content", type: "Edm.String", searchable: true },
        { name: "chunkIndex", type: "Edm.Int32", filterable: true },
        { name: "totalChunks", type: "Edm.Int32" },
        {
          name: "contentVector",
          type: "Collection(Edm.Single)",
          searchable: true,
          vectorSearchDimensions: 1536,
          vectorSearchProfileName: "vector-profile-hnsw",
        },
        { name: "metadataJson", type: "Edm.String" },
        { name: "createdAt", type: "Edm.DateTimeOffset", filterable: true, sortable: true },
      ],
      vectorSearch: {
        algorithms: [
          {
            name: "algorithm-hnsw",
            kind: "hnsw",
            parameters: {
              m: 4,
              efConstruction: 400,
              efSearch: 500,
              metric: "cosine",
            },
          },
        ],
        profiles: [
          {
            name: "vector-profile-hnsw",
            algorithmConfigurationName: "algorithm-hnsw",
          },
        ],
      },
    });
    console.log(`[Azure Search] Index "${indexName}" created successfully.`);
  } catch (error) {
    console.warn("[Azure Search] Index verification or creation notice:", error);
  }
}

/**
 * Indexes document chunks in Azure AI Search (with fallback to memory store)
 */
export async function indexDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
  const clients = getSearchClients();

  // Always update memory store for instant responsiveness & fallback
  await memoryStore.upsert(chunks);

  if (!clients) {
    console.log(`[VectorStore] Indexed ${chunks.length} chunks into local memory store.`);
    return;
  }

  await ensureSearchIndex();

  const documents = chunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.documentId,
    title: chunk.title,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    totalChunks: chunk.totalChunks,
    contentVector: chunk.contentVector,
    metadataJson: JSON.stringify(chunk.metadata),
    createdAt: new Date(chunk.createdAt),
  }));

  try {
    const uploadResult = await clients.searchClient.uploadDocuments(documents);
    console.log(`[Azure Search] Successfully indexed ${uploadResult.results.length} chunks.`);
  } catch (error) {
    console.error("[Azure Search] Failed to upload documents to Azure Search:", error);
    throw error;
  }
}

/**
 * Hybrid & Vector search across document chunks
 */
export async function searchChunks(
  queryVector: number[],
  queryText?: string,
  topK = 5
): Promise<SearchResultItem[]> {
  const clients = getSearchClients();

  if (!clients) {
    return memoryStore.search(queryVector, queryText, topK);
  }

  try {
    const vectorizedQuery: VectorizedQuery<Record<string, unknown>> = {
      vector: queryVector,
      fields: ["contentVector"],
      kind: "vector",
      kNearestNeighborsCount: topK,
    };

    const searchResults = await clients.searchClient.search(queryText || undefined, {
      vectorSearchOptions: {
        queries: [vectorizedQuery],
      },
      select: ["id", "documentId", "title", "content", "metadataJson"],
      top: topK,
    });

    const items: SearchResultItem[] = [];
    for await (const result of searchResults.results) {
      let parsedMetadata: Record<string, unknown> = {};
      try {
        if (typeof result.document.metadataJson === "string") {
          parsedMetadata = JSON.parse(result.document.metadataJson);
        }
      } catch {
        // ignore
      }

      items.push({
        id: String(result.document.id),
        documentId: String(result.document.documentId),
        title: String(result.document.title),
        content: String(result.document.content),
        score: result.score,
        metadata: parsedMetadata,
      });
    }

    return items;
  } catch (error) {
    console.warn("[Azure Search] Query error, falling back to local store:", error);
    return memoryStore.search(queryVector, queryText, topK);
  }
}

/**
 * Returns list of distinct indexed documents
 */
export async function listDocuments(): Promise<DocumentRecord[]> {
  // Use memory store or Azure Search aggregation
  return memoryStore.listDocuments();
}

/**
 * Deletes a document and its chunks
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const clients = getSearchClients();
  await memoryStore.deleteDocument(documentId);

  if (!clients) return;

  try {
    // Delete from Azure Search by filtering documentId
    const searchResults = await clients.searchClient.search("*", {
      filter: `documentId eq '${documentId}'`,
      select: ["id"],
    });

    const idsToDelete: { id: string }[] = [];
    for await (const doc of searchResults.results) {
      idsToDelete.push({ id: String(doc.document.id) });
    }

    if (idsToDelete.length > 0) {
      await clients.searchClient.deleteDocuments(idsToDelete);
    }
  } catch (error) {
    console.error(`[Azure Search] Error deleting document ${documentId}:`, error);
  }
}
