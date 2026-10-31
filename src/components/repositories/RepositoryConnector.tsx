import { useState, useCallback } from "react";
import { GitBranch, Search, AlertCircle, Loader2 } from "lucide-react";
import { parseGitHubUrl, GitHubApiError } from "@/services/github/githubApi";
import { runAnalysisPipeline } from "@/services/github/repositoryService";
import { useRepositoryStore } from "@/store/repositoryStore";
import { DEFAULT_ANALYSIS_LIMITS } from "@/types/analysis";
import { AnalysisProgressBar } from "./AnalysisProgressBar";

const EXAMPLE_URLS = [
  "https://github.com/pmndrs/zustand",
  "https://github.com/pacocoursey/cmdk",
  "https://github.com/lukeed/clsx",
];

export function RepositoryConnector() {
  const [url, setUrl] = useState("");
  const [maxFiles, setMaxFiles] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const isAnalyzing = useRepositoryStore((s) => s.isAnalyzing);
  const progress = useRepositoryStore((s) => s.progress);
  const analysisError = useRepositoryStore((s) => s.analysisError);
  const startAnalysis = useRepositoryStore((s) => s.startAnalysis);
  const updateProgress = useRepositoryStore((s) => s.updateProgress);
  const storeAnalysis = useRepositoryStore((s) => s.storeAnalysis);
  const failAnalysis = useRepositoryStore((s) => s.failAnalysis);
  const cancelAnalysis = useRepositoryStore((s) => s.cancelAnalysis);

  const handleSubmit = useCallback(
    async (inputUrl: string) => {
      setUrlError(null);

      const configuredMaximum = maxFiles.trim() ? Number(maxFiles) : null;
      if (configuredMaximum !== null && (!Number.isInteger(configuredMaximum) || configuredMaximum < 1)) {
        setUrlError("Maximum files must be a positive whole number, or left blank for all eligible files.");
        return;
      }

      let parsed;
      try {
        parsed = parseGitHubUrl(inputUrl);
      } catch (err) {
        setUrlError(err instanceof GitHubApiError ? err.message : "Invalid URL");
        return;
      }

      const controller = startAnalysis();

      try {
        const result = await runAnalysisPipeline(
          parsed,
          { ...DEFAULT_ANALYSIS_LIMITS, maxSourceFiles: configuredMaximum },
          updateProgress,
          controller.signal,
        );
        storeAnalysis(result.analyzed);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // cancelled — state already updated by cancelAnalysis()
          return;
        }
        const msg =
          err instanceof GitHubApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Analysis failed. Please try again.";

        if (err instanceof GitHubApiError && err.rateLimited) {
          failAnalysis(
            "GitHub API rate limit reached. Wait a minute then try again, or use a smaller repository.",
          );
        } else {
          failAnalysis(msg);
        }
      }
    },
    [startAnalysis, updateProgress, storeAnalysis, failAnalysis, maxFiles],
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(url);
  };

  const showProgress =
    isAnalyzing || progress.stage === "complete" || progress.stage === "error" || progress.stage === "cancelled";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-[#101014] p-5">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch size={18} className="text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Connect a GitHub Repository
          </h3>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-3">
          <div>
            <label htmlFor="repo-url" className="text-xs text-zinc-500 block mb-1.5">
              GitHub repository URL
            </label>
            <div className="relative">
              <input
                id="repo-url"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setUrlError(null);
                }}
                placeholder="https://github.com/owner/repo"
                disabled={isAnalyzing}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 pr-10 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50 transition"
              />
              <Search
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
              />
            </div>
            {urlError && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle size={12} />
                {urlError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="max-analysis-files" className="text-xs text-zinc-500 block mb-1.5">
              Maximum files to analyze <span className="text-zinc-600">(blank means all)</span>
            </label>
            <input
              id="max-analysis-files"
              type="number"
              min={1}
              step={1}
              value={maxFiles}
              onChange={(event) => setMaxFiles(event.target.value)}
              disabled={isAnalyzing}
              placeholder="No file-count limit"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isAnalyzing || !url.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <GitBranch size={14} />
                Analyze Repository
              </>
            )}
          </button>
        </form>

        {/* Example URLs */}
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-[11px] text-zinc-600 mb-2">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_URLS.map((exampleUrl) => {
              const parts = exampleUrl.replace("https://github.com/", "").split("/");
              return (
                <button
                  key={exampleUrl}
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => {
                    setUrl(exampleUrl);
                    handleSubmit(exampleUrl);
                  }}
                  className="rounded border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition disabled:opacity-40"
                >
                  {parts[0]}/{parts[1]}
                </button>
              );
            })}
          </div>
        </div>

        {/* API info */}
        <p className="mt-3 text-[10px] text-zinc-600">
          Uses the GitHub public API. Rate limited to ~60 requests/hour without auth.
          Supports public repositories only.
        </p>
      </div>

      {/* Analysis error (not in-flight) */}
      {analysisError && !isAnalyzing && progress.stage === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <p className="text-sm font-medium text-red-300">Analysis failed</p>
          </div>
          <p className="mt-1.5 text-xs text-red-400/80 leading-5">{analysisError}</p>
        </div>
      )}

      {/* Progress panel */}
      {showProgress && (
        <AnalysisProgressBar
          progress={progress}
          onCancel={cancelAnalysis}
          isAnalyzing={isAnalyzing}
        />
      )}
    </div>
  );
}

