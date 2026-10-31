import type { Repository } from "@/types";
import { RepositoryCard } from "./RepositoryCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { GitBranch } from "lucide-react";

export function RepositoryList({
  repositories,
}: {
  repositories: Repository[];
}) {
  if (repositories.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No repositories yet"
        description="Connect GitHub in Phase II to import real repositories. Mock data powers this view for now."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {repositories.map((repo) => (
        <RepositoryCard key={repo.id} repository={repo} />
      ))}
    </div>
  );
}
