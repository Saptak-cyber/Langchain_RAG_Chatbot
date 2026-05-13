import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import { HuggingFaceBgeEmbeddings } from "./hf-inference-embeddings";
import { getRetriever } from "./vectorstore";
import { createLLM } from "./chat";
import { MAX_RETRIEVAL_ATTEMPTS, MAX_QUALITY_RETRIES } from "./constants";

// ---------------------------------------------------------------------------
// Graph state
// ---------------------------------------------------------------------------

const HybridRAGState = Annotation.Root({
  documentId: Annotation<string>(),
  originalQuery: Annotation<string>(),

  enhancedQuery: Annotation<string>({
    reducer: (_: string, update: string) => update,
    default: () => "",
  }),

  needsRetrieval: Annotation<boolean>({
    reducer: (_: boolean, update: boolean) => update,
    default: () => true,
  }),

  retrievedDocs: Annotation<Document[]>({
    reducer: (existing: Document[], update: Document[]) => {
      const seen = new Set(existing.map((d) => d.pageContent));
      return [...existing, ...update.filter((d) => !seen.has(d.pageContent))];
    },
    default: () => [],
  }),

  retrievalAttempts: Annotation<number>({
    reducer: (existing: number, delta: number) => existing + delta,
    default: () => 0,
  }),

  isSufficient: Annotation<boolean>({
    reducer: (_: boolean, update: boolean) => update,
    default: () => false,
  }),

  answer: Annotation<string>({
    reducer: (_: string, update: string) => update,
    default: () => "",
  }),

  isQualityOk: Annotation<boolean>({
    reducer: (_: boolean, update: boolean) => update,
    default: () => false,
  }),

  qualityRetries: Annotation<number>({
    reducer: (_: number, update: number) => update,
    default: () => MAX_QUALITY_RETRIES,
  }),
});

type HybridState = typeof HybridRAGState.State;

// ---------------------------------------------------------------------------
// Routing helpers
// ---------------------------------------------------------------------------

function routeAfterNeedsRetrieval(state: HybridState): "retrieve" | "generate_answer" {
  return state.needsRetrieval ? "retrieve" : "generate_answer";
}

function routeAfterSufficiency(state: HybridState): "generate_answer" | "refine_query" {
  if (state.isSufficient || state.retrievalAttempts >= MAX_RETRIEVAL_ATTEMPTS) {
    return "generate_answer";
  }
  return "refine_query";
}

function routeAfterQuality(state: HybridState): "refine_query" | typeof END {
  if (state.isQualityOk || state.qualityRetries <= 0) {
    return END;
  }
  return "refine_query";
}

// ---------------------------------------------------------------------------
// Node factories (closed over per-request state)
// ---------------------------------------------------------------------------

