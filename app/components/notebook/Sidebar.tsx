"use client";

import type { IndexedDoc } from "./types";
import { formatDate } from "./local-storage";
import UploadDropzone from "./UploadDropzone";

type Props = {
  docs: IndexedDoc[];
  activeDoc: IndexedDoc | null;
  open: boolean;
  onSelect: (doc: IndexedDoc) => void;
  onRemove: (documentId: string) => void;
  onClose: () => void;
  onUploaded: (doc: {
    documentId: string;
    filename: string;
    chunks: number;
  }) => void;
};

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    return (
      <span className="shrink-0 flex items-center justify-center rounded-md w-7 h-7 bg-red-900/40 text-red-400 text-xs font-bold">
        PDF
      </span>
    );
  }
  return (
    <span className="shrink-0 flex items-center justify-center rounded-md w-7 h-7 bg-emerald-900/40 text-emerald-400 text-xs font-bold">
      CSV
    </span>
  );
}

export default function Sidebar({
  docs,
  activeDoc,
  open,
  onSelect,
  onRemove,
  onClose,
  onUploaded,
}: Props) {
  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex flex-col w-72 bg-zinc-950 border-r border-zinc-800
          transform transition-transform duration-200
          md:static md:transform-none md:flex md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <NoteIcon />
            <span className="font-semibold text-sm text-white tracking-tight">
              NotebookLLM
            </span>
          </div>
          <button
            className="md:hidden rounded-lg p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <XIcon />
          </button>
        </div>

        {/* Upload */}
        <UploadDropzone onUploaded={onUploaded} />

        {/* Divider + label */}
        {docs.length > 0 && (
          <p className="px-4 pb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Sources
          </p>
        )}

        {/* Doc list */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {docs.length === 0 ? (
            <p className="px-2 pt-2 text-xs text-zinc-600 text-center">
              Upload a document to get started.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {docs.map((doc) => {
                const isActive = activeDoc?.documentId === doc.documentId;
                return (
                  <li key={doc.documentId} className="group flex items-center gap-1">
                    <button
                      onClick={() => onSelect(doc)}
                      className={`flex-1 flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors min-w-0
                        ${isActive
                          ? "bg-indigo-600/20 text-white"
                          : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                        }`}
                    >
                      {fileIcon(doc.filename)}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate leading-snug">
                          {doc.filename}
                        </p>
                        <p className="text-[10px] text-zinc-600 leading-snug">
                          {doc.chunks} chunks · {formatDate(doc.indexedAt)}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => onRemove(doc.documentId)}
                      aria-label="Remove source"
                      className="shrink-0 rounded p-1 text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>
    </>
  );
}

function NoteIcon() {
  return (
    <svg
      className="h-5 w-5 text-indigo-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
    </svg>
  );
}

function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
