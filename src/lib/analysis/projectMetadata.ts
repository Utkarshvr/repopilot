import type {
  PackageDependencyInfo,
  PackageManagerName,
  PackageManifestAnalysis,
  ProjectMetadataAnalysis,
  RepoTreeEntry,
  TsconfigPathsConfig,
  TypeScriptConfigAnalysis,
} from "@/types/analysis";
import { classifyRepositoryFile, getFileName, isConfigPath } from "./fileFilter";
import { isRecord, parseJsonc } from "./jsonc";

export interface MetadataContentResult { content?: string; error?: string }

const LOCKFILE_MANAGERS: Record<string, PackageManagerName> = {
  "package-lock.json": "npm", "pnpm-lock.yaml": "pnpm", "yarn.lock": "yarn",
  "bun.lock": "bun", "bun.lockb": "bun",
};

const stringField = (record: Record<string, unknown>, key: string): string | null =>
  typeof record[key] === "string" ? record[key] as string : null;

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string")) as Record<string, string>;
}

function dependencyList(value: unknown): PackageDependencyInfo[] {
  return Object.entries(stringMap(value)).map(([name, versionRange]) => ({ name, versionRange }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseManifest(path: string, content: string): PackageManifestAnalysis {
  const parsed: unknown = JSON.parse(content);
  if (!isRecord(parsed)) throw new SyntaxError("package.json must contain a JSON object.");
  const engines = isRecord(parsed.engines) ? parsed.engines : {};
  return {
    path,
    name: stringField(parsed, "name"),
    version: stringField(parsed, "version"),
    description: stringField(parsed, "description"),
    entryPoints: {
      main: stringField(parsed, "main"),
      module: stringField(parsed, "module"),
      browser: parsed.browser ?? null,
      exports: parsed.exports ?? null,
    },
    packageType: stringField(parsed, "type"),
    dependencies: dependencyList(parsed.dependencies),
    devDependencies: dependencyList(parsed.devDependencies),
    peerDependencies: dependencyList(parsed.peerDependencies),
    optionalDependencies: dependencyList(parsed.optionalDependencies),
    scripts: stringMap(parsed.scripts),
    nodeEngine: stringField(engines, "node"),
    declaredPackageManager: stringField(parsed, "packageManager"),
  };
}

function pathArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function pathsMap(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, targets]) =>
    Array.isArray(targets) && targets.every((item) => typeof item === "string"),
  )) as Record<string, string[]>;
}

function configDirectory(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  return slash < 0 ? "." : normalized.slice(0, slash) || ".";
}

function resolveConfigBase(configPath: string, baseUrl: string | null): string {
  const parts = `${configDirectory(configPath)}/${baseUrl ?? "."}`.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") result.pop(); else result.push(part);
  }
  return result.join("/") || ".";
}

function parseTsConfig(path: string, content: string): { analysis: TypeScriptConfigAnalysis; resolver: TsconfigPathsConfig } {
  const parsed = parseJsonc(content);
  if (!isRecord(parsed)) throw new SyntaxError("Configuration must contain a JSON object.");
  const options = isRecord(parsed.compilerOptions) ? parsed.compilerOptions : {};
  const paths = pathsMap(options.paths);
  const baseUrl = stringField(options, "baseUrl");
  const extendsValue = typeof parsed.extends === "string" ||
    (Array.isArray(parsed.extends) && parsed.extends.every((item) => typeof item === "string"))
    ? parsed.extends as string | string[]
    : null;
  const optString = (key: string) => stringField(options, key);
  const optBoolean = (key: string) => typeof options[key] === "boolean" ? options[key] as boolean : null;
  return {
    analysis: {
      path, extends: extendsValue, baseUrl, paths,
      target: optString("target"), module: optString("module"),
      moduleResolution: optString("moduleResolution"), jsx: optString("jsx"),
      strict: optBoolean("strict"), allowJs: optBoolean("allowJs"),
      resolveJsonModule: optBoolean("resolveJsonModule"),
      include: pathArray(parsed.include), exclude: pathArray(parsed.exclude),
    },
    resolver: { baseUrl: resolveConfigBase(path, baseUrl), paths },
  };
}

