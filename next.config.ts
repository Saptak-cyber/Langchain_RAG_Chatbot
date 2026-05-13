import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "@langchain/community",
    "@langchain/classic",
    "@langchain/langgraph",
    "@huggingface/inference",
    "@qdrant/js-client-rest",
  ],
};

export default nextConfig;
