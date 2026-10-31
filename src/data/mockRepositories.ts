import type { Repository, WorkspaceStats } from "@/types";

/**
 * Mock repository catalog for Phase I UI.
 * Replace with GitHub API results in Phase II.
 */
export const mockRepositories: Repository[] = [
  {
    id: "repo-repopilot",
    name: "repopilot",
    fullName: "utkarsh/repopilot",
    description:
      "Developer-focused code intelligence — dependency graphs and change impact analysis.",
    language: "TypeScript",
    fileCount: 28,
    dependencyCount: 34,
    stars: 12,
    updatedAt: "2026-10-31T12:00:00Z",
    status: "indexed",
    branch: "main",
    isPrimary: true,
    provenance: "mock",
  },
  {
    id: "repo-budgetwise",
    name: "budgetwise",
    fullName: "utkarsh/budgetwise",
    description: "Personal finance tracker with expense categorization.",
    language: "JavaScript",
    fileCount: 104,
    dependencyCount: 286,
    stars: 45,
    updatedAt: "2026-10-31T10:00:00Z",
    status: "indexed",
    branch: "main",
    provenance: "mock",
  },
  {
    id: "repo-ncertsheets",
    name: "ncertsheets-ai",
    fullName: "utkarsh/ncertsheets-ai",
    description: "AI-assisted worksheet generator for NCERT curriculum.",
    language: "TypeScript",
    fileCount: 58,
    dependencyCount: 142,
    stars: 23,
    updatedAt: "2026-10-30T18:00:00Z",
    status: "indexed",
    branch: "develop",
    provenance: "mock",
  },
  {
    id: "repo-devtools",
    name: "devtools-kit",
    fullName: "utkarsh/devtools-kit",
    description: "Shared utilities and CLI helpers for internal tooling.",
    language: "TypeScript",
    fileCount: 41,
    dependencyCount: 97,
    stars: 8,
    updatedAt: "2026-10-28T09:00:00Z",
    status: "pending",
    branch: "main",
    provenance: "mock",
  },
];

export const mockWorkspaceStats: WorkspaceStats = {
  repositories: 4,
  filesIndexed: 231,
  dependencies: 559,
  potentialRisks: 12,
  provenance: "mock",
};

export const primaryRepository =
  mockRepositories.find((r) => r.isPrimary) ?? mockRepositories[0];
