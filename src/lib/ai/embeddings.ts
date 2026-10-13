import OpenAI, { AzureOpenAI } from "openai";
import { CONFIG } from "../config";

let openaiClient: OpenAI | AzureOpenAI | null = null;

function getClient(): OpenAI | AzureOpenAI | null {
  if (openaiClient) return openaiClient;

  // 1. Azure OpenAI Configuration
  if (CONFIG.AZURE_OPENAI_ENDPOINT && CONFIG.AZURE_OPENAI_KEY) {
    openaiClient = new AzureOpenAI({
      endpoint: CONFIG.AZURE_OPENAI_ENDPOINT,
      apiKey: CONFIG.AZURE_OPENAI_KEY,
      apiVersion: CONFIG.AZURE_OPENAI_API_VERSION,
      deployment: CONFIG.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || undefined,
    });
    return openaiClient;
  }

  // 2. Direct OpenAI Configuration
  if (CONFIG.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: CONFIG.OPENAI_API_KEY,
    });
    return openaiClient;
  }

  return null;
}

/**
 * Generates a mock deterministic 1536-dim normalized vector when API keys are not yet configured.
 * This ensures the application can run in local preview mode without crashing.
 */
function generateDeterministicMockVector(text: string, dimensions = 1536): number[] {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  const vector: number[] = new Array(dimensions);
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    const val = Math.sin(hash + i) * Math.cos(i * 0.1);
    vector[i] = val;
    sumSq += val * val;
  }

  // L2 normalize
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < dimensions; i++) {
    vector[i] = vector[i] / norm;
  }
  return vector;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getClient();

  if (!client) {
    console.warn(
      "[Embeddings] No OpenAI or Azure OpenAI API key provided. Using deterministic mock vectors for local testing."
    );
    return texts.map((t) => generateDeterministicMockVector(t));
  }

  try {
    const model = CONFIG.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || CONFIG.OPENAI_EMBEDDING_MODEL;
    const response = await client.embeddings.create({
      model,
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error("[Embeddings] Error generating embeddings:", error);
    throw error;
  }
}

export async function generateSingleEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}
