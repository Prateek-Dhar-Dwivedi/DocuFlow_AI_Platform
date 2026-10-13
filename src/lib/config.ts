export const CONFIG = {
  // UiPath Security
  UIPATH_API_KEY: process.env.UIPATH_API_KEY || "dev-uipath-secret-key-12345",

  // Pinecone Vector Database
  PINECONE_API_KEY: process.env.PINECONE_API_KEY || "",
  PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || "rag-documents",
  PINECONE_HOST: process.env.PINECONE_HOST || "",

  // Azure AI Search (Optional fallback)
  AZURE_SEARCH_ENDPOINT: process.env.AZURE_SEARCH_ENDPOINT || "",
  AZURE_SEARCH_KEY: process.env.AZURE_SEARCH_KEY || "",
  AZURE_SEARCH_INDEX_NAME: process.env.AZURE_SEARCH_INDEX_NAME || "documents-rag-index",

  // Google Gemini
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL || "gemini-3.1-flash-lite",
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",

  // Azure OpenAI (Optional)
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || "",
  AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY || "",
  AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "",
  AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT: process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || "",
  AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || "2024-02-01",

  // Chunking parameters
  CHUNK_SIZE: 800,
  CHUNK_OVERLAP: 150,
};

export function hasGeminiConfigured(): boolean {
  return Boolean(CONFIG.GEMINI_API_KEY);
}

export function hasPineconeConfigured(): boolean {
  return Boolean(CONFIG.PINECONE_API_KEY);
}

export function hasOpenAIConfigured(): boolean {
  return Boolean(CONFIG.OPENAI_API_KEY || (CONFIG.AZURE_OPENAI_ENDPOINT && CONFIG.AZURE_OPENAI_KEY));
}

export function hasAIConfigured(): boolean {
  return hasGeminiConfigured() || hasOpenAIConfigured();
}

export function hasAzureSearchConfigured(): boolean {
  return Boolean(CONFIG.AZURE_SEARCH_ENDPOINT && CONFIG.AZURE_SEARCH_KEY);
}
