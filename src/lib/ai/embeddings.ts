import OpenAI, { AzureOpenAI } from "openai";
import { CONFIG } from "../config";

let openaiClient: OpenAI | AzureOpenAI | null = null;

function getOpenAIClient(): OpenAI | AzureOpenAI | null {
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

// In-memory LRU embedding cache for 0ms repeated query retrieval
const embeddingCache = new Map<string, number[]>();
const MAX_EMBEDDING_CACHE_SIZE = 500;

/**
 * Generate 1536-dimensional embeddings using Google Gemini API (with memory cache)
 */
async function generateGeminiEmbedding(text: string): Promise<number[]> {
  const cacheKey = text.trim().toLowerCase();
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  const model = CONFIG.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${CONFIG.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: 1536,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini embedding failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const vector = data.embedding?.values;
  if (!vector || !Array.isArray(vector)) {
    throw new Error("Invalid embedding response from Gemini");
  }

  // Evict oldest if cache limit reached
  if (embeddingCache.size >= MAX_EMBEDDING_CACHE_SIZE) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(cacheKey, vector);

  return vector;
}

/**
 * Generates a mock deterministic 1536-dim normalized vector when API keys are not yet configured.
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

  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < dimensions; i++) {
    vector[i] = vector[i] / norm;
  }
  return vector;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // 1. Try Google Gemini first if configured
  if (CONFIG.GEMINI_API_KEY) {
    try {
      return await Promise.all(texts.map((t) => generateGeminiEmbedding(t)));
    } catch (err) {
      console.warn("[Embeddings] Gemini generation error, falling back to OpenAI or local mock:", err);
    }
  }

  // 2. Try OpenAI / Azure OpenAI if configured
  const openAiClient = getOpenAIClient();
  if (openAiClient) {
    try {
      const model = CONFIG.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || CONFIG.OPENAI_EMBEDDING_MODEL;
      const response = await openAiClient.embeddings.create({
        model,
        input: texts,
      });
      return response.data.map((item) => item.embedding);
    } catch (error) {
      console.error("[Embeddings] OpenAI error:", error);
    }
  }

  // 3. Fallback to mock deterministic vector
  console.warn("[Embeddings] Using deterministic fallback vectors for local testing.");
  return texts.map((t) => generateDeterministicMockVector(t));
}

export async function generateSingleEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}
