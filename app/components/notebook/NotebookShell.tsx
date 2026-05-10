"use client";

import { useState, useEffect, FormEvent } from "react";
import Sidebar from "./Sidebar";
import ChatThread from "./ChatThread";
import Composer from "./Composer";
import SourceDrawer from "./SourceDrawer";
import {
  loadDocs,
  saveDocs,
  loadMessages,
  saveMessages,
  clearMessages,
} from "./local-storage";
import type { IndexedDoc, Message, Source } from "./types";

export default function NotebookShell() {
  const [docs, setDocs] = useState<IndexedDoc[]>([]);
  const [activeDoc, setActiveDoc] = useState<IndexedDoc | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadDocs();
    setDocs(stored);
    if (stored.length > 0) {
      const first = stored[0]!;
      setActiveDoc(first);
      setMessages(loadMessages(first.documentId));
    }
  }, []);

  function selectDoc(doc: IndexedDoc) {
    setActiveDoc(doc);
    setMessages(loadMessages(doc.documentId));
    setSources([]);
    setSourcesOpen(false);
  }

  function removeDoc(documentId: string) {
    const next = docs.filter((d) => d.documentId !== documentId);
    setDocs(next);
    saveDocs(next);
    clearMessages(documentId);
    if (activeDoc?.documentId === documentId) {
      const fallback = next[0] ?? null;
      setActiveDoc(fallback);
      setMessages(fallback ? loadMessages(fallback.documentId) : []);
      setSources([]);
      setSourcesOpen(false);
    }
  }

  function handleUploaded(data: {
    documentId: string;
    filename: string;
    chunks: number;
  }) {
    const newDoc: IndexedDoc = {
      ...data,
      indexedAt: new Date().toISOString(),
    };
    const next = [newDoc, ...docs];
    setDocs(next);
    saveDocs(next);
    setActiveDoc(newDoc);
    setMessages([]);
    setSources([]);
    setSourcesOpen(false);
    setSidebarOpen(false);
  }

  async function handleChat(e: FormEvent) {
    e.preventDefault();
    if (!activeDoc || !input.trim() || thinking) return;

    const userMessage = input.trim();
    setInput("");
    const next: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(next);
    setThinking(true);
    setSources([]);
    setSourcesOpen(false);

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

      const withReply: Message[] = [
        ...next,
        { role: "assistant", content: data.answer },
      ];
      setMessages(withReply);
      saveMessages(activeDoc.documentId, withReply);

      if ((data.sources as Source[])?.length > 0) {
        setSources(data.sources as Source[]);
        setSourcesOpen(true);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const withError: Message[] = [
        ...next,
        { role: "assistant", content: `Error: ${errMsg}` },
      ];
      setMessages(withError);
      saveMessages(activeDoc.documentId, withError);
    } finally {
      setThinking(false);
    }
  }

  function handleClear() {
    if (!activeDoc) return;
    clearMessages(activeDoc.documentId);
    setMessages([]);
    setSources([]);
    setSourcesOpen(false);
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <Sidebar
        docs={docs}
        activeDoc={activeDoc}
        open={sidebarOpen}
        onSelect={selectDoc}
        onRemove={removeDoc}
        onClose={() => setSidebarOpen(false)}
        onUploaded={handleUploaded}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-4 border-b border-zinc-800 bg-zinc-950 shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden rounded-lg p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <MenuIcon />
            </button>
            <span className="text-sm font-medium text-zinc-300 truncate">
              {activeDoc ? activeDoc.filename : "No document selected"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sources toggle */}
            {sources.length > 0 && (
              <button
                onClick={() => setSourcesOpen((v) => !v)}
                className={`hidden lg:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                  ${sourcesOpen
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                    : "text-zinc-400 border border-zinc-700 hover:bg-zinc-800"
                  }`}
              >
                <CitationIcon />
                Sources
              </button>
            )}
            {/* Clear */}
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 border border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Clear chat
              </button>
            )}
          </div>
        </header>

        {/* Chat + sources */}
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0">
            {activeDoc ? (
              <>
                <ChatThread
                  messages={messages}
                  thinking={thinking}
                  filename={activeDoc.filename}
                  onChipClick={(text) => {
                    setInput(text);
                  }}
                />
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={handleChat}
                  disabled={thinking || !activeDoc}
                  placeholder={`Ask about ${activeDoc.filename}…`}
                />
              </>
            ) : (
              <EmptyState />
            )}
          </div>

          <SourceDrawer
            sources={sources}
            open={sourcesOpen}
            onClose={() => setSourcesOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
        <svg
          className="h-6 w-6 text-indigo-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-300">No document selected</p>
        <p className="text-xs text-zinc-500 mt-1">
          Upload a PDF or CSV in the sidebar to get started.
        </p>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CitationIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
