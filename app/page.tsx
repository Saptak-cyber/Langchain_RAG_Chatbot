"use client";

import { useState, useRef, FormEvent } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Source = {
  pageContent: string;
  metadata: Record<string, unknown>;
};

export default function Home() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setDocumentId(null);
    setFilename(null);
    setMessages([]);
    setSources([]);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setDocumentId(data.documentId);
      setFilename(data.filename);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleChat(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!documentId || !input.trim() || thinking) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setThinking(true);
    setSources([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, message: userMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat failed");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
      setSources(data.sources ?? []);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            NotebookLLM
          </h1>
          <p className="mt-1 text-zinc-400 text-sm">
            Upload a PDF or CSV and ask questions grounded in its content.
          </p>
        </div>

        {/* Upload */}
        <form
          onSubmit={handleUpload}
          className="bg-zinc-900 rounded-2xl p-6 flex flex-col gap-4 border border-zinc-800"
        >
          <label className="text-sm font-medium text-zinc-300">
            Document (PDF or CSV only)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv"
            className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
          />
          <button
            type="submit"
            disabled={uploading}
            className="self-end rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 text-sm font-medium transition-colors"
          >
            {uploading ? "Uploading & indexing…" : "Upload"}
          </button>
          {uploadError && (
            <p className="text-red-400 text-sm">{uploadError}</p>
          )}
          {documentId && (
            <p className="text-emerald-400 text-sm">
              ✓ Indexed <span className="font-medium">{filename}</span>
            </p>
          )}
        </form>

        {/* Chat */}
        {documentId && (
          <div className="flex flex-col gap-4">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 min-h-64 p-4 flex flex-col gap-3 overflow-y-auto max-h-112">
              {messages.length === 0 && (
                <p className="text-zinc-500 text-sm text-center mt-auto">
                  Ask anything about <span className="text-zinc-300">{filename}</span>
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`rounded-xl px-4 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-800 text-zinc-100"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-400">
                    Thinking…
                  </div>
                </div>
              )}
            </div>

            {/* Sources */}
            {sources.length > 0 && (
              <details className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400">
                <summary className="cursor-pointer text-zinc-300 font-medium">
                  Sources ({sources.length} chunks)
                </summary>
                <ul className="mt-3 flex flex-col gap-3">
                  {sources.map((s, i) => (
                    <li key={i} className="border-t border-zinc-800 pt-2">
                      <span className="text-zinc-500 font-mono">
                        [{i + 1}]{" "}
                        {typeof s.metadata?.loc === "object" && s.metadata.loc !== null
                          ? `page ${String((s.metadata.loc as Record<string,unknown>).pageNumber ?? "?")}`
                          : s.metadata?.line != null
                          ? `row ${String(s.metadata.line)}`
                          : ""}
                      </span>
                      <p className="mt-0.5">{s.pageContent}…</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <form onSubmit={handleChat} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question…"
                className="flex-1 rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || thinking}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 text-sm font-medium transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
