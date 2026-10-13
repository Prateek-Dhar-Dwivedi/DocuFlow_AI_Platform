export interface DocumentMetadata {
  source?: string;
  author?: string;
  category?: string;
  uploadedAt?: string;
  botId?: string;
  [key: string]: unknown;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  title: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  contentVector?: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  source: string;
  chunkCount: number;
  totalCharacters: number;
  createdAt: string;
  metadata?: DocumentMetadata;
}

export interface IngestRequestPayload {
  title: string;
  content: string;
  source?: string;
  metadata?: DocumentMetadata;
}

export interface IngestResponse {
  success: boolean;
  documentId: string;
  title: string;
  chunksCreated: number;
  message: string;
}

export interface SearchResultItem {
  id: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  citations?: SearchResultItem[];
}
