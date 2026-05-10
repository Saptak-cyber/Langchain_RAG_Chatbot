import { ChatOpenAI } from "@langchain/openai";

export function createGroqChatModel(): ChatOpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  return new ChatOpenAI({
    model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
    temperature: 0,
    apiKey,
    configuration: {
      baseURL: "https://api.groq.com/openai/v1",
    },
  });
}
