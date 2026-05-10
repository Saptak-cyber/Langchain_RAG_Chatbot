"use client";

import type { Source } from "./types";

type Props = {
  sources: Source[];
  open: boolean;
  onClose: () => void;
};

function locationLabel(metadata: Record<string, unknown>): string {
  if (typeof metadata.loc === "object" && metadata.loc !== null) {
    const page = (metadata.loc as Record<string, unknown>).pageNumber;
    if (page != null) return `Page ${String(page)}`;
  }
  if (metadata.line != null) return `Row ${String(metadata.line)}`;
  return "";
}

export default function SourceDrawer({ sources, open, onClose }: Props) {
  if (!open || sources.length === 0) return null;

  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-200">Sources</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{sources.length} chunks</span>
          <button
            onClick={onClose}
            aria-label="Close sources"
            className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <XIcon />
          </button>
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
        {sources.map((s, i) => (
          <li key={i} className="px-4 py-3 hover:bg-zinc-900/50 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                {i + 1}
              </span>
              <span className="text-[10px] text-zinc-500">
                {locationLabel(s.metadata)}
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-5">
              {s.pageContent}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function XIcon() {
  return (
    <svg
      className="h-4 w-4"
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
