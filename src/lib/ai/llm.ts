import OpenAI, { AzureOpenAI } from "openai";
import { CONFIG } from "../config";
import { SearchResultItem } from "../types";

let openaiClient: OpenAI | AzureOpenAI | null = null;

function getClient(): OpenAI | AzureOpenAI | null {
  if (openaiClient) return openaiClient;

  if (CONFIG.AZURE_OPENAI_ENDPOINT && CONFIG.AZURE_OPENAI_KEY) {
    openaiClient = new AzureOpenAI({
      endpoint: CONFIG.AZURE_OPENAI_ENDPOINT,
      apiKey: CONFIG.AZURE_OPENAI_KEY,
      apiVersion: CONFIG.AZURE_OPENAI_API_VERSION,
      deployment: CONFIG.AZURE_OPENAI_DEPLOYMENT_NAME || undefined,
    });
    return openaiClient;
  }

  if (CONFIG.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: CONFIG.OPENAI_API_KEY,
    });
    return openaiClient;
  }

  return null;
}

export function buildSystemPrompt(contextChunks: SearchResultItem[]): string {
  const contextText = contextChunks
    .map(
      (chunk, index) =>
        `[Document ${index + 1}: ${chunk.title} (Source: ${chunk.metadata?.source || "UiPath Bot Ingestion"})]\n${chunk.content}`
    )
    .join("\n\n---\n\n");

  return `You are an intelligent, highly accurate enterprise assistant powered by a Retrieval-Augmented Generation (RAG) system with documents ingested via UiPath RPA automation.

Your job is to answer the user's question based strictly on the retrieved context below.

Rules:
1. Base your answer ONLY on the provided context documents.
2. If the context does not contain enough information to answer the question, clearly state: "Based on the ingested documents, I do not have enough information to answer this question." Do not make up facts or extrapolate beyond the provided text.
3. Be professional, concise, and structured. Use Markdown formatting (headings, bullet points, code blocks) when appropriate.
4. Reference the document title when stating key facts.

=== RETRIEVED CONTEXT ===
${contextText || "No relevant documents found in the vector index."}
=========================`;
}

export async function createChatStream(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<ReadableStream<Uint8Array>> {
  const client = getClient();
  const encoder = new TextEncoder();

  if (!client) {
    // Graceful offline mock stream for testing UI when API keys are not yet configured
    return new ReadableStream({
      async start(controller) {
        const mockResponse =
          "*(Mock Demo Mode: No OpenAI API key configured yet)*\n\n" +
          "I have received your query and retrieved relevant document chunks! " +
          "To enable live AI generation, configure your `OPENAI_API_KEY` or `AZURE_OPENAI_KEY` in `.env.local`.\n\n" +
          "Your ingested context was successfully retrieved and is displayed in the citations panel below.";

        const words = mockResponse.split(" ");
        for (const word of words) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: word + " " })}\n\n`));
          await new Promise((res) => setTimeout(res, 25));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
  }

  const model = CONFIG.AZURE_OPENAI_DEPLOYMENT_NAME || CONFIG.OPENAI_CHAT_MODEL;

  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature: 0.2, // Low temperature for high factual grounding
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
