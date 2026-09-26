// lib/assistant/orgKnowledge.ts
// Global organizational document RAG (first corpus: UAST notes PDFs).

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import "pdf-parse/worker";
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

import {
  cosineSimilarity,
  createEmbedding,
  createEmbeddings,
} from "@/lib/assistant/embeddings";
import { isFeatureEnabled } from "@/lib/config/feature-flags";

/* =====================================================
   Types
===================================================== */

export type OrgKnowledgeChunk = {
  id: string;
  documentId: string;
  documentTitle: string;
  sourceFile: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
};

export type OrgKnowledgeIndex = {
  version: 1;
  builtAt: string;
  model: string;
  dimensions: number;
  documents: Array<{
    id: string;
    title: string;
    sourceFile: string;
    characterCount: number;
    chunkCount: number;
  }>;
  chunks: OrgKnowledgeChunk[];
};

export type OrgKnowledgeMatch = {
  id: string;
  documentId: string;
  documentTitle: string;
  sourceFile: string;
  chunkIndex: number;
  text: string;
  similarity: number;
};

export type OrgKnowledgeRetrieval = {
  enabled: boolean;
  relevant: boolean;
  matches: OrgKnowledgeMatch[];
  context: string;
  bestSimilarity: number;
  threshold: number;
};

/* =====================================================
   Constants
===================================================== */

const INDEX_DIR = path.join(process.cwd(), "data", "org-knowledge");
const INDEX_PATH = path.join(INDEX_DIR, "index.json");

const DEFAULT_SOURCE_DIR =
  process.env.ORG_KNOWLEDGE_PDF_DIR?.trim() ||
  "D:\\سازمان\\فایل های پشتیبانی دستیار";

const DEFAULT_DOCUMENTS = [
  {
    id: "note-kardani-1405-v1",
    title: "نوت کاردانی جامع ۱۴۰۵",
    fileName: "NOTEKardanijame1405_v1.pdf",
  },
  {
    id: "note-karshenasi-1405-v1",
    title: "نوت کارشناسی جامع ۱۴۰۵",
    fileName: "NOTEKarshenasijame1405_v1.pdf",
  },
] as const;

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH_SIZE = 16;
const DEFAULT_MATCH_COUNT = 6;
const DEFAULT_THRESHOLD = 0.32;
const MAX_CONTEXT_CHARS = 9000;

let cachedIndex: OrgKnowledgeIndex | null = null;
let cacheLoadedAt = 0;

/* =====================================================
   Paths / IO
===================================================== */

export function getOrgKnowledgeIndexPath() {
  return INDEX_PATH;
}

export function getOrgKnowledgeSourceDir() {
  return DEFAULT_SOURCE_DIR;
}

function documentTitleFromFileName(fileName: string) {
  const known = DEFAULT_DOCUMENTS.find((item) => item.fileName === fileName);
  return known?.title ?? fileName.replace(/\.pdf$/i, "");
}

function documentIdFromFileName(fileName: string) {
  const known = DEFAULT_DOCUMENTS.find((item) => item.fileName === fileName);
  if (known) {
    return known.id;
  }
  return createHash("sha1").update(fileName).digest("hex").slice(0, 16);
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/* =====================================================
   Text extraction + chunking
===================================================== */

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractPdfTextFromFile(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({
    data: buffer,
    CanvasFactory,
  });

  try {
    const result = await parser.getText();
    return normalizeExtractedText(
      typeof result.text === "string" ? result.text : "",
    );
  } finally {
    await parser.destroy();
  }
}

export function chunkText(text: string): string[] {
  const clean = normalizeExtractedText(text);
  if (!clean) {
    return [];
  }

  if (clean.length <= CHUNK_SIZE) {
    return [clean];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);

    if (end < clean.length) {
      const window = clean.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("۔"),
        window.lastIndexOf("؟"),
      );

      if (breakAt > CHUNK_SIZE * 0.45) {
        end = start + breakAt + 1;
      }
    }

    const piece = clean.slice(start, end).trim();
    if (piece) {
      chunks.push(piece);
    }

    if (end >= clean.length) {
      break;
    }

    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
}

/* =====================================================
   Index build / load
===================================================== */

