import { NextRequest } from "next/server";
import { AIMessageChunk } from "@langchain/core/messages";
import { buildHybridGraph } from "@/lib/rag/hybrid-agent";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function sseEvent(payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

// ---------------------------------------------------------------------------
// Step-label map: human-readable status for each graph node
// ---------------------------------------------------------------------------

const NODE_LABELS: Record<string, string> = {
  enhance_query: "Enhancing query…",
  check_needs_retrieval: "Checking if retrieval is needed…",
  retrieve: "Searching document…",
  check_sufficiency: "Evaluating retrieved context…",
  refine_query: "Refining search query…",
  generate_answer: "Generating answer…",
  check_quality: "Checking answer quality…",
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let documentId: string | undefined;
  let message: string | undefined;

  try {
    const body = await req.json();
    documentId = (body as { documentId?: string }).documentId;
    message = (body as { message?: string }).message;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!documentId?.trim()) {
    return new Response(
      JSON.stringify({ error: "documentId is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!message?.trim()) {
    return new Response(
      JSON.stringify({ error: "message is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  console.log(`[chat] documentId=${documentId} message="${message.slice(0, 80)}"`);

  const { graph, capturedDocs } = buildHybridGraph(documentId);

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const agentStream = (await graph.stream(
          { documentId, originalQuery: message },
          { streamMode: "messages" },
        )) as unknown as AsyncIterable<[unknown, { langgraph_node?: string }]>;

        let lastNode = "";

        for await (const [chunk, meta] of agentStream) {
          const node = meta?.langgraph_node ?? "";

          // Emit a status event when we enter a new node
          if (node && node !== lastNode && NODE_LABELS[node]) {
            controller.enqueue(
              sseEvent({ type: "status", step: NODE_LABELS[node] }),
            );
            lastNode = node;
          }

          // Stream tokens only from the generate_answer node
          if (
            node === "generate_answer" &&
            chunk instanceof AIMessageChunk &&
            typeof chunk.content === "string" &&
            chunk.content
          ) {
            controller.enqueue(sseEvent({ type: "token", content: chunk.content }));
          }
        }

        // After graph finishes, send sources derived from retrieved docs
        const sources = capturedDocs.map((doc) => ({
          pageContent: doc.pageContent.slice(0, 200),
          metadata: doc.metadata,
        }));
        controller.enqueue(sseEvent({ type: "sources", sources }));
        controller.enqueue(sseEvent({ type: "done" }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[chat] stream error:", err);
        controller.enqueue(sseEvent({ type: "error", error: msg }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
