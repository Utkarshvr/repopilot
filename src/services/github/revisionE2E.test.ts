import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalyzedRepository, ParsedGitHubUrl, RepoTreeEntry } from "@/types/analysis";
import type { GitHubCompareResult } from "@/types/changes";
import { clearContentAnalysisCache } from "@/lib/analysis/contentAnalysisCache";

const { fetchRepositoryMetadata, fetchRepositoryTree, fetchRawFileContent } = vi.hoisted(() => ({
  fetchRepositoryMetadata: vi.fn(), fetchRepositoryTree: vi.fn(), fetchRawFileContent: vi.fn(),
}));
vi.mock("./githubApi", async () => {
  const actual = await vi.importActual<typeof import("./githubApi")>("./githubApi");
  return { ...actual, fetchRepositoryMetadata, fetchRepositoryTree, fetchRawFileContent };
});

import { createGitHubChangeSet } from "@/lib/changes";
import { analyzeChangeImpact } from "@/lib/impact";
import { buildRepositoryGraphSnapshot } from "./revisionSnapshotService";

const parsed: ParsedGitHubUrl = { owner: "fixture", repo: "history", url: "https://github.com/fixture/history" };
const metadata = { id: 42, name: "history", fullName: "fixture/history", description: null, defaultBranch: "main", language: "TypeScript", stars: 0, forks: 0, updatedAt: "", private: false, visibility: "public", htmlUrl: parsed.url };
let fixturePath: string | null = null;

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}
function write(cwd: string, path: string, content: string) {
  const fullPath = join(cwd, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}
function commit(cwd: string, message: string) {
  git(cwd, "add", "-A");
  git(cwd, "commit", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}
function tree(cwd: string, sha: string) {
  return git(cwd, "rev-parse", `${sha}^{tree}`);
}
function treeEntries(cwd: string, sha: string): RepoTreeEntry[] {
  return git(cwd, "ls-tree", "-r", sha).split("\n").filter(Boolean).map((line) => {
    const [modeType, path] = line.split("\t");
    const [, type, blobSha] = modeType.split(" ");
    const content = execFileSync("git", ["show", `${sha}:${path}`], { cwd, encoding: "utf8" });
    return { path, sha: blobSha, type: type as "blob", size: Buffer.byteLength(content) };
  });
}
function compare(cwd: string, base: string, head: string): GitHubCompareResult {
  const statuses = git(cwd, "diff", "--find-renames", "--name-status", base, head).split("\n").filter(Boolean);
  const files = statuses.map((line) => {
    const parts = line.split("\t");
    const status = parts[0][0];
    const filename = status === "R" || status === "C" ? parts[2] : parts[1];
    return { filename, ...(status === "R" || status === "C" ? { previous_filename: parts[1] } : {}), status: ({ A: "added", M: "modified", D: "removed", R: "renamed", C: "copied" } as Record<string, string>)[status] ?? status };
  });
  return { baseSha: base, headSha: head, baseTreeSha: tree(cwd, base), headTreeSha: tree(cwd, head), totalCommits: 1, files, isComplete: true, completenessWarning: null };
}

afterEach(() => {
  vi.clearAllMocks();
  clearContentAnalysisCache();
  if (fixturePath) rmSync(fixturePath, { recursive: true, force: true });
  fixturePath = null;
});

describe("revision analysis against a synthetic Git history", () => {
  it("validates logger impact, relationship changes, additions, renames, attribution, and isolated edits end to end", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "repopilot-history-"));
    fixturePath = cwd;
    git(cwd, "init", "-q");
    git(cwd, "config", "user.email", "fixture@example.test");
    git(cwd, "config", "user.name", "RepoPilot Fixture");
    const files: Record<string, string> = {
      "package.json": '{"name":"history","version":"1.0.0"}',
      "tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
      "src/index.ts": 'import "./app";\n',
      "src/app.ts": 'import "./auth/authController";\nimport "./users/userController";\n',
      "src/auth/authController.ts": 'import "./authService";\n',
      "src/auth/authService.ts": 'import "../utils/logger";\nexport const authenticate = () => log("auth");\n',
      "src/users/userController.ts": 'import "./userService";\n',
      "src/users/userService.ts": 'import "../utils/logger";\nexport const users = () => log("users");\n',
      "src/utils/logger.ts": 'export const log = (message: string) => console.info(message);\n',
      "src/isolated.ts": "export const isolated = true;\n",
    };
    for (const [path, content] of Object.entries(files)) write(cwd, path, content);
    const initial = commit(cwd, "initial project");

    const contentBySha = new Map<string, Map<string, string>>();
    fetchRepositoryMetadata.mockResolvedValue(metadata);
    fetchRepositoryTree.mockImplementation(async (_owner: string, _repo: string, ref: string) => {
      const entries = treeEntries(cwd, ref);
      contentBySha.set(ref, new Map(entries.map((entry) => [entry.path, execFileSync("git", ["show", `${ref}:${entry.path}`], { cwd, encoding: "utf8" })])));
      return { entries, truncated: false, treeSha: tree(cwd, ref) };
    });
    fetchRawFileContent.mockImplementation(async (_owner: string, _repo: string, ref: string, path: string) => contentBySha.get(ref)?.get(path) ?? null);

    const getSnapshot = (sha: string) => buildRepositoryGraphSnapshot(parsed, sha, sha.slice(0, 8));
    const getAnalyzed = async (sha: string): Promise<AnalyzedRepository> => {
      const snapshot = await getSnapshot(sha);
      return { id: snapshot.repositoryId, metadata, repository: { id: snapshot.repositoryId, name: "history", fullName: "fixture/history", description: "", language: "TypeScript", fileCount: snapshot.graph.files.length, dependencyCount: snapshot.graph.edges.length, stars: 0, updatedAt: "", status: "indexed", branch: snapshot.ref, provenance: "analyzed" }, graph: snapshot.graph, unresolvedImports: snapshot.unresolvedImports, externalPackages: snapshot.externalPackages, fileOutcomes: snapshot.fileOutcomes, projectMetadata: snapshot.projectMetadata ?? undefined, stats: snapshot.stats, analyzedAt: snapshot.analyzedAt, branch: snapshot.ref };
    };
    const impact = async (base: string, head: string) => {
      const [baseSnapshot, headSnapshot, analyzed] = await Promise.all([getSnapshot(base), getSnapshot(head), getAnalyzed(head)]);
      const changes = createGitHubChangeSet(analyzed, base.slice(0, 8), head.slice(0, 8), compare(cwd, base, head), `fixture-${head}`);
      const selected = { ...changes, files: changes.files.map((file) => ({ ...file, selectedForImpact: file.analysisEligible })) };
      const report = analyzeChangeImpact({ changeSet: selected, baseGraph: { graph: baseSnapshot.graph, role: "base", complete: baseSnapshot.complete, limitations: baseSnapshot.limitations }, headGraph: { graph: headSnapshot.graph, role: "head", complete: headSnapshot.complete, limitations: headSnapshot.limitations }, unresolvedImports: [...baseSnapshot.unresolvedImports, ...headSnapshot.unresolvedImports] });
      expect(report.summary.graphRevisionVerified).toBe(true);
      return { baseSnapshot, headSnapshot, changes: selected, report };
    };

    // A: editing the logger preserves the graph but must discover two direct and four transitive dependents.
    git(cwd, "checkout", "-q", "-b", "scenario-a", initial);
    write(cwd, "src/utils/logger.ts", 'export const log = (message: string) => console.warn(`[repo] ${message}`);\n');
    const a = commit(cwd, "change logger implementation");
    const aResult = await impact(initial, a);
    expect(aResult.report.summary).toMatchObject({ directlyAffectedFilesCount: 2, transitivelyAffectedFilesCount: 4, totalUniqueAffectedFiles: 6, analysisComplete: true });
    expect(aResult.report.affectedFiles.some((file) => file.path === "src/isolated.ts")).toBe(false);

    // B: removing an import is analyzed using the base graph's relationship.
    git(cwd, "checkout", "-q", "-b", "scenario-b", initial);
    write(cwd, "src/auth/authService.ts", 'export const authenticate = () => true;\n');
    const b = commit(cwd, "remove logger dependency");
    const bResult = await impact(initial, b);
    expect(bResult.baseSnapshot.graph.edges.some((edge) => edge.source === "src/auth/authService.ts" && edge.target === "src/utils/logger.ts")).toBe(true);
    expect(bResult.headSnapshot.graph.edges.some((edge) => edge.source === "src/auth/authService.ts" && edge.target === "src/utils/logger.ts")).toBe(false);
    expect(bResult.report.perChange[0].directDependents).toContain("src/auth/authController.ts");

    // C: a new source file and new import exist only in the head graph.
    git(cwd, "checkout", "-q", "-b", "scenario-c", initial);
    write(cwd, "src/cache.ts", "export const cache = new Map();\n");
    write(cwd, "src/auth/authService.ts", 'import { cache } from "../cache";\nexport const authenticate = () => cache.size === 0;\n');
    const c = commit(cwd, "add cache module and import");
    const cResult = await impact(initial, c);
    expect(cResult.changes.files.map((file) => file.status)).toContain("added");
    expect(cResult.headSnapshot.graph.edges.some((edge) => edge.source === "src/auth/authService.ts" && edge.target === "src/cache.ts")).toBe(true);
    expect(cResult.baseSnapshot.graph.files.some((file) => file.path === "src/cache.ts")).toBe(false);

    // D: Git rename detection retains the old and new paths; the graph has the new relationship.
    git(cwd, "checkout", "-q", "-b", "scenario-d", initial);
    git(cwd, "mv", "src/utils/logger.ts", "src/utils/log.ts");
    write(cwd, "src/auth/authService.ts", 'import "../utils/log";\nexport const authenticate = () => log("auth");\n');
    write(cwd, "src/users/userService.ts", 'import "../utils/log";\nexport const users = () => log("users");\n');
    const d = commit(cwd, "rename logger");
    const dResult = await impact(initial, d);
    const rename = dResult.changes.files.find((file) => file.status === "renamed");
    expect(rename).toMatchObject({ path: "src/utils/log.ts", previousPath: "src/utils/logger.ts" });
    expect(dResult.headSnapshot.graph.edges.some((edge) => edge.target === "src/utils/log.ts")).toBe(true);

    // E: simultaneous edits share affected nodes without duplicating them and preserve per-file attribution.
    git(cwd, "checkout", "-q", "-b", "scenario-e", initial);
    write(cwd, "src/auth/authService.ts", 'import "../utils/logger";\nexport const authenticate = () => log("auth-v2");\n');
    write(cwd, "src/users/userService.ts", 'import "../utils/logger";\nexport const users = () => log("users-v2");\n');
    const e = commit(cwd, "update two services");
    const eResult = await impact(initial, e);
    expect(new Set(eResult.report.affectedFiles.map((file) => file.path)).size).toBe(eResult.report.affectedFiles.length);
    expect(eResult.report.affectedFiles.find((file) => file.path === "src/app.ts")?.responsibleChangedPaths).toEqual(["src/auth/authService.ts", "src/users/userService.ts"]);

    // F: a truly isolated source edit has no false positive impact.
    git(cwd, "checkout", "-q", "-b", "scenario-f", initial);
    write(cwd, "src/isolated.ts", "export const isolated = false;\n");
    const f = commit(cwd, "edit isolated module");
    const fResult = await impact(initial, f);
    expect(fResult.report.summary.totalUniqueAffectedFiles).toBe(0);
    expect(fResult.report.affectedFiles).toEqual([]);

    // G: the resolver reads each revision's config rather than reusing a prior branch's settings.
    git(cwd, "checkout", "-q", "-b", "scenario-g", initial);
    write(cwd, "src/aliasUser.ts", 'import "@/utils/logger";\nexport const aliasUser = true;\n');
    const aliasBase = commit(cwd, "add alias import under existing config");
    write(cwd, "tsconfig.json", '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/missing/*"]}}}');
    const g = commit(cwd, "change path alias configuration");
    const gResult = await impact(aliasBase, g);
    expect(gResult.baseSnapshot.graph.edges.some((edge) => edge.source === "src/aliasUser.ts" && edge.target === "src/utils/logger.ts")).toBe(true);
    expect(gResult.headSnapshot.graph.edges.some((edge) => edge.source === "src/aliasUser.ts" && edge.target === "src/utils/logger.ts")).toBe(false);
    expect(gResult.headSnapshot.unresolvedImports.some((item) => item.importingFile === "src/aliasUser.ts" && item.specifier === "@/utils/logger")).toBe(true);
    expect(gResult.headSnapshot.complete).toBe(false);

    for (const result of [aResult, bResult, cResult, dResult, eResult, fResult, gResult]) {
      expect(result.changes.isComplete).toBe(true);
      expect(result.baseSnapshot.commitSha).toBe(result.changes.baseSha);
      expect(result.headSnapshot.commitSha).toBe(result.changes.headSha);
      expect(result.headSnapshot.stats.eligibleSourceFiles).toBe(result.headSnapshot.stats.filesSelected);
      expect(result.headSnapshot.stats.eligibleSourceFiles).toBe(result.headSnapshot.stats.filesAnalyzed + result.headSnapshot.stats.failedDownloads + result.headSnapshot.stats.failedParsing + result.headSnapshot.stats.filesSkipped);
    }
  }, 90_000);
});
