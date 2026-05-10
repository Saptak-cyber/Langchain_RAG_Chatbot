import { InferenceClient } from "@huggingface/inference";
import type { FeatureExtractionOutput } from "@huggingface/inference";
import { Embeddings } from "@langchain/core/embeddings";
import { HF_EMBEDDING_MODEL } from "./constants";

/**
 * Collapses nested FeatureExtractionOutput into a flat 384-dim vector.
 * bge-small-en-v1.5 returns shape [1, tokens, 384] or [tokens, 384]
 * depending on whether mean-pooling was already applied by the endpoint.
 */
function normalizeOutput(raw: FeatureExtractionOutput): number[] {
  if (!raw || raw.length === 0) {
    throw new Error("Empty embedding response from Hugging Face");
  }

  // Flat array of numbers → already a vector
  if (typeof raw[0] === "number") {
    return raw as number[];
  }

  // Outer batch dimension of 1 → unwrap
  if (raw.length === 1) {
    const inner = raw[0] as number | number[] | number[][];
    if (typeof inner === "number") return [inner];
    if (!Array.isArray(inner)) return [inner];
    if (inner.length === 0) throw new Error("Empty inner tensor");
    if (typeof inner[0] === "number") return inner as number[];
    // inner is number[][] → mean-pool token dimension
    return meanPool(inner as number[][]);
  }

  // Assume shape [tokens, dim] → mean-pool
  if (Array.isArray(raw[0]) && typeof (raw[0] as number[])[0] === "number") {
    return meanPool(raw as number[][]);
  }

  throw new Error("Unexpected feature-extraction tensor shape");
}

function meanPool(rows: number[][]): number[] {
  const dim = rows[0]!.length;
  const acc = new Array<number>(dim).fill(0);
  for (const row of rows) {
    for (let i = 0; i < dim; i++) acc[i]! += row[i]!;
  }
  return acc.map((v) => v / rows.length);
}

export class HuggingFaceBgeEmbeddings extends Embeddings {
  private readonly client: InferenceClient;
  readonly model: string = HF_EMBEDDING_MODEL;

  constructor(fields?: { apiKey?: string }) {
    super({});
    const apiKey = fields?.apiKey ?? process.env.HF_TOKEN;
    if (!apiKey?.trim()) {
      throw new Error("HF_TOKEN environment variable is required for embeddings");
    }
    this.client = new InferenceClient(apiKey);
  }

  async embedQuery(text: string): Promise<number[]> {
    const raw = await this.client.featureExtraction({
      model: this.model,
      inputs: text,
    });
    return normalizeOutput(raw);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embedQuery(text));
    }
    return results;
  }
}
