import { existsSync, readFileSync } from "node:fs";

import type { AppConfig, AttachmentCatalogEntry, BibliographyRecord } from "./types.js";
import { formatAuthors, normalizePathForLookup, sha1, toSupportedFileType } from "./utils.js";

interface RawBibliographyAuthor {
  family?: string;
  given?: string;
  literal?: string;
}

interface RawBibliographyItem {
  id?: string;
  title?: string;
  author?: RawBibliographyAuthor[];
  editor?: RawBibliographyAuthor[];
  issued?: {
    "date-parts"?: unknown[];
  };
  abstract?: string;
  "container-title"?: string | string[];
  publisher?: string;
  type?: string;
  file?: string;
  "zotero-item-key"?: string;
}

export interface CatalogData {
  records: BibliographyRecord[];
  attachments: AttachmentCatalogEntry[];
}

const JOURNAL_TYPES = new Set(["article-journal", "article-magazine", "article-newspaper", "article"]);
const PUBLISHER_TYPES = new Set(["book", "chapter"]);

function readBibliography(path: string): RawBibliographyItem[] {
  if (!existsSync(path)) {
    throw new Error(`Bibliography JSON not found: ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (Array.isArray(parsed)) return parsed as RawBibliographyItem[];
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as RawBibliographyItem[];
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) return value as RawBibliographyItem[];
    }
  }
  return [];
}

function parsePeople(people?: RawBibliographyAuthor[]): { names: string[]; searchTexts: string[] } {
  if (!Array.isArray(people)) return { names: [], searchTexts: [] };

  const names: string[] = [];
  const searchTexts = new Set<string>();

  for (const person of people) {
    if (typeof person.literal === "string" && person.literal.trim()) {
      const literal = person.literal.trim();
      names.push(literal);
      searchTexts.add(literal);
      continue;
    }

    const family = (person.family || "").trim();
    const given = (person.given || "").trim();
    if (family && given) {
      const displayName = `${family} ${given}`;
      names.push(displayName);
      searchTexts.add(displayName);
      searchTexts.add(`${given} ${family}`);
      continue;
    }

    const fallback = family || given || "";
    if (fallback.length > 0) {
      names.push(fallback);
      searchTexts.add(fallback);
    }
  }

  return { names, searchTexts: [...searchTexts] };
}

function extractYear(issued?: { "date-parts"?: unknown[] }): string | undefined {
  const first = issued?.["date-parts"]?.[0];
  if (!Array.isArray(first) || first.length === 0) return undefined;
  const value = first[0];
  return typeof value === "number" || typeof value === "string" ? String(value) : undefined;
}

function splitFileField(file: string | undefined): string[] {
  const raw = (file || "").trim();
  if (!raw) return [];
  return raw
    .split(";")
    .map((part) => normalizePathForLookup(part))
    .filter((part) => part.length > 0);
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (!Array.isArray(value)) return undefined;
  for (const part of value) {
    if (typeof part !== "string") continue;
    const trimmed = part.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

export function loadCatalog(config: AppConfig): CatalogData {
  const rawItems = readBibliography(config.bibliographyJsonPath);
  const records: BibliographyRecord[] = [];
  const attachments: AttachmentCatalogEntry[] = [];
  const normalizedRoot = normalizePathForLookup(config.attachmentsRoot);

  for (const item of rawItems) {
    const itemKey = (item["zotero-item-key"] || "").trim();
    if (!itemKey) continue;

    const authors = parsePeople(item.author);
    const editors = authors.names.length > 0 ? { names: [], searchTexts: [] } : parsePeople(item.editor);
    const people = authors.names.length > 0 ? authors : editors;
    const title = (item.title || "").trim() || itemKey;
    const type = (item.type || "").trim() || undefined;
    const attachmentPaths = splitFileField(item.file).filter((filePath) =>
      filePath.startsWith(normalizedRoot),
    );
    const supportedPdfFiles = attachmentPaths.filter((filePath) => toSupportedFileType(filePath) === "pdf");
    const journal =
      type && JOURNAL_TYPES.has(type) ? firstString(item["container-title"]) : undefined;
    const publisher =
      type && PUBLISHER_TYPES.has(type) ? firstString(item.publisher) : undefined;

    records.push({
      itemKey,
      citationKey: (item.id || "").trim() || undefined,
      title,
      authors: people.names,
      authorSearchTexts: people.searchTexts,
      year: extractYear(item.issued),
      abstract: (item.abstract || "").trim() || undefined,
      ...(journal ? { journal } : {}),
      ...(publisher ? { publisher } : {}),
      type,
      attachmentPaths,
      supportedPdfFiles,
      hasSupportedPdf: supportedPdfFiles.length > 0,
    });

    for (const filePath of attachmentPaths) {
      const fileExt = toSupportedFileType(filePath);
      attachments.push({
        docKey: sha1(filePath),
        itemKey,
        citationKey: (item.id || "").trim() || undefined,
        title,
        authors: people.names,
        year: extractYear(item.issued),
        abstract: (item.abstract || "").trim() || undefined,
        type,
        filePath,
        fileExt,
        exists: existsSync(filePath),
        supported: fileExt === "pdf",
      });
    }
  }

  attachments.sort((a, b) => a.filePath.localeCompare(b.filePath));
  records.sort((a, b) => a.itemKey.localeCompare(b.itemKey));
  return { records, attachments };
}

export function authorsToText(authors: string[]): string {
  return formatAuthors(authors);
}
