"use client";

import { FormEvent, KeyboardEvent } from "react";

type Props = {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled: boolean;
  placeholder: string;
};

export default function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: Props) {
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit(e as unknown as FormEvent);
      }
    }
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3 shrink-0">
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-40 overflow-auto leading-relaxed"
          style={{ height: "auto" }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className="shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed p-2.5 transition-colors"
        >
          <SendIcon />
        </button>
      </form>
      <p className="mt-1.5 text-center text-[10px] text-zinc-700">
        Answers are grounded in the uploaded document only · Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      className="h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  );
}