export async function rebuildOrgKnowledgeIndex(options?: {
  sourceDir?: string;
  fileNames?: string[];
}): Promise<OrgKnowledgeIndex> {
  const sourceDir = options?.sourceDir || getOrgKnowledgeSourceDir();
  const fileNames =
    options?.fileNames ||
    DEFAULT_DOCUMENTS.map((item) => item.fileName);

  if (!(await pathExists(sourceDir))) {
    throw new Error(`Org knowledge source directory not found: ${sourceDir}`);
  }

  const documents: OrgKnowledgeIndex["documents"] = [];
  const chunks: OrgKnowledgeChunk[] = [];
  let model = "unknown";
  let dimensions = 1536;

  for (const fileName of fileNames) {
    const filePath = path.join(sourceDir, fileName);
    if (!(await pathExists(filePath))) {
      throw new Error(`Org knowledge PDF not found: ${filePath}`);
    }

    const documentId = documentIdFromFileName(fileName);
    const documentTitle = documentTitleFromFileName(fileName);
    const text = await extractPdfTextFromFile(filePath);

    if (!text) {
      throw new Error(`No extractable text in PDF: ${fileName}`);
    }

    const textChunks = chunkText(text);
    const documentChunkStart = chunks.length;

    for (let i = 0; i < textChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = textChunks.slice(i, i + EMBED_BATCH_SIZE);
      const embeddings = await createEmbeddings(batch, {
        inputType: "search_document",
      });

      model = embeddings[0]?.model || model;
      dimensions = embeddings[0]?.dimensions || dimensions;

      embeddings.forEach((item, batchIndex) => {
        const chunkIndex = i + batchIndex;
        chunks.push({
          id: `${documentId}:${chunkIndex}`,
          documentId,
          documentTitle,
          sourceFile: fileName,
          chunkIndex,
          text: batch[batchIndex],
          embedding: item.embedding,
        });
      });
    }

    documents.push({
      id: documentId,
      title: documentTitle,
      sourceFile: fileName,
      characterCount: text.length,
      chunkCount: chunks.length - documentChunkStart,
    });
  }

  const index: OrgKnowledgeIndex = {
    version: 1,
    builtAt: new Date().toISOString(),
    model,
    dimensions,
    documents,
    chunks,
  };

  await fs.mkdir(INDEX_DIR, { recursive: true });
  await fs.writeFile(INDEX_PATH, JSON.stringify(index), "utf8");

  cachedIndex = index;
  cacheLoadedAt = Date.now();

  return index;
}

export async function loadOrgKnowledgeIndex(
  forceReload = false,
): Promise<OrgKnowledgeIndex | null> {
  if (
    !forceReload &&
    cachedIndex &&
    Date.now() - cacheLoadedAt < 60_000
  ) {
    return cachedIndex;
  }

  if (!(await pathExists(INDEX_PATH))) {
    cachedIndex = null;
    return null;
  }

  const raw = await fs.readFile(INDEX_PATH, "utf8");
  const parsed = JSON.parse(raw) as OrgKnowledgeIndex;

  if (
    !parsed ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.chunks) ||
    parsed.chunks.length === 0
  ) {
    return null;
  }

  cachedIndex = parsed;
  cacheLoadedAt = Date.now();
  return parsed;
}

/* =====================================================
   Retrieval + prompt block
===================================================== */

