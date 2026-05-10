import { NextRequest, NextResponse } from "next/server";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { HuggingFaceBgeEmbeddings } from "@/lib/rag/hf-inference-embeddings";
import { createGroqChatModel } from "@/lib/rag/chat";
import { getRetriever } from "@/lib/rag/vectorstore";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's question using ONLY the context provided below.
If the answer cannot be found in the context, say "I don't have enough information in the document to answer that."
Do not use your general knowledge — stick strictly to the provided context.`;

function logError(step: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const cause = err instanceof Error && err.cause ? err.cause : undefined;
  console.error(`[chat] ✗ step="${step}" message="${message}"`);
  if (stack) console.error(`[chat]   stack: ${stack}`);
  if (cause) console.error(`[chat]   cause:`, cause);
  console.error(`[chat]   raw:`, err);
  return message;
}

export async function POST(req: NextRequest) {
  let step = "parse-body";
  try {
    const body = await req.json();
    const { documentId, message } = body as {
      documentId?: string;
      message?: string;
    };

    if (!documentId?.trim()) {
      return NextResponse.json(
        { error: "documentId is required." },
        { status: 400 },
      );
    }
    if (!message?.trim()) {
      return NextResponse.json(
        { error: "message is required." },
        { status: 400 },
      );
    }

    console.log(`[chat] documentId=${documentId} message="${message.slice(0, 80)}"`);

    step = "init-embeddings";
    const embeddings = new HuggingFaceBgeEmbeddings();

    step = "build-retriever";
    const retriever = getRetriever(embeddings, documentId);

    step = "retrieve-chunks";
    console.log(`[chat] retrieving chunks…`);
    const chunks = await retriever.invoke(message);
    console.log(`[chat] retrieved ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return NextResponse.json({
        answer:
          "I couldn't find any relevant sections in the document for your question.",
        sources: [],
      });
    }

    const context = chunks
      .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
      .join("\n\n");

    step = "init-llm";
    const llm = createGroqChatModel();

    step = "llm-invoke";
    console.log(`[chat] calling Groq LLM…`);
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(`Context:\n${context}\n\nQuestion: ${message}`),
    ]);
    console.log(`[chat] LLM responded`);

    const answer =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const sources = chunks.map((doc) => ({
      pageContent: doc.pageContent.slice(0, 200),
      metadata: doc.metadata,
    }));

    return NextResponse.json({ answer, sources });
  } catch (err: unknown) {
    const message = logError(step, err);
    return NextResponse.json({ error: message, step }, { status: 500 });
  }
}
