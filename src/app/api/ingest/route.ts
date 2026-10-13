import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/auth/api-key";
import { extractTextFromFile } from "@/lib/processing/extractor";
import { chunkText } from "@/lib/processing/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { storeChunks } from "@/lib/vector";
import { IngestResponse } from "@/lib/types";

export const maxDuration = 60; // Allow sufficient time for large documents

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate Request (UiPath Shared Key)
    const auth = validateApiKey(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    let title = "";
    let content = "";
    let source = "UiPath Bot Ingestion";
    let metadata: Record<string, unknown> = {};

    // 2. Parse Incoming Payload (JSON vs Multipart Form-Data)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      title = body.title || `doc_${Date.now()}`;
      content = body.content || "";
      source = body.source || body.metadata?.source || "UiPath Bot Ingestion";
      metadata = body.metadata || {};
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided in multipart form data. Key should be 'file'." },
          { status: 400 }
        );
      }

      title = (formData.get("title") as string) || file.name;
      source = (formData.get("source") as string) || `File: ${file.name}`;
      const rawMetadata = formData.get("metadata") as string;
      if (rawMetadata) {
        try {
          metadata = JSON.parse(rawMetadata);
        } catch {
          metadata = { rawMetadata };
        }
      }

      // Convert file buffer and extract text
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      content = await extractTextFromFile(file.name, buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported Content-Type. Use 'application/json' or 'multipart/form-data'." },
        { status: 415 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Extracted or provided content is empty. Cannot index empty document." },
        { status: 400 }
      );
    }

    // 3. Generate Clean Document ID
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const documentId = `doc_${sanitizedTitle}_${Date.now().toString(36)}`;

    // 4. Chunk Document Text
    const chunks = chunkText(documentId, title, content, {
      ...metadata,
      source,
      uploadedAt: new Date().toISOString(),
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Document produced 0 chunks after splitting." },
        { status: 400 }
      );
    }

    // 5. Generate Vector Embeddings
    const chunkTexts = chunks.map((c) => `${c.title}\n${c.content}`);
    const embeddings = await generateEmbeddings(chunkTexts);

    chunks.forEach((chunk, idx) => {
      chunk.contentVector = embeddings[idx];
    });

    // 6. Index into Pinecone / Vector DB
    await storeChunks(chunks);

    const response: IngestResponse = {
      success: true,
      documentId,
      title,
      chunksCreated: chunks.length,
      message: `Document "${title}" successfully ingested and indexed into ${chunks.length} vector chunks.`,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[Ingest API] Error processing document:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error during ingestion",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
