import { NextRequest, NextResponse } from "next/server";
import { removeDocument } from "@/lib/vector/index";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    await removeDocument(id);
    return NextResponse.json({
      success: true,
      message: `Document ${id} and all its vector chunks were deleted.`,
    });
  } catch (error) {
    console.error("[Documents API] Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
