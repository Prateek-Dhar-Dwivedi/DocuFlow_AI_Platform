import mammoth from "mammoth";

export async function extractTextFromFile(
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "pdf": {
      // Dynamic import to prevent edge runtime conflicts
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const data = await pdfParse(buffer);
      return data.text || "";
    }

    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    }

    case "txt":
    case "md":
    case "markdown":
    case "json":
    case "csv": {
      return buffer.toString("utf-8");
    }

    default: {
      // Attempt UTF-8 decode as fallback
      try {
        const text = buffer.toString("utf-8");
        // Verify it contains mostly printable text
        if (/^[\x20-\x7E\s]*$/.test(text.slice(0, 500))) {
          return text;
        }
      } catch {
        // ignore
      }
      throw new Error(`Unsupported file type: .${extension}. Supported: .pdf, .docx, .txt, .md, .csv, .json`);
    }
  }
}
