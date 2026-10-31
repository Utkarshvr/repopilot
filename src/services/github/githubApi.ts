import type {
  GitHubRepoMetadata,
  ParsedGitHubUrl,
  RepoTreeEntry,
} from "@/types/analysis";
import type { GitHubCompareResult, GitHubComparedFile } from "@/types/changes";
import { validateGitHubRevision } from "@/lib/changes";

const GITHUB_API = "https://api.github.com";
const RAW_HOST = "https://raw.githubusercontent.com";
const REQUEST_TIMEOUT_MS = 30_000;

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function isRequestTimeout(error: unknown, signal?: AbortSignal): boolean {
  return !signal?.aborted && error instanceof DOMException && error.name === "TimeoutError";
}

export class GitHubApiError extends Error {
  status: number;
  rateLimited: boolean;

  constructor(message: string, status: number, rateLimited = false) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

/**
 * Parse common GitHub repository URL forms into owner/repo.
 * Supports https://github.com/owner/repo(.git)? and owner/repo shorthand.
 */
export function parseGitHubUrl(input: string): ParsedGitHubUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new GitHubApiError("Repository URL is required.", 400);
  }

  const shorthand = trimmed.match(
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/,
  );
  if (shorthand) {
    return {
      owner: shorthand[1],
      repo: shorthand[2].replace(/\.git$/, ""),
      url: `https://github.com/${shorthand[1]}/${shorthand[2].replace(/\.git$/, "")}`,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new GitHubApiError(
      "Invalid GitHub URL. Expected https://github.com/owner/repo",
      400,
    );
  }

  if (url.hostname.toLowerCase() !== "github.com") {
    throw new GitHubApiError("Only github.com repository URLs are supported.", 400);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new GitHubApiError(
      "URL must include owner and repository name.",
      400,
    );
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new GitHubApiError("Invalid GitHub owner or repository name.", 400);
  }
  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
}

