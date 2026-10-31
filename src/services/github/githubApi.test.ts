import { afterEach, describe, expect, it, vi } from "vitest";
import { compareRepositoryCommits, GitHubApiError } from "./githubApi";

afterEach(() => vi.unstubAllGlobals());

function response(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

describe("GitHub commit comparison API", () => {
  it("uses the compare endpoint with a correctly encoded ref and the file-bearing first page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      base_commit: { sha: "base-sha" }, head_commit: { sha: "head-sha" }, total_commits: 2,
      files: [{ filename: "src/a.ts", status: "renamed", previous_filename: "src/old.ts", additions: 1, deletions: 1, changes: 2, patch: "diff" }],
    }, 200, { Link: '<https://api.github.com/repos/acme/demo/compare/main...feature?page=2>; rel="next"' }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await compareRepositoryCommits("acme", "demo", "main", "feature/repo-analysis");
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/repos/acme/demo/compare/main...feature/repo-analysis?per_page=100&page=1");
    expect(options.headers).toMatchObject({ Accept: "application/vnd.github+json" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ baseSha: "base-sha", headSha: "head-sha", totalCommits: 2, isComplete: true });
    expect(result.files[0]).toMatchObject({ filename: "src/a.ts", previous_filename: "src/old.ts", status: "renamed", patch: "diff" });
  });

  it("resolves revision identities when GitHub omits head_commit from its compare response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ total_commits: 1, files: [{ filename: "src/a.ts", status: "modified" }] }))
      .mockResolvedValueOnce(response({ sha: "base-resolved", commit: { tree: { sha: "base-tree" } } }))
      .mockResolvedValueOnce(response({ sha: "head-resolved", commit: { tree: { sha: "head-tree" } } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await compareRepositoryCommits("acme", "demo", "release/1", "main");

    expect(result).toMatchObject({ baseSha: "base-resolved", headSha: "head-resolved", baseTreeSha: "base-tree", headTreeSha: "head-tree" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain("/commits/main");
  });

  it("marks the 300-file API cap as potentially incomplete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      base_commit: { sha: "base" }, head_commit: { sha: "head" },
      total_commits: 1,
      files: Array.from({ length: 300 }, (_, i) => ({ filename: `src/${i}.ts`, status: "modified" })),
    })));
    const result = await compareRepositoryCommits("acme", "demo", "main", "topic");
    expect(result.files).toHaveLength(300);
    expect(result.isComplete).toBe(false);
    expect(result.completenessWarning).toContain("maximum for a compare response");
  });

  it("rejects invalid refs before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(compareRepositoryCommits("acme", "demo", "../main", "topic")).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles invalid and inaccessible revisions without exposing credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ message: "Not Found" }, 404)));
    await expect(compareRepositoryCommits("acme", "demo", "main", "missing")).rejects.toThrow("repository or one of these revisions");
  });

  it("surfaces GitHub rate limiting and API failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ message: "API rate limit exceeded" }, 403, { "X-RateLimit-Remaining": "0" })));
    try {
      await compareRepositoryCommits("acme", "demo", "main", "topic");
      throw new Error("Expected request failure");
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubApiError);
      expect((error as GitHubApiError).rateLimited).toBe(true);
      expect((error as Error).message).toContain("rate limit");
    }
  });

  it("does not claim completeness when GitHub omits the changed-file list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ total_commits: 2 })));
    await expect(compareRepositoryCommits("acme", "demo", "main", "topic")).rejects.toMatchObject({ status: 502 });
  });
});