function makeNodes(documentId: string, capturedDocs: Document[]) {
  const embeddings = new HuggingFaceBgeEmbeddings();

  async function enhance_query(state: HybridState) {
    const llm = createLLM();
    const response = await llm.invoke([
      new SystemMessage(
        "You are a query enhancement specialist. " +
          "Rewrite the user's question to be more specific and retrieval-friendly for a document search. " +
          "Return ONLY the rewritten query — no explanation, no preamble.",
      ),
      new HumanMessage(state.originalQuery),
    ]);
    const enhanced =
      typeof response.content === "string"
        ? response.content.trim()
        : state.originalQuery;
    return { enhancedQuery: enhanced };
  }

  async function check_needs_retrieval(state: HybridState) {
    const llm = createLLM();
    const response = await llm.invoke([
      new SystemMessage(
        "You decide whether a document search is required to answer a question. " +
          "Reply with exactly YES or NO.\n" +
          'Say NO only if the question is a greeting, simple arithmetic, or general knowledge that needs no document context.\n' +
          "Say YES for everything else.",
      ),
      new HumanMessage(state.enhancedQuery),
    ]);
    const text =
      typeof response.content === "string"
        ? response.content.trim().toUpperCase()
        : "";
    return { needsRetrieval: !text.startsWith("NO") };
  }

  async function retrieve(state: HybridState) {
    const retriever = getRetriever(embeddings, documentId);
    const docs = await retriever.invoke(state.enhancedQuery);
    // Persist unique docs for the API route to use as sources
    for (const doc of docs) {
      if (!capturedDocs.some((d) => d.pageContent === doc.pageContent)) {
        capturedDocs.push(doc);
      }
    }
    return { retrievedDocs: docs, retrievalAttempts: 1 };
  }

  async function check_sufficiency(state: HybridState) {
    const llm = createLLM();
    const context = state.retrievedDocs
      .map((d, i) => `[${i + 1}] ${d.pageContent}`)
      .join("\n\n");
    const response = await llm.invoke([
      new SystemMessage(
        "You evaluate whether the retrieved document chunks contain enough information " +
          "to fully answer the question. " +
          "Reply with exactly YES or NO.",
      ),
      new HumanMessage(
        `Question: ${state.enhancedQuery}\n\nRetrieved chunks:\n${context}`,
      ),
    ]);
    const text =
      typeof response.content === "string"
        ? response.content.trim().toUpperCase()
        : "";
    return { isSufficient: text.startsWith("YES") };
  }

  async function refine_query(state: HybridState) {
    const llm = createLLM();
    const context = state.retrievedDocs
      .slice(0, 3)
      .map((d, i) => `[${i + 1}] ${d.pageContent.slice(0, 300)}`)
      .join("\n\n");
    const response = await llm.invoke([
      new SystemMessage(
        "You are a query refinement specialist. " +
          "Given the original question, the current search query, and snippets that were retrieved but insufficient, " +
          "generate a more targeted search query. " +
          "Return ONLY the refined query — nothing else.",
      ),
      new HumanMessage(
        `Original question: ${state.originalQuery}\n` +
          `Current search query: ${state.enhancedQuery}\n\n` +
          `Insufficient snippets:\n${context}`,
      ),
    ]);
    const refined =
      typeof response.content === "string"
        ? response.content.trim()
        : state.enhancedQuery;
    return { enhancedQuery: refined };
  }

  async function generate_answer(state: HybridState) {
    const llm = createLLM({ streaming: true });
    const hasDocs = state.retrievedDocs.length > 0;
    const context = hasDocs
      ? state.retrievedDocs
          .map((d, i) => `[${i + 1}] ${d.pageContent}`)
          .join("\n\n")
      : "No document context available.";

    const sysPrompt = hasDocs
      ? "You are a helpful assistant. Answer the user's question using ONLY the provided document context. " +
        "Be thorough, accurate, and cite the relevant sections by their number [1], [2], etc."
      : "You are a helpful assistant. Answer the user's question directly.";

    const response = await llm.invoke([
      new SystemMessage(sysPrompt),
      new HumanMessage(
        hasDocs
          ? `Context:\n${context}\n\nQuestion: ${state.originalQuery}`
          : state.originalQuery,
      ),
    ]);
    const answer =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    return { answer };
  }

  async function check_quality(state: HybridState) {
    const llm = createLLM();
    const response = await llm.invoke([
      new SystemMessage(
        "You evaluate the quality of an answer to a question. " +
          'Reply with exactly YES if the answer is complete and accurate, or NO if it is incomplete, evasive, or says "I don\'t have enough information".',
      ),
      new HumanMessage(
        `Question: ${state.originalQuery}\n\nAnswer: ${state.answer}`,
      ),
    ]);
    const text =
      typeof response.content === "string"
        ? response.content.trim().toUpperCase()
        : "";
    const isGood = text.startsWith("YES");
    return {
      isQualityOk: isGood,
      qualityRetries: isGood ? 0 : state.qualityRetries - 1,
    };
  }

  return {
    enhance_query,
    check_needs_retrieval,
    retrieve,
    check_sufficiency,
    refine_query,
    generate_answer,
    check_quality,
  };
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export function buildHybridGraph(documentId: string) {
  const capturedDocs: Document[] = [];
  const nodes = makeNodes(documentId, capturedDocs);

  const graph = new StateGraph(HybridRAGState)
    .addNode("enhance_query", nodes.enhance_query)
    .addNode("check_needs_retrieval", nodes.check_needs_retrieval)
    .addNode("retrieve", nodes.retrieve)
    .addNode("check_sufficiency", nodes.check_sufficiency)
    .addNode("refine_query", nodes.refine_query)
    .addNode("generate_answer", nodes.generate_answer)
    .addNode("check_quality", nodes.check_quality)
    .addEdge(START, "enhance_query")
    .addEdge("enhance_query", "check_needs_retrieval")
    .addConditionalEdges(
      "check_needs_retrieval",
      routeAfterNeedsRetrieval,
      { retrieve: "retrieve", generate_answer: "generate_answer" },
    )
    .addEdge("retrieve", "check_sufficiency")
    .addConditionalEdges(
      "check_sufficiency",
      routeAfterSufficiency,
      { generate_answer: "generate_answer", refine_query: "refine_query" },
    )
    .addEdge("refine_query", "retrieve")
    .addEdge("generate_answer", "check_quality")
    .addConditionalEdges(
      "check_quality",
      routeAfterQuality,
      { refine_query: "refine_query", [END]: END },
    )
    .compile();

  return { graph, capturedDocs };
}
