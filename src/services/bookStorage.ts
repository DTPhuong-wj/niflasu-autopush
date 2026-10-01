import type { Vocabulary } from "../types/vocabulary";

export const CUSTOM_BOOKS_STORAGE_KEY = "niflasu-custom-vocabulary-books-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isGkiBook(value: unknown): value is Vocabulary[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  if (!value.every(isRecord)) return false;

  const first = value[0];
  if (!first) return false;
  const source = first["source"];
  return (
    typeof source === "string" &&
    source.trim().length > 0 &&
    value.every((item) => {
      const example = item["example"];
      return (
        item["source"] === source &&
        typeof item["id"] === "number" &&
        typeof item["unit"] === "number" &&
        typeof item["number"] === "number" &&
        typeof item["word"] === "string" &&
        typeof item["reading"] === "string" &&
        typeof item["meaning"] === "string" &&
        typeof item["type"] === "string" &&
        isRecord(example) &&
        typeof example["sentence"] === "string" &&
        typeof example["reading"] === "string" &&
        typeof example["meaning"] === "string"
      );
    })
  );
}

export function loadCustomBooks(): Vocabulary[][] {
  try {
    const stored = localStorage.getItem(CUSTOM_BOOKS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isGkiBook) : [];
  } catch {
    return [];
  }
}

export function saveCustomBooks(books: Vocabulary[][]) {
  localStorage.setItem(CUSTOM_BOOKS_STORAGE_KEY, JSON.stringify(books));
}
