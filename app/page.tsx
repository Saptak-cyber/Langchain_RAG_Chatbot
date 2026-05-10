"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Source = {
  pageContent: string;
  metadata: Record<string, unknown>;
};

type IndexedDoc = {
  documentId: string;
  filename: string;
  indexedAt: string; // ISO string
  chunks: number;
};

const LS_KEY = "notebookllm:docs";

function loadDocsFromStorage(): IndexedDoc[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as IndexedDoc[]) : [];
  } catch {
    return [];
  }
}

function saveDocsToStorage(docs: IndexedDoc[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(docs));
  } catch {
    // storage full or unavailable — ignore silently
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const [docs, setDocs] = useState<IndexedDoc[]>([]);
  const [activeDoc, setActiveDoc] = useState<IndexedDoc | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  // Load persisted docs on mount
  useEffect(() => {
    const stored = loadDocsFromStorage();
    setDocs(stored);
    if (stored.length > 0) setActiveDoc(stored[0]!);
  }, []);

  function selectDoc(doc: IndexedDoc) {
    setActiveDoc(doc);
    setMessages([]);
    setSources([]);
  }

  function removeDoc(docId: string) {
    const next = docs.filter((d) => d.documentId !== docId);
    setDocs(next);
    saveDocsToStorage(next);
    if (activeDoc?.documentId === docId) {
      setActiveDoc(next[0] ?? null);
      setMessages([]);
      setSources([]);
    }
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const newDoc: IndexedDoc = {
        documentId: data.documentId as string,
        filename: data.filename as string,
        chunks: data.chunks as number,
        indexedAt: new Date().toISOString(),
      };

      const next = [newDoc, ...docs];
      setDocs(next);
      saveDocsToStorage(next);
      setActiveDoc(newDoc);
      setMessages([]);
      setSources([]);

      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleChat(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeDoc || !input.trim() || thinking) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setThinking(true);
    setSources([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: activeDoc.documentId,
          message: userMessage,
        }),
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
            Add a document (PDF or CSV only)
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
        </form>

        {/* Previously indexed docs */}
        {docs.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest px-1">
              Indexed documents
            </p>
            <ul className="flex flex-col gap-1">
              {docs.map((doc) => {
                const isActive = activeDoc?.documentId === doc.documentId;
                return (
                  <li key={doc.documentId} className="flex items-center gap-2">
                    <button
                      onClick={() => selectDoc(doc)}
                      className={`flex-1 flex items-center justify-between rounded-xl px-4 py-3 text-sm text-left transition-colors border ${
                        isActive
                          ? "bg-indigo-600/20 border-indigo-500/50 text-white"
                          : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      <span className="font-medium truncate">{doc.filename}</span>
                      <span className="ml-4 shrink-0 text-xs text-zinc-500">
                        {doc.chunks} chunks · {formatDate(doc.indexedAt)}
                      </span>
                    </button>
                    <button
                      onClick={() => removeDoc(doc.documentId)}
                      aria-label="Remove"
                      className="rounded-lg p-2 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Chat */}
        {activeDoc && (
          <div className="flex flex-col gap-4">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 min-h-64 p-4 flex flex-col gap-3 overflow-y-auto max-h-112">
              {messages.length === 0 && (
                <p className="text-zinc-500 text-sm text-center mt-auto">
                  Ask anything about{" "}
                  <span className="text-zinc-300">{activeDoc.filename}</span>
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
                        {typeof s.metadata?.loc === "object" &&
                        s.metadata.loc !== null
                          ? `page ${String(
                              (s.metadata.loc as Record<string, unknown>)
                                .pageNumber ?? "?",
                            )}`
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
                placeholder={`Ask about ${activeDoc.filename}…`}
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
