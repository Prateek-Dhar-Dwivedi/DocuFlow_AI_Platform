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
  const encoder = new TextEncoder();

  // 1. Try Google Gemini first if configured (with automatic retry)
  if (CONFIG.GEMINI_API_KEY) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await createGeminiChatStream(messages);
      } catch (err) {
        console.warn(`[LLM] Gemini stream attempt ${attempt} failed:`, err);
        if (attempt < 2) {
          await new Promise((res) => setTimeout(res, 600));
        }
      }
    }
  }

  // 2. Try OpenAI / Azure OpenAI if configured
  const openAiClient = getOpenAIClient();

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

  // 3. Fallback: Synthesize grounded response directly from retrieved context if available
  return new ReadableStream({
    async start(controller) {
      const systemMsg = messages.find((m) => m.role === "system")?.content || "";
      const contextMatch = systemMsg.match(/=== RETRIEVED CONTEXT ===\s*([\s\S]*?)\s*=========================/);
      const retrievedContext = contextMatch ? contextMatch[1].trim() : "";

      let fallbackText = "";
      if (retrievedContext && !retrievedContext.includes("No relevant documents found in the vector index.")) {
        fallbackText =
          "### Retrieved Document Context\n\n" +
          "Here are the relevant sections retrieved from your ingested documents:\n\n" +
          retrievedContext;
      } else {
        fallbackText =
          "I was unable to retrieve a response from the language model service at this moment. Please check your network connection or try your request again in a few moments.";
      }

      const words = fallbackText.split(" ");
      for (const word of words) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: word + " " })}\n\n`));
        await new Promise((res) => setTimeout(res, 20));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
