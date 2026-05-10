import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import type { Embeddings } from "@langchain/core/embeddings";
import type { Document } from "@langchain/core/documents";
import { DEFAULT_QDRANT_COLLECTION, RETRIEVAL_K } from "./constants";

function getQdrantConfig() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  const collectionName =
    process.env.QDRANT_COLLECTION_NAME ?? DEFAULT_QDRANT_COLLECTION;

  if (!url?.trim()) {
    throw new Error("QDRANT_URL environment variable is required");
  }

  return { url, apiKey, collectionName };
}

function makeQdrantClient(): QdrantClient {
  const { url, apiKey } = getQdrantConfig();
  return new QdrantClient({ url, apiKey });
}

/**
 * Ensures a keyword payload index exists for `metadata.documentId`.
 * Qdrant requires this before the field can be used in a filter.
 * The call is idempotent — Qdrant ignores it if the index already exists.
 */
async function ensureDocumentIdIndex(
  client: QdrantClient,
  collectionName: string,
): Promise<void> {
  await client.createPayloadIndex(collectionName, {
    field_name: "metadata.documentId",
    field_schema: "keyword",
    wait: true,
  });
}

export function createVectorStore(embeddings: Embeddings): QdrantVectorStore {
  const { url, apiKey, collectionName } = getQdrantConfig();
  return new QdrantVectorStore(embeddings, {
    url,
    apiKey,
    collectionName,
  });
}

/** Qdrant filter that scopes similarity search to one ingested document. */
export function documentFilter(documentId: string) {
  return {
    must: [
      {
        key: "metadata.documentId",
        match: { value: documentId },
      },
    ],
  };
}

/**
 * Upserts documents into Qdrant, then ensures the payload index on
 * `metadata.documentId` exists so it can be used in filters.
 */
export async function addDocumentsToStore(
  embeddings: Embeddings,
  documents: Document[],
): Promise<void> {
  if (documents.length === 0) return;
  const { url, apiKey, collectionName } = getQdrantConfig();

  // fromDocuments calls ensureCollection internally, then upserts
  await QdrantVectorStore.fromDocuments(documents, embeddings, {
    url,
    apiKey,
    collectionName,
  });

  // Create the keyword index so filters on metadata.documentId work
  const client = makeQdrantClient();
  await ensureDocumentIdIndex(client, collectionName);
}

/** Returns a LangChain retriever scoped to the given documentId. */
export function getRetriever(embeddings: Embeddings, documentId: string) {
  const store = createVectorStore(embeddings);
  return store.asRetriever({
    k: RETRIEVAL_K,
    filter: documentFilter(documentId),
  });
}