async function githubFetch<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}${path}`, {
      signal: requestSignal(signal),
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (isRequestTimeout(error, signal)) throw new GitHubApiError(`GitHub request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`, 408);
    throw error;
  }

  const remaining = response.headers.get("X-RateLimit-Remaining");
  const rateLimited =
    response.status === 403 ||
    response.status === 429 ||
    remaining === "0";

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* ignore */
    }

    if (response.status === 404) {
      throw new GitHubApiError(
        "Repository not found. Check the URL or visibility (public only).",
        404,
      );
    }

    throw new GitHubApiError(
      rateLimited
        ? `GitHub API rate limit reached. ${detail}`
        : `GitHub API error (${response.status}): ${detail}`,
      response.status,
      rateLimited,
    );
  }

  return (await response.json()) as T;
}

interface GhRepoResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  private: boolean;
  visibility: string;
  html_url: string;
}

export async function fetchRepositoryMetadata(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<GitHubRepoMetadata> {
  const data = await githubFetch<GhRepoResponse>(
    `/repos/${owner}/${repo}`,
    signal,
  );

  if (data.private) {
    throw new GitHubApiError(
      "Private repositories are not supported without authentication.",
      403,
    );
  }

  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    defaultBranch: data.default_branch,
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    updatedAt: data.updated_at,
    private: data.private,
    visibility: data.visibility,
    htmlUrl: data.html_url,
  };
}

interface GhCompareResponse {
  base_commit?: { sha?: string; commit?: { tree?: { sha?: string } } };
  head_commit?: { sha?: string; commit?: { tree?: { sha?: string } } };
  total_commits?: number;
  files?: Array<{
    filename?: string;
    previous_filename?: string;
    status?: string;
    additions?: number;
    deletions?: number;
    changes?: number;
    patch?: string;
  }>;
}

interface GhCommitResponse {
  sha?: string;
  commit?: { tree?: { sha?: string } };
}

function encodeGitRef(ref: string): string {
  return ref.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

/**
 * Compare two refs with GitHub's compare endpoint. GitHub includes changed
 * files on the first page only (up to 300); page 1 is requested intentionally,
 * while `per_page=100` controls commit pagination. A full 300-file response is
 * treated as potentially truncated because the API provides no total file count.
 */
export async function compareRepositoryCommits(
  owner: string,
  repo: string,
  base: string,
  head: string,
  signal?: AbortSignal,
): Promise<GitHubCompareResult> {
  const baseError = validateGitHubRevision(base);
  const headError = validateGitHubRevision(head);
  if (baseError) throw new GitHubApiError(`Invalid base revision: ${baseError}`, 400);
  if (headError) throw new GitHubApiError(`Invalid head revision: ${headError}`, 400);
  if (base.trim() === head.trim()) throw new GitHubApiError("Base and head revisions must be different.", 400);

  const route = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeGitRef(base.trim())}...${encodeGitRef(head.trim())}?per_page=100&page=1`;
  let data: GhCompareResponse;
  try {
    data = await githubFetch<GhCompareResponse>(route, signal);
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      throw new GitHubApiError("GitHub could not find the repository or one of these revisions. Check both refs and public repository visibility.", 404);
    }
    throw error;
  }

  if (!Array.isArray(data.files)) {
    throw new GitHubApiError("GitHub did not return a changed-file list, so comparison completeness cannot be verified.", 502);
  }
  const files: GitHubComparedFile[] = data.files.map((file) => {
    if (typeof file.filename !== "string" || typeof file.status !== "string") {
      throw new GitHubApiError("GitHub returned an invalid changed-file record.", 502);
    }
    return {
      filename: file.filename,
      previous_filename: file.previous_filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
    };
  });
  // The compare endpoint does not consistently include head_commit. Resolve a
  // missing identity by asking the commits endpoint for the exact requested ref.
  const [resolvedBase, resolvedHead] = await Promise.all([
    data.base_commit?.sha ? Promise.resolve(null) : githubFetch<GhCommitResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeGitRef(base.trim())}`, signal),
    data.head_commit?.sha ? Promise.resolve(null) : githubFetch<GhCommitResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeGitRef(head.trim())}`, signal),
  ]);
  const limitReached = files.length >= 300;
  return {
    baseSha: data.base_commit?.sha ?? resolvedBase?.sha ?? null,
    headSha: data.head_commit?.sha ?? resolvedHead?.sha ?? null,
    baseTreeSha: data.base_commit?.commit?.tree?.sha ?? resolvedBase?.commit?.tree?.sha ?? null,
    headTreeSha: data.head_commit?.commit?.tree?.sha ?? resolvedHead?.commit?.tree?.sha ?? null,
    totalCommits: Number.isFinite(data.total_commits) ? data.total_commits! : null,
    files,
    isComplete: !limitReached,
    completenessWarning: limitReached
      ? "GitHub returned 300 changed files, its maximum for a compare response. Additional changed files may be omitted."
      : null,
  };
}

interface GhTreeResponse {
  sha: string;
  truncated: boolean;
  tree: Array<{
    path: string;
    mode: string;
    type: "blob" | "tree" | "commit";
    sha: string;
    size?: number;
    url: string;
  }>;
}

export async function fetchRepositoryTree(
  owner: string,
  repo: string,
  branch: string,
  signal?: AbortSignal,
): Promise<{ entries: RepoTreeEntry[]; truncated: boolean; treeSha: string }> {
  const encodedBranch = encodeURIComponent(branch);
  const data = await githubFetch<GhTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${encodedBranch}?recursive=1`,
    signal,
  );

  const entries: RepoTreeEntry[] = data.tree
    .filter((item) => item.type === "blob")
    .map((item) => ({
      path: item.path,
      sha: item.sha,
      size: item.size ?? 0,
      type: "blob" as const,
    }));

  return {
    entries,
    truncated: data.truncated,
    treeSha: data.sha,
  };
}

/**
 * Fetch file contents via raw.githubusercontent.com to avoid burning
 * GitHub REST API quota on every blob. No auth tokens are used.
 */
export async function fetchRawFileContent(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<string> {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = `${RAW_HOST}/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`;

  let response: Response;
  try {
    response = await fetch(url, { signal: requestSignal(signal) });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (isRequestTimeout(error, signal)) throw new GitHubApiError(`Fetching ${filePath} timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`, 408);
    throw error;
  }
  if (!response.ok) {
    throw new GitHubApiError(
      `Failed to fetch ${filePath} (${response.status})`,
      response.status,
      response.status === 403 || response.status === 429,
    );
  }

  return response.text();
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      if (signal?.aborted) {
        throw new DOMException("Analysis cancelled", "AbortError");
      }
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
