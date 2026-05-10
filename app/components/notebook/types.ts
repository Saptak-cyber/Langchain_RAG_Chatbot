export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type Source = {
  pageContent: string;
  metadata: Record<string, unknown>;
};

export type IndexedDoc = {
  documentId: string;
  filename: string;
  indexedAt: string;
  chunks: number;
};
