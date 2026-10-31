import type {
  ExtractedImport,
  ResolvedImport,
  ResolutionStatus,
  TsconfigPathsConfig,
} from "@/types/analysis";
import { SOURCE_EXTENSIONS, getExtension } from "./fileFilter";
import { isRecord, parseJsonc } from "./jsonc";

const EXTENSION_CANDIDATES = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
  "/index.mjs",
  "/index.cjs",
];

function normalizePosix(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function dirname(path: string): string {
  const normalized = normalizePosix(path);
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? "" : normalized.slice(0, idx);
}

function joinPath(...parts: string[]): string {
  const stack: string[] = [];
  for (const part of parts) {
    for (const segment of part.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        stack.pop();
        continue;
      }
      stack.push(segment);
    }
  }
  return stack.join("/");
}

export function isExternalSpecifier(specifier: string): boolean {
  if (specifier.startsWith("node:")) return true;
  if (specifier.startsWith(".") || specifier.startsWith("/")) return false;
  // Absolute alias candidates are handled separately.
  if (specifier.startsWith("@/") || specifier.startsWith("~/")) return false;
  return true;
}

export function packageNameFromSpecifier(specifier: string): string {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split("/")[0] ?? specifier;
}

function tryResolveAgainstIndex(
  candidateBase: string,
  fileIndex: Set<string>,
): string | null {
  const normalized = normalizePosix(candidateBase);
  for (const suffix of EXTENSION_CANDIDATES) {
    const candidate = normalizePosix(`${normalized}${suffix}`);
    if (fileIndex.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve a relative import from an importing file against the repo file index.
 */
export function resolveRelativeImport(
  importingFile: string,
  specifier: string,
  fileIndex: Set<string>,
): string | null {
  const baseDir = dirname(importingFile);
  const absolute = specifier.startsWith("/")
    ? joinPath(specifier.slice(1))
    : joinPath(baseDir, specifier);
  return tryResolveAgainstIndex(absolute, fileIndex);
}

/**
 * Resolve path aliases from tsconfig/jsconfig `baseUrl` + `paths`.
 */
export function resolveAliasImport(
  specifier: string,
  fileIndex: Set<string>,
  config: TsconfigPathsConfig | null,
): string | null {
  if (!config) {
    return null;
  }

  const { baseUrl, paths } = config;

  for (const [pattern, targets] of Object.entries(paths)) {
    const star = pattern.indexOf("*");
    if (star === -1) {
      if (specifier === pattern) {
        for (const target of targets) {
          const mapped = baseUrl ? joinPath(baseUrl, target) : target;
          const resolved = tryResolveAgainstIndex(mapped, fileIndex);
          if (resolved) return resolved;
        }
      }
      continue;
    }

    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;

    const matched = specifier.slice(
      prefix.length,
      specifier.length - suffix.length,
    );

    for (const target of targets) {
      const replaced = target.replace("*", matched);
      const mapped = baseUrl ? joinPath(baseUrl, replaced) : replaced;
      const resolved = tryResolveAgainstIndex(mapped, fileIndex);
      if (resolved) return resolved;
    }
  }

  // Fall back to baseUrl-relative non-relative imports (TS classic behavior)
  if (baseUrl && !specifier.startsWith(".")) {
    const mapped = joinPath(baseUrl, specifier);
    const resolved = tryResolveAgainstIndex(mapped, fileIndex);
    if (resolved) return resolved;
  }

  return null;
}

export function resolveImport(
  extracted: ExtractedImport,
  fileIndex: Set<string>,
  config: TsconfigPathsConfig | null,
): ResolvedImport {
  const { specifier } = extracted;

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const resolvedPath = resolveRelativeImport(
      extracted.importingFile,
      specifier,
      fileIndex,
    );
    return {
      ...extracted,
      status: resolvedPath ? "resolved" : "unresolved",
      resolvedPath,
      packageName: null,
    };
  }

  // Path aliases / absolute-style project imports
  const aliased = resolveAliasImport(specifier, fileIndex, config);
  if (aliased) {
    return {
      ...extracted,
      status: "resolved",
      resolvedPath: aliased,
      packageName: null,
    };
  }

  if (isExternalSpecifier(specifier)) {
    return {
      ...extracted,
      status: "external",
      resolvedPath: null,
      packageName: packageNameFromSpecifier(specifier),
    };
  }

  return {
    ...extracted,
    status: "unresolved" satisfies ResolutionStatus,
    resolvedPath: null,
    packageName: null,
  };
}

export function resolveAllImports(
  imports: ExtractedImport[],
  filePaths: string[],
  config: TsconfigPathsConfig | null,
): ResolvedImport[] {
  const fileIndex = new Set(filePaths.map(normalizePosix));
  return imports.map((item) => resolveImport(item, fileIndex, config));
}

/**
 * Parse tsconfig/jsconfig JSON (strip comments) into path config.
 */
export function parseTsconfigPaths(
  jsonText: string,
  configFilePath: string,
): TsconfigPathsConfig {
  let options: Record<string, unknown> = {};
  try {
    const parsed = parseJsonc(jsonText);
    if (isRecord(parsed) && isRecord(parsed.compilerOptions)) options = parsed.compilerOptions;
  } catch {
    return { baseUrl: null, paths: {} };
  }

  const configDir = dirname(configFilePath);
  const baseUrlOption = typeof options.baseUrl === "string" ? options.baseUrl : null;
  const resolvedBaseUrl = baseUrlOption
    ? normalizePosix(joinPath(configDir, baseUrlOption))
    : configDir || null;
  const baseUrl = resolvedBaseUrl === "" ? "." : resolvedBaseUrl;

  const rawPaths = isRecord(options.paths) ? options.paths : {};
  const paths: Record<string, string[]> = {};
  for (const [pattern, targets] of Object.entries(rawPaths)) {
    if (Array.isArray(targets) && targets.every((target) => typeof target === "string")) {
      paths[pattern] = targets;
    }
  }

  return {
    baseUrl,
    paths,
  };
}

export function buildFileIndex(paths: string[]): Set<string> {
  return new Set(paths.map(normalizePosix));
}

export function looksLikeSourceModule(path: string): boolean {
  const ext = getExtension(path);
  return SOURCE_EXTENSIONS.has(ext);
}

export { normalizePosix, joinPath, dirname };
