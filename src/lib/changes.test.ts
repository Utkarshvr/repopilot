import { describe, expect, it } from "vitest";
import type { AnalyzedRepository } from "@/types/analysis";
import type { GitHubCompareResult } from "@/types/changes";
import { buildDependencyGraphFixture } from "@/lib/analysis/fixtures/dependencyGraphFixture";
import { clearFileSelection, createGitHubChangeSet, createManualChangeSet, toggleFileSelection, validateGitHubRevision } from "./changes";
import { deserializeChangeSet, serializeChangeSet, summarizeChangeSet } from "@/types/changes";

const { graph } = buildDependencyGraphFixture();
const analyzed = {
  id: "github:fixture/repo",
  metadata: { fullName: "fixture/repo", htmlUrl: "https://github.com/fixture/repo" },
  graph,
} as AnalyzedRepository;

const comparison: GitHubCompareResult = {
  baseSha: "abcdef1234567",
  headSha: "1234567abcdef",
  baseTreeSha: "treebase",
  headTreeSha: "treehead",
  totalCommits: 4,
  isComplete: true,
  completenessWarning: null,
  files: [
    { filename: "src/newFile.ts", status: "added", additions: 12, deletions: 0, changes: 12, patch: "+new" },
    { filename: "src/app.ts", status: "modified", additions: 3, deletions: 1, changes: 4, patch: "-old\n+new" },
    { filename: "src/auth/authService.ts", status: "removed", additions: 0, deletions: 14, changes: 14 },
    { filename: "src/auth/authControllerNew.ts", previous_filename: "src/auth/authController.ts", status: "renamed", additions: 1, deletions: 1, changes: 2, patch: "rename" },
    { filename: "src/utils/logger-copy.ts", previous_filename: "src/utils/logger.ts", status: "copied", additions: 5, deletions: 0, changes: 5 },
    { filename: "assets/logo.png", status: "modified", additions: 0, deletions: 0, changes: 0 },
    { filename: "package.json", status: "modified", additions: 2, deletions: 1, changes: 3, patch: "metadata" },
    { filename: "src/newFeature.ts", status: "modified", additions: 5, deletions: 0, changes: 5 },
    { filename: "src/experimental.js", status: "changed-by-github", additions: 0, deletions: 0, changes: 0 },
  ],
};

describe("change set modeling", () => {
  it("creates manual selections with one, multiple, and no files", () => {
    const one = createManualChangeSet(analyzed, ["src/index.ts"], "one", "now");
    expect(one.files.map((file) => file.path)).toEqual(["src/index.ts"]);
    expect(one.files[0]).toMatchObject({ status: "selected", isInAnalyzedGraph: true, analysisEligible: true, selectedForImpact: true });

    const multiple = createManualChangeSet(analyzed, ["src/index.ts", "src/app.ts"], "many", "now");
    expect(multiple.files).toHaveLength(2);
    expect(createManualChangeSet(analyzed, [], "empty", "now").files).toEqual([]);
  });

  it("supports toggling and clearing manual file selection", () => {
    let selected = toggleFileSelection(new Set(), "src/index.ts");
    selected = toggleFileSelection(selected, "src/app.ts");
    expect(selected).toEqual(new Set(["src/index.ts", "src/app.ts"]));
    selected = toggleFileSelection(selected, "src/index.ts");
    expect(selected).toEqual(new Set(["src/app.ts"]));
    expect(clearFileSelection()).toEqual(new Set());
  });

  it("preserves GitHub statuses, rename paths, counts, patches, and analysis eligibility", () => {
    const changeSet = createGitHubChangeSet(analyzed, "main", "feature/update", comparison, "compare", "now");
    const byPath = new Map(changeSet.files.map((file) => [file.path, file]));
    expect(byPath.get("src/newFile.ts")).toMatchObject({ status: "added", analysisEligible: false, isInAnalyzedGraph: false, ineligibilityReason: "not-in-graph", additions: 12, patchAvailable: true });
    expect(byPath.get("src/newFeature.ts")).toMatchObject({ analysisEligible: false, isInAnalyzedGraph: false, ineligibilityReason: "not-in-graph" });
    expect(byPath.get("src/app.ts")).toMatchObject({ status: "modified", analysisEligible: true, changes: 4 });
    expect(byPath.get("src/auth/authService.ts")).toMatchObject({ status: "removed", analysisEligible: true, patchAvailable: false, patch: null });
    expect(byPath.get("src/auth/authControllerNew.ts")).toMatchObject({ status: "renamed", previousPath: "src/auth/authController.ts", isInAnalyzedGraph: true, analysisEligible: true });
    expect(byPath.get("src/utils/logger-copy.ts")).toMatchObject({ status: "copied", previousPath: "src/utils/logger.ts" });
    expect(byPath.get("assets/logo.png")).toMatchObject({ isBinary: true, patchAvailable: false, classification: "other" });
    expect(byPath.get("package.json")).toMatchObject({ classification: "metadata", analysisEligible: false, ineligibilityReason: "unsupported-file-type" });
    expect(changeSet.files.find((file) => file.rawStatus === "changed-by-github")).toMatchObject({ status: "other", rawStatus: "changed-by-github" });
  });

  it("summarizes all changed files separately from eligible and out-of-graph files", () => {
    const changeSet = createGitHubChangeSet(analyzed, "main", "feature", comparison, "summary", "now");
    expect(summarizeChangeSet(changeSet.files)).toMatchObject({ total: 9, added: 1, modified: 4, removed: 1, renamed: 1, copied: 1, other: 1, eligible: 4, outsideGraph: 5 });
  });

  it("round-trips serializable change sets and rejects malformed storage", () => {
    const changeSet = createGitHubChangeSet(analyzed, "main", "feature", comparison, "persisted", "now");
    expect(deserializeChangeSet(serializeChangeSet(changeSet))).toEqual(changeSet);
    expect(deserializeChangeSet("not json")).toBeNull();
    expect(deserializeChangeSet(JSON.stringify({ id: "missing-fields" }))).toBeNull();
  });

  it("validates branch and SHA references", () => {
    expect(validateGitHubRevision("main")).toBeNull();
    expect(validateGitHubRevision("feature/repo-analysis")).toBeNull();
    expect(validateGitHubRevision("a1b2c3d")).toBeNull();
    expect(validateGitHubRevision("")).toContain("Enter a branch");
    expect(validateGitHubRevision("feature/../main")).toContain("valid branch");
    expect(validateGitHubRevision("branch?head=secret")).toContain("valid branch");
  });
});
