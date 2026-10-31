import type { PackageManifestAnalysis, ProjectMetadataAnalysis } from "@/types/analysis";

function declared(value: string | null | undefined): string {
  return value?.trim() ? value : "Not declared";
}

function metadataValue(value: unknown): string {
  if (value == null || value === "") return "Not declared";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function ProjectMetadataPanel({ metadata }: { metadata?: ProjectMetadataAnalysis }) {
  if (!metadata) {
    return (
      <section className="rounded-xl border border-white/[0.07] bg-[#101014] p-4">
        <h3 className="text-sm font-semibold text-zinc-200">Project Metadata</h3>
        <p className="mt-2 text-xs text-zinc-500">Not available for this saved analysis. Re-analyze the repository to collect manifests and configuration metadata.</p>
      </section>
    );
  }

  const manifest = metadata.packageManifest;
  const manifestOutcome = metadata.outcomes.find((outcome) => outcome.path === "package.json");
  const manifestUnavailable = !manifest
    ? manifestOutcome?.failureType === "parse" ? "Manifest is malformed"
      : manifestOutcome?.failureType === "fetch" ? "Manifest could not be fetched"
        : manifestOutcome?.status === "not-processed" ? "Manifest exceeded the metadata size limit"
          : "No package.json manifest found"
    : undefined;
  const production = manifest?.dependencies.length ?? 0;
  const development = manifest?.devDependencies.length ?? 0;
  const peer = manifest?.peerDependencies.length ?? 0;
  const optional = manifest?.optionalDependencies.length ?? 0;
  const totalDependencies = new Set([
    ...manifest?.dependencies.map((item) => item.name) ?? [],
    ...manifest?.devDependencies.map((item) => item.name) ?? [],
    ...manifest?.peerDependencies.map((item) => item.name) ?? [],
    ...manifest?.optionalDependencies.map((item) => item.name) ?? [],
  ]).size;
  const managers = metadata.packageManager.detected;

  return (
    <details className="rounded-xl border border-white/[0.07] bg-[#101014]">
      <summary className="cursor-pointer list-none px-5 py-4">
        <span className="text-sm font-semibold text-zinc-200">Project Metadata</span>
        <span className="ml-2 text-[11px] text-zinc-500">
          {metadata.stats.metadataFilesFullyParsed}/{metadata.stats.metadataFilesDiscovered} fully parsed
        </span>
      </summary>
      <div className="space-y-5 border-t border-white/[0.06] p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetadataCell label="Project" value={manifest?.name ?? manifestUnavailable ?? "Not declared"} />
          <MetadataCell label="Version" value={manifest ? declared(manifest.version) : manifestUnavailable ?? "Not declared"} />
          <MetadataCell label="Description" value={manifest ? declared(manifest.description) : manifestUnavailable ?? "Not declared"} />
          <MetadataCell label="Runtime requirements" value={manifest ? declared(manifest.nodeEngine) : manifestUnavailable ?? "Not declared"} />
          <MetadataCell label="Package type" value={manifest ? declared(manifest.packageType) : manifestUnavailable ?? "Not declared"} />
          <MetadataCell
            label="Package manager"
            value={managers.length ? managers.join(", ") : "No lockfile detected"}
            detail={metadata.packageManager.multipleLockfiles ? "Multiple lockfiles found" : metadata.packageManager.declared ? `Manifest declares ${metadata.packageManager.declared}` : undefined}
          />
        </div>

        <div>
          <h4 className="text-xs font-semibold text-zinc-300">Dependencies</h4>
          {!manifest && <p className="mt-2 text-xs text-zinc-500">Dependency details unavailable: {manifestUnavailable}.</p>}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <CountCell label="Total" value={totalDependencies} />
            <CountCell label="Production" value={production} />
            <CountCell label="Development" value={development} />
            <CountCell label="Peer" value={peer} />
            <CountCell label="Optional" value={optional} />
          </div>
          {manifest && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DependencyList title="Production packages" items={manifest.dependencies} />
              <DependencyList title="Development packages" items={manifest.devDependencies} />
              <DependencyList title="Peer packages" items={manifest.peerDependencies} />
              <DependencyList title="Optional packages" items={manifest.optionalDependencies} />
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-zinc-300">Entry points</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <MetadataCell label="main" value={declared(manifest?.entryPoints.main)} />
            <MetadataCell label="module" value={declared(manifest?.entryPoints.module)} />
            <MetadataCell label="browser" value={metadataValue(manifest?.entryPoints.browser)} />
            <MetadataCell label="exports" value={metadataValue(manifest?.entryPoints.exports)} />
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-zinc-300">Available npm scripts</h4>
          {manifest && Object.keys(manifest.scripts).length > 0 ? (
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {Object.entries(manifest.scripts).map(([name, script]) => (
                <li key={name} className="rounded border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                  <code className="text-[11px] text-indigo-300">{name}</code>
                  <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">{script}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-xs text-zinc-500">{manifest ? "No scripts declared." : `Script details unavailable: ${manifestUnavailable}.`}</p>}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-zinc-300">TypeScript / JavaScript configuration</h4>
          {metadata.tsConfigs.length ? metadata.tsConfigs.map((config) => (
            <div key={config.path} className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="font-mono text-[11px] text-zinc-300">{config.path}</p>
              <div className="mt-2 grid gap-1 text-[10px] text-zinc-500 sm:grid-cols-2">
                <span>extends: {config.extends == null ? "Not declared" : Array.isArray(config.extends) ? config.extends.join(", ") : config.extends}</span>
                <span>baseUrl: {declared(config.baseUrl)}</span>
                <span>target: {declared(config.target)}</span>
                <span>module: {declared(config.module)}</span>
                <span>moduleResolution: {declared(config.moduleResolution)}</span>
                <span>jsx: {declared(config.jsx)}</span>
                <span>strict: {config.strict == null ? "Not declared" : String(config.strict)}</span>
                <span>allowJs: {config.allowJs == null ? "Not declared" : String(config.allowJs)}</span>
                <span>resolveJsonModule: {config.resolveJsonModule == null ? "Not declared" : String(config.resolveJsonModule)}</span>
                <span>paths: {Object.keys(config.paths).length ? JSON.stringify(config.paths) : "Not declared"}</span>
                <span>include: {config.include?.length ? config.include.join(", ") : "Not declared"}</span>
                <span>exclude: {config.exclude?.length ? config.exclude.join(", ") : "Not declared"}</span>
              </div>
            </div>
          )) : <p className="mt-2 text-xs text-zinc-500">No TypeScript or JavaScript config detected.</p>}
        </div>

        {metadata.packageManifests.length > 1 && (
          <p className="text-[10px] text-zinc-500">Parsed {metadata.packageManifests.length} package manifests; displaying the root manifest summary.</p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <CountCell label="Metadata files discovered" value={metadata.stats.metadataFilesDiscovered} />
          <CountCell label="Fully parsed" value={metadata.stats.metadataFilesFullyParsed} />
          <CountCell label="Partially inspected" value={metadata.stats.metadataFilesPartiallyInspected} />
          <CountCell label="Failed" value={metadata.stats.metadataFilesFailed} />
          <CountCell label="Not processed" value={metadata.stats.metadataFilesNotProcessed} />
        </div>
        {(metadata.stats.metadataFilesFailed > 0 || metadata.stats.metadataFilesNotProcessed > 0) && (
          <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-[11px] text-amber-300">
            {metadata.outcomes.filter((outcome) => outcome.status === "failed" || outcome.status === "not-processed").map((outcome) => (
              <p key={outcome.path} className="break-all text-amber-200/70">{outcome.path}: {outcome.detail}</p>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function MetadataCell({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-xs text-zinc-200">{value}</p>
      {detail && <p className="mt-1 text-[10px] text-zinc-500">{detail}</p>}
    </div>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return <div className="rounded border border-white/[0.05] bg-white/[0.02] px-3 py-2"><p className="text-[10px] text-zinc-500">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums text-zinc-200">{value}</p></div>;
}

function DependencyList({ title, items }: { title: string; items: PackageManifestAnalysis["dependencies"] }) {
  return (
    <div className="rounded border border-white/[0.05] bg-white/[0.02] p-3">
      <p className="text-[10px] text-zinc-400">{title}</p>
      {items.length ? <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">{items.map((item) => <li key={item.name} className="flex justify-between gap-2 text-[10px]"><span className="truncate text-zinc-300">{item.name}</span><code className="shrink-0 text-zinc-500">{item.versionRange}</code></li>)}</ul> : <p className="mt-2 text-[10px] text-zinc-600">None declared.</p>}
    </div>
  );
}