export function formatOrgKnowledgeContext(
  matches: OrgKnowledgeMatch[],
): string {
  if (matches.length === 0) {
    return "";
  }

  const parts: string[] = [];
  let used = 0;

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const block = [
      `[منبع ${i + 1}]`,
      `سند: ${match.documentTitle}`,
      `فایل: ${match.sourceFile}`,
      "متن بازیابی‌شده (این متن را در بخش «متن دقیق منبع» عیناً نقل کن):",
      '"""',
      match.text,
      '"""',
    ].join("\n");

    if (used + block.length > MAX_CONTEXT_CHARS) {
      break;
    }

    parts.push(block);
    used += block.length;
  }

  if (parts.length === 0) {
    return "";
  }

  return `
دانش سازمانی بازیابی‌شده از دو دفترچه راهنما (نوت کاردانی و نوت کارشناسی):

${parts.join("\n\n---\n\n")}

اگر پاسخ را بر اساس این دفترچه‌ها می‌دهی، خروجی را دقیقاً در دو بخش جدا بنویس و آن‌ها را با هم قاطی نکن:

## متن دقیق منبع
- فقط جمله‌ها و عبارت‌هایی را بیاور که واقعاً در بلوک «متن بازیابی‌شده» بالا هستند.
- آن متن را عیناً، بدون بازنویسی، بدون خلاصه‌سازی و بدون اصلاح نگارشی، داخل نقل‌قول بیاور.
- قبل از هر نقل، نام سند و شماره منبع را بنویس (مثلاً «منبع ۱ — نوت کاردانی جامع ۱۴۰۵»).
- اگر متن استخراج‌شده از PDF به‌هم‌ریخته است، همان را عیناً نقل کن و آن را تمیزشده وانمود نکن.
- هیچ جمله‌ای را که در متن بازیابی‌شده نیست به این بخش اضافه نکن.

## استنباط از همین متن
- فقط نتیجه‌ای را بنویس که مستقیماً از نقل‌قول همان بخش قبل به دست می‌آید.
- این بخش تحلیل توست، نه متن دفترچه. آن را با برچسب «استنباط» مشخص کن.
- اگر دفترچه پاسخ را کامل نمی‌دهد، صریح بنویس کدام بخش استنباط است و کدام واقعیت در منبع نیست.
- اگر سؤال به این دفترچه‌ها مربوط نیست، این دانش را نادیده بگیر و مثل گفتگوی عادی پاسخ بده.

این قواعد فقط برای همین اسناد سازمانی است و بر قاعدهٔ بازگو نکردن حافظهٔ گفتگو اولویت دارد.
`.trim();
}

export async function retrieveOrgKnowledge(
  query: string,
  options?: {
    matchCount?: number;
    threshold?: number;
  },
): Promise<OrgKnowledgeRetrieval> {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const matchCount = options?.matchCount ?? DEFAULT_MATCH_COUNT;

  if (!isFeatureEnabled("documentRag")) {
    return {
      enabled: false,
      relevant: false,
      matches: [],
      context: "",
      bestSimilarity: 0,
      threshold,
    };
  }

  const index = await loadOrgKnowledgeIndex();
  if (!index) {
    return {
      enabled: true,
      relevant: false,
      matches: [],
      context: "",
      bestSimilarity: 0,
      threshold,
    };
  }

  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    return {
      enabled: true,
      relevant: false,
      matches: [],
      context: "",
      bestSimilarity: 0,
      threshold,
    };
  }

  const queryEmbedding = await createEmbedding(cleanedQuery, {
    inputType: "search_query",
  });

  const useLexicalBoost = queryEmbedding.source === "mock";
  const queryTerms = cleanedQuery
    .split(/\s+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);

  const scored = index.chunks
    .map((chunk) => {
      const vectorScore = cosineSimilarity(
        queryEmbedding.embedding,
        chunk.embedding,
      );

      let similarity = vectorScore;

      if (useLexicalBoost && queryTerms.length > 0) {
        const haystack = chunk.text.toLowerCase();
        let hits = 0;
        for (const term of queryTerms) {
          if (haystack.includes(term.toLowerCase())) {
            hits += 1;
          }
        }
        const lexicalScore = hits / queryTerms.length;
        similarity = Math.max(vectorScore, lexicalScore * 0.92);
      }

      return {
        id: chunk.id,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        sourceFile: chunk.sourceFile,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  const bestSimilarity = scored[0]?.similarity ?? 0;
  const effectiveThreshold = useLexicalBoost
    ? Math.min(threshold, 0.28)
    : threshold;

  const matches = scored
    .filter((item) => item.similarity >= effectiveThreshold)
    .slice(0, matchCount);

  const relevant = matches.length > 0;
  const context = relevant ? formatOrgKnowledgeContext(matches) : "";

  return {
    enabled: true,
    relevant,
    matches,
    context,
    bestSimilarity,
    threshold: effectiveThreshold,
  };
}

export async function retrieveOrgKnowledgeSafely(
  query: string,
): Promise<OrgKnowledgeRetrieval> {
  try {
    return await retrieveOrgKnowledge(query);
  } catch (error) {
    console.error("Org knowledge retrieval error:", error);
    return {
      enabled: isFeatureEnabled("documentRag"),
      relevant: false,
      matches: [],
      context: "",
      bestSimilarity: 0,
      threshold: DEFAULT_THRESHOLD,
    };
  }
}
