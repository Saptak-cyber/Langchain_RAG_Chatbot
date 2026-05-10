import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { loadDocumentsFromBuffer } from "@/lib/rag/load-document";
import { chunkDocuments } from "@/lib/rag/chunk";
import { addDocumentsToStore } from "@/lib/rag/vectorstore";
import { HuggingFaceBgeEmbeddings } from "@/lib/rag/hf-inference-embeddings";

export const runtime = "nodejs";

function logError(step: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const cause = err instanceof Error && err.cause ? err.cause : undefined;
  console.error(`[ingest] ✗ step="${step}" message="${message}"`);
  if (stack) console.error(`[ingest]   stack: ${stack}`);
  if (cause) console.error(`[ingest]   cause:`, cause);
  console.error(`[ingest]   raw:`, err);
  return message;
}

export async function POST(req: NextRequest) {
  let step = "parse-form";
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A file field named 'file' is required." },
        { status: 400 },
      );
    }

    const filename = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());
    const documentId = randomUUID();

    console.log(`[ingest] filename="${filename}" size=${buffer.length}B documentId=${documentId}`);

    step = "load-document";
    console.log(`[ingest] loading document…`);
    const rawDocs = await loadDocumentsFromBuffer(buffer, filename, documentId);
    console.log(`[ingest] loaded ${rawDocs.length} raw docs`);

    step = "chunk";
    const chunks = await chunkDocuments(rawDocs);
    console.log(`[ingest] split into ${chunks.length} chunks`);

    step = "init-embeddings";
    const embeddings = new HuggingFaceBgeEmbeddings();

    step = "embed-and-store";
    console.log(`[ingest] embedding and storing ${chunks.length} chunks…`);
    await addDocumentsToStore(embeddings, chunks);
    console.log(`[ingest] ✓ done`);

    return NextResponse.json({ documentId, filename, chunks: chunks.length });
  } catch (err: unknown) {
    const message = logError(step, err);
    return NextResponse.json({ error: message, step }, { status: 500 });
  }
}
