import { NextResponse } from "next/server";
import {
  hasPineconeConfigured,
  hasAzureSearchConfigured,
  hasOpenAIConfigured,
  CONFIG,
} from "../../../lib/config";
import { getActiveVectorProvider } from "../../../lib/vector/index";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeVectorProvider: getActiveVectorProvider(),
    integrations: {
      pinecone: {
        configured: hasPineconeConfigured(),
        indexName: CONFIG.PINECONE_INDEX_NAME,
      },
      azureSearch: {
        configured: hasAzureSearchConfigured(),
        indexName: CONFIG.AZURE_SEARCH_INDEX_NAME,
      },
      gemini: {
        configured: Boolean(CONFIG.GEMINI_API_KEY),
        chatModel: CONFIG.GEMINI_CHAT_MODEL,
        embeddingModel: CONFIG.GEMINI_EMBEDDING_MODEL,
      },
      openAI: {
        configured: hasOpenAIConfigured(),
        isAzureOpenAI: Boolean(CONFIG.AZURE_OPENAI_ENDPOINT),
        chatModel: CONFIG.AZURE_OPENAI_DEPLOYMENT_NAME || CONFIG.OPENAI_CHAT_MODEL,
      },
      uipathWebhook: {
        active: true,
        endpoint: "/api/ingest",
      },
    },
  });
}