/** Analyze recognized manifests/configuration; lockfiles are identified by filename only. */
export function analyzeProjectMetadata(
  entries: RepoTreeEntry[],
  contents: Record<string, MetadataContentResult>,
  maxFileBytes: number,
): ProjectMetadataAnalysis {
  const fileClassifications = entries.map((entry) => ({ path: entry.path, classification: classifyRepositoryFile(entry.path) }));
  const metadataEntries = entries.filter((entry) => classifyRepositoryFile(entry.path) === "metadata");
  const outcomes: ProjectMetadataAnalysis["outcomes"] = [];
  const packageManifests: PackageManifestAnalysis[] = [];
  const tsConfigs: TypeScriptConfigAnalysis[] = [];
  let resolverConfig: TsconfigPathsConfig | null = null;

  const lockfiles = metadataEntries.filter((entry) => LOCKFILE_MANAGERS[getFileName(entry.path).toLowerCase()]);
  const detected = [...new Set(lockfiles.map((entry) => LOCKFILE_MANAGERS[getFileName(entry.path).toLowerCase()]))];
  for (const entry of lockfiles) outcomes.push({
    path: entry.path,
    status: "partially-inspected",
    detail: `Detected ${LOCKFILE_MANAGERS[getFileName(entry.path).toLowerCase()]} from the lockfile name; lockfile contents were not parsed.`,
  });

  const parseEntries = metadataEntries.filter((entry) =>
    getFileName(entry.path).toLowerCase() === "package.json" || isConfigPath(entry.path));
  for (const entry of parseEntries) {
    const result = contents[entry.path];
    if (entry.size > maxFileBytes) {
      outcomes.push({ path: entry.path, status: "not-processed", detail: `Metadata file exceeds ${maxFileBytes.toLocaleString()} bytes and was not fetched.` });
      continue;
    }
    if (!result || typeof result.content !== "string") {
      outcomes.push({ path: entry.path, status: "failed", failureType: "fetch", detail: result?.error ?? "Metadata content was not fetched." });
      continue;
    }
    if (new TextEncoder().encode(result.content).byteLength > maxFileBytes) {
      outcomes.push({ path: entry.path, status: "not-processed", detail: `Fetched metadata content exceeds ${maxFileBytes.toLocaleString()} bytes; parsing was not attempted.` });
      continue;
    }
    try {
      if (getFileName(entry.path).toLowerCase() === "package.json") packageManifests.push(parseManifest(entry.path, result.content));
      else {
        const config = parseTsConfig(entry.path, result.content);
        tsConfigs.push(config.analysis);
        if (!resolverConfig || entry.path === "tsconfig.json" || entry.path === "jsconfig.json") resolverConfig = config.resolver;
      }
      outcomes.push({ path: entry.path, status: "fully-parsed" });
    } catch (error) {
      outcomes.push({ path: entry.path, status: "failed", failureType: "parse", detail: error instanceof Error ? error.message : "Metadata parser failed." });
    }
  }

  const outcomePaths = new Set(outcomes.map((outcome) => outcome.path));
  for (const entry of metadataEntries) {
    if (!outcomePaths.has(entry.path)) {
      outcomes.push({ path: entry.path, status: "not-processed", detail: "No metadata processor is configured for this recognized file." });
    }
  }

  packageManifests.sort((a, b) => a.path.localeCompare(b.path));
  tsConfigs.sort((a, b) => a.path.localeCompare(b.path));
  outcomes.sort((a, b) => a.path.localeCompare(b.path));
  const rootManifest = packageManifests.find((item) => item.path === "package.json") ?? packageManifests[0] ?? null;
  return {
    packageManifest: rootManifest,
    packageManifests,
    packageManager: { declared: rootManifest?.declaredPackageManager ?? null, detected, multipleLockfiles: lockfiles.length > 1 },
    tsConfigs,
    fileClassifications,
    outcomes,
    stats: {
      metadataFilesDiscovered: metadataEntries.length,
      metadataFilesFullyParsed: outcomes.filter((item) => item.status === "fully-parsed").length,
      metadataFilesPartiallyInspected: outcomes.filter((item) => item.status === "partially-inspected").length,
      metadataFilesFailed: outcomes.filter((item) => item.status === "failed").length,
      metadataFilesNotProcessed: outcomes.filter((item) => item.status === "not-processed").length,
      metadataFilesParsed: outcomes.filter((item) => item.status === "fully-parsed").length,
      metadataParsingFailures: outcomes.filter((item) => item.failureType === "parse").length,
      metadataFetchFailures: outcomes.filter((item) => item.failureType === "fetch").length,
      metadataFilesSkipped: outcomes.filter((item) => item.status === "not-processed").length,
    },
    resolverConfig,
  };
}
