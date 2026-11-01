import type { ExtractedImport } from "@/types/analysis";

const CACHE_VERSION = 1;
const MAX_CACHE_ENTRIES = 5000;
const extractionCache = new Map<string, Omit<ExtractedImport, "importingFile">[]>();
const MAX_CACHED_CONTENT_BYTES = 16 * 1024 * 1024;
const fileContentCache = new Map<string, { content: string; bytes: number }>();
let cachedContentBytes = 0;

export function getCachedFileContent(blobSha: string): string | null {
  const cached = fileContentCache.get(blobSha);
  if (!cached) return null;
  fileContentCache.delete(blobSha);
  fileContentCache.set(blobSha, cached);
  return cached.content;
}

export function cacheFileContent(blobSha: string, content: string): void {
  if (!blobSha || content.length === 0) return;
  const bytes = new TextEncoder().encode(content).byteLength;
  if (bytes > MAX_CACHED_CONTENT_BYTES) return;
  const previous = fileContentCache.get(blobSha);
  if (previous) cachedContentBytes -= previous.bytes;
  fileContentCache.delete(blobSha);
  fileContentCache.set(blobSha, { content, bytes });
  cachedContentBytes += bytes;
  while (cachedContentBytes > MAX_CACHED_CONTENT_BYTES && fileContentCache.size > 0) {
    const oldestKey = fileContentCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const oldest = fileContentCache.get(oldestKey);
    if (oldest) cachedContentBytes -= oldest.bytes;
    fileContentCache.delete(oldestKey);
  }
}

export async function hashFileContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function extractImportsCached(
  filePath: string,
  content: string,
  extract: (path: string, source: string) => Promise<ExtractedImport[]>,
): Promise<{ imports: ExtractedImport[]; contentHash: string; cacheHit: boolean }> {
  const contentHash = await hashFileContent(content);
  const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  const key = `${CACHE_VERSION}:${extension}:${contentHash}`;
  const cached = extractionCache.get(key);
  if (cached) {
    extractionCache.delete(key);
    extractionCache.set(key, cached);
    return { imports: cached.map((item) => ({ ...item, importingFile: filePath })), contentHash, cacheHit: true };
  }

  const imports = await extract(filePath, content);
  const reusable = imports.map(({ importingFile: sourcePath, ...item }) => {
    void sourcePath;
    return item;
  });
  extractionCache.set(key, reusable);
  while (extractionCache.size > MAX_CACHE_ENTRIES) extractionCache.delete(extractionCache.keys().next().value!);
  return { imports, contentHash, cacheHit: false };
}

export function clearContentAnalysisCache(): void {
  extractionCache.clear();
  fileContentCache.clear();
  cachedContentBytes = 0;
}

export function getContentAnalysisCacheSize(): number {
  return extractionCache.size;
}
