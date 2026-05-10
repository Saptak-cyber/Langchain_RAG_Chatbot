"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";

type Props = {
  onUploaded: (doc: {
    documentId: string;
    filename: string;
    chunks: number;
  }) => void;
};

export default function UploadDropzone({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function ingest(file: File) {
    setError(null);
    setProgress(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "csv") {
      setError("Only PDF and CSV files are supported.");
      return;
    }
    setUploading(true);
    setProgress("Uploading…");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setProgress(null);
      onUploaded({
        documentId: data.documentId as string,
        filename: data.filename as string,
        chunks: data.chunks as number,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) ingest(file);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) ingest(file);
  }

  return (
    <div className="px-4 py-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer select-none
          ${dragging ? "border-indigo-400 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50"}
          ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.csv"
          className="hidden"
          onChange={onFileChange}
        />
        {uploading ? (
          <>
            <Spinner />
            <span className="text-xs text-zinc-400">{progress}</span>
          </>
        ) : (
          <>
            <UploadIcon />
            <span className="text-xs font-medium text-zinc-300">
              Drag & drop or click to upload
            </span>
            <span className="text-xs text-zinc-500">PDF or CSV</span>
          </>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-5 w-5 text-zinc-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-indigo-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
