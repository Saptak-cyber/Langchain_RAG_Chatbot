import { ChatOpenAI } from "@langchain/openai";

/**
 * Creates a ChatOpenAI instance pointing at any OpenAI-compatible endpoint.
 *
 * Priority order for each config value:
 *   LLM_BASE_URL   > GROQ_API_KEY fallback base   (default: Groq)
 *   LLM_API_KEY    > GROQ_API_KEY
 *   LLM_MODEL      > GROQ_MODEL  > "llama-3.1-8b-instant"
 */
export function createLLM({ streaming = false }: { streaming?: boolean } = {}): ChatOpenAI {
  const apiKey =
    process.env.LLM_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY (or GROQ_API_KEY) environment variable is required",
    );
  }

  const baseURL =
    process.env.LLM_BASE_URL?.trim() || "https://api.groq.com/openai/v1";
  const model =
    process.env.LLM_MODEL?.trim() ||
    process.env.GROQ_MODEL?.trim() ||
    "llama-3.1-8b-instant";

  return new ChatOpenAI({
    model,
    temperature: 0,
    apiKey,
    streaming,
    configuration: { baseURL },
  });
}

/** @deprecated Use createLLM() instead */
export const createGroqChatModel = createLLM;
