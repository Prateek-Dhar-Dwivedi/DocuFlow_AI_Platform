import { NextResponse } from "next/server";
import { getAllDocuments, getActiveVectorProvider } from "@/lib/vector";
import {
  hasPineconeConfigured,
  hasAzureSearchConfigured,
  hasOpenAIConfigured,
  CONFIG,
} from "@/lib/config";

export async function GET() {
  try {
    const docs = await getAllDocuments();
    return NextResponse.json({
      documents: docs,
      status: {
        vectorProvider: getActiveVectorProvider(),
        pineconeConnected: hasPineconeConfigured(),
        pineconeIndex: CONFIG.PINECONE_INDEX_NAME,
        azureSearchConnected: hasAzureSearchConfigured(),
        openAIConnected: hasOpenAIConfigured(),
        totalDocuments: docs.length,
        totalChunks: docs.reduce((acc, d) => acc + d.chunkCount, 0),
      },
    });
  } catch (error) {
    console.error("[Documents API] Error listing documents:", error);
    return NextResponse.json(
      { error: "Failed to retrieve documents" },
      { status: 500 }
    );
  }
}
