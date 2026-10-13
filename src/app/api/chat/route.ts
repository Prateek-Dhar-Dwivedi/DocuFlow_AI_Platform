import { NextRequest, NextResponse } from "next/server";
import { generateSingleEmbedding } from "../../../lib/ai/embeddings";
import { queryVectorStore } from "../../../lib/vector/index";
import { buildSystemPrompt, createChatStream } from "../../../lib/ai/llm";
import { SearchResultItem } from "../../../lib/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages = body.messages || [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. 'messages' array is required." },
        { status: 400 }
      );
    }

    // Extract the latest user query
    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const userQuery = latestUserMessage ? latestUserMessage.content : "";

    if (!userQuery.trim()) {
      return NextResponse.json(
        { error: "Latest user message cannot be empty." },
        { status: 400 }
      );
    }

    // 1. Convert user query to vector embedding
    const queryVector = await generateSingleEmbedding(userQuery);

    // 2. Query Pinecone / Vector DB for top-K matching chunks
    const retrievedChunks = await queryVectorStore(queryVector, userQuery, 5);

    // 3. Construct system prompt with grounding and retrieved context
    const systemPrompt = buildSystemPrompt(retrievedChunks);

    // Filter to last 8 messages for conversation memory
    const history = messages.slice(-8).map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const conversationWithContext = [
      { role: "system" as const, content: systemPrompt },
      ...history,
    ];

    // 4. Create streaming response
    const llmStream = await createChatStream(conversationWithContext);

    // 5. Wrap stream to prepend citations payload event
    const encoder = new TextEncoder();
    const citationsEvent = `data: ${JSON.stringify({
      type: "citations",
      citations: retrievedChunks,
    })}\n\n`;

    const transformedStream = new ReadableStream({
      async start(controller) {
        // Send citations first
        controller.enqueue(encoder.encode(citationsEvent));

        const reader = llmStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(transformedStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Chat API] Error handling chat query:", error);
    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
