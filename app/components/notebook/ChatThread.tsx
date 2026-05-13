"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "./types";

type Props = {
  messages: Message[];
  thinking: boolean;
  thinkingStep?: string;
  streamingContent?: string;
  filename: string;
  onChipClick: (text: string) => void;
};

const STARTER_CHIPS = [
  "Summarize the main themes",
  "What are the key definitions?",
  "List the most important facts",
  "What conclusions does this draw?",
];

export default function ChatThread({
  messages,
  thinking,
  thinkingStep,
  streamingContent,
  filename,
  onChipClick,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, streamingContent]);

  const isActive = thinking || !!streamingContent;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
      {messages.length === 0 && !isActive ? (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
          <div className="flex flex-col gap-1.5">
            <p className="text-lg font-semibold text-zinc-200">
              {filename}
            </p>
            <p className="text-sm text-zinc-500">
              Ask anything grounded in this document.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-w-md">
            {STARTER_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => onChipClick(chip)}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-indigo-500/50 hover:text-white transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages.map((m, i) => (
            <ChatBubble key={i} message={m} />
          ))}

          {/* Thinking indicator: shown while waiting before first token */}
          {thinking && !streamingContent && (
            <ThinkingBubble step={thinkingStep} />
          )}

          {/* Streaming bubble: shown as tokens arrive */}
          {streamingContent && (
            <StreamingBubble content={streamingContent} />
          )}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="shrink-0 mt-0.5 mr-2.5 w-6 h-6 rounded-full bg-indigo-600/30 flex items-center justify-center">
          <span className="text-indigo-400 text-[10px] font-bold">AI</span>
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "rounded-br-sm bg-indigo-600 text-white"
            : "rounded-bl-sm bg-zinc-800/80 text-zinc-100"
          }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1.5 prose-li:my-0.5 prose-headings:text-zinc-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble({ step }: { step?: string }) {
  return (
    <div className="flex justify-start">
      <div className="shrink-0 mt-0.5 mr-2.5 w-6 h-6 rounded-full bg-indigo-600/30 flex items-center justify-center">
        <span className="text-indigo-400 text-[10px] font-bold">AI</span>
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-zinc-800/80 px-4 py-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" />
        {step && (
          <span className="ml-1.5 text-xs text-zinc-500 italic">{step}</span>
        )}
      </div>
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start">
      <div className="shrink-0 mt-0.5 mr-2.5 w-6 h-6 rounded-full bg-indigo-600/30 flex items-center justify-center">
        <span className="text-indigo-400 text-[10px] font-bold">AI</span>
      </div>
      <div className="max-w-[82%] rounded-2xl rounded-bl-sm bg-zinc-800/80 px-4 py-3 text-sm leading-relaxed text-zinc-100">
        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1.5 prose-li:my-0.5 prose-headings:text-zinc-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
      </div>
    </div>
  );
}
