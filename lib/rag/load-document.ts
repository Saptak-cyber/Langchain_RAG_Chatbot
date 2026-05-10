import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";

export type SourceType = "pdf" | "csv";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".csv"]);

export function validateUploadExtension(filename: string): SourceType {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file type "${ext}". Only PDF (.pdf) and CSV (.csv) uploads are accepted.`,
    );
  }
  return ext === ".pdf" ? "pdf" : "csv";
}

/**
 * Loads a PDF or CSV from the given buffer.
 * Because PDFLoader/CSVLoader require filesystem paths, the buffer is written
 * to a temp file, loaded, then cleaned up.
 */
export async function loadDocumentsFromBuffer(
  buffer: Buffer,
  filename: string,
  documentId: string,
): Promise<Document[]> {
  const sourceType = validateUploadExtension(filename);
  const ext = path.extname(filename).toLowerCase();
  const tmpPath = path.join(os.tmpdir(), `notebookllm-${randomUUID()}${ext}`);

  await writeFile(tmpPath, buffer);

  try {
    let rawDocs: Document[];

    if (sourceType === "pdf") {
      const loader = new PDFLoader(tmpPath);
      rawDocs = await loader.load();
    } else {
      const loader = new CSVLoader(tmpPath);
      rawDocs = await loader.load();
    }

    return rawDocs.map(
      (doc) =>
        new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            documentId,
            sourceFilename: filename,
            sourceType,
          },
        }),
    );
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
