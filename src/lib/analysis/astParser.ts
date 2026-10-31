import type { ExtractedImport } from "@/types/analysis";

/** Load the TypeScript compiler only when a repository is actually analyzed. */
export async function extractImportsFromSource(
  filePath: string,
  content: string,
): Promise<ExtractedImport[]> {
  const parser = await import("./astParserRuntime");
  return parser.extractImportsFromSource(filePath, content);
}
