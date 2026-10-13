import OpenAI, { AzureOpenAI } from "openai";
import { CONFIG } from "../config";
import { SearchResultItem } from "../types";

let openaiClient: OpenAI | AzureOpenAI | null = null;

function getOpenAIClient(): OpenAI | AzureOpenAI | null {
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

/**
 * Streams chat responses from Google Gemini API via Server-Sent Events (SSE)
 */
async function createGeminiChatStream(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const model = CONFIG.GEMINI_CHAT_MODEL || "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${CONFIG.GEMINI_API_KEY}`;

  const systemMessage = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.2,
    },
  };

  if (systemMessage) {
    payload.systemInstruction = {
      parts: [{ text: systemMessage.content }],
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(`Gemini stream failed (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  return new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;
              const jsonStr = trimmed.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const data = JSON.parse(jsonStr);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
              } catch {
                // Ignore partial JSON
              }
            }
          }
        }

        if (buffer.trim()) {
          const lines = buffer.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const data = JSON.parse(trimmed.slice(6).trim());
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
              } catch {
                // Ignore partial JSON
              }
            }
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

export async function createChatStream(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<ReadableStream<Uint8Array>> {
  // 1. Try Google Gemini first if configured
  if (CONFIG.GEMINI_API_KEY) {
    try {
      return await createGeminiChatStream(messages);
    } catch (err) {
      console.warn("[LLM] Gemini stream error, checking fallback:", err);
    }
  }

  // 2. Try OpenAI / Azure OpenAI if configured
  const openAiClient = getOpenAIClient();
  const encoder = new TextEncoder();

  if (openAiClient) {
    try {
      const model = CONFIG.AZURE_OPENAI_DEPLOYMENT_NAME || CONFIG.OPENAI_CHAT_MODEL;
      const stream = await openAiClient.chat.completions.create({
        model,
        messages,
        stream: true,
        temperature: 0.2,
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
    } catch (error) {
      console.warn("[LLM] OpenAI stream error:", error);
    }
  }

  // 3. Fallback mock stream for offline testing
  return new ReadableStream({
    async start(controller) {
      const mockResponse =
        "*(Mock Demo Mode)*\n\n" +
        "I have received your query and retrieved relevant document chunks! " +
        "Configure your `GEMINI_API_KEY` or `OPENAI_API_KEY` in `.env.local` to enable live streaming generation.";

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
