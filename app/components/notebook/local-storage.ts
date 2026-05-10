import type { IndexedDoc, Message } from "./types";

const DOCS_KEY = "notebookllm:docs";
const MSG_KEY = (id: string) => `notebookllm:messages:${id}`;
const MAX_MESSAGES = 50;

export function loadDocs(): IndexedDoc[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    return raw ? (JSON.parse(raw) as IndexedDoc[]) : [];
  } catch {
    return [];
  }
}

export function saveDocs(docs: IndexedDoc[]): void {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
  } catch {
    // storage full — fail silently
  }
}

export function loadMessages(documentId: string): Message[] {
  try {
    const raw = localStorage.getItem(MSG_KEY(documentId));
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

export function saveMessages(documentId: string, messages: Message[]): void {
  try {
    const capped = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(MSG_KEY(documentId), JSON.stringify(capped));
  } catch {
    // storage full — fail silently
  }
}

export function clearMessages(documentId: string): void {
  try {
    localStorage.removeItem(MSG_KEY(documentId));
  } catch {
    // ignore
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
