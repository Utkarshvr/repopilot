import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { analyzeProjectMetadata } from "./projectMetadata";
import { classifyRepositoryFile } from "./fileFilter";
import { ProjectMetadataPanel } from "@/components/repositories/ProjectMetadataPanel";
import type { RepoTreeEntry } from "@/types/analysis";

function entry(path: string, size = 100): RepoTreeEntry {
  return { path, sha: path, size, type: "blob" };
}

describe("project metadata analysis", () => {
  it("parses package fields and separates production from development dependencies", () => {
    const data = analyzeProjectMetadata(
      [entry("package.json")],
      { "package.json": { content: JSON.stringify({
        name: "sample", version: "2.1.0", description: "Example", type: "module",
        main: "dist/index.cjs", module: "dist/index.js", browser: { "./node.js": "./browser.js" },
        exports: { ".": "./index.js" }, dependencies: { react: "^19" },
        devDependencies: { vitest: "~3" }, peerDependencies: { typescript: ">=5" },
        optionalDependencies: { fsevents: "*" }, scripts: { test: "vitest run" },
        engines: { node: ">=20" }, packageManager: "pnpm@9.0.0",
      }) } }, 500,
    );
    expect(data.packageManifest).toMatchObject({ name: "sample", version: "2.1.0", packageType: "module", nodeEngine: ">=20" });
    expect(data.packageManifest?.dependencies).toEqual([{ name: "react", versionRange: "^19" }]);
    expect(data.packageManifest?.devDependencies).toEqual([{ name: "vitest", versionRange: "~3" }]);
    expect(data.packageManifest?.entryPoints.browser).toEqual({ "./node.js": "./browser.js" });
  });

  it("keeps dependency groups separate and counts overlapping names once in the total", () => {
    const data = analyzeProjectMetadata([entry("package.json")], { "package.json": { content: JSON.stringify({
      dependencies: { shared: "^1", runtime: "^2" },
      devDependencies: { tooling: "^3", shared: "^1" },
      peerDependencies: { shared: "^1" },
      optionalDependencies: { optional: "^4" },
    }) } }, 500);
    const manifest = data.packageManifest!;
    expect(manifest.dependencies.map((item) => item.name)).toEqual(["runtime", "shared"]);
    expect(manifest.devDependencies.map((item) => item.name)).toEqual(["shared", "tooling"]);
    expect(manifest.peerDependencies.map((item) => item.name)).toEqual(["shared"]);
    expect(manifest.optionalDependencies.map((item) => item.name)).toEqual(["optional"]);
    const uniqueTotal = new Set([
      ...manifest.dependencies, ...manifest.devDependencies,
      ...manifest.peerDependencies, ...manifest.optionalDependencies,
    ].map((item) => item.name)).size;
    expect(uniqueTotal).toBe(4);
  });

  it("keeps absent optional fields missing instead of inventing defaults", () => {
    const data = analyzeProjectMetadata([entry("package.json")], { "package.json": { content: '{"name":"bare"}' } }, 500);
    expect(data.packageManifest?.version).toBeNull();
    expect(data.packageManifest?.nodeEngine).toBeNull();
    expect(data.packageManifest?.scripts).toEqual({});
    expect(data.packageManager.detected).toEqual([]);
  });

  it("counts malformed manifests as metadata parse failures", () => {
    const data = analyzeProjectMetadata([entry("package.json")], { "package.json": { content: "{bad json" } }, 500);
    expect(data.packageManifest).toBeNull();
    expect(data.stats.metadataParsingFailures).toBe(1);
    expect(data.stats.metadataFetchFailures).toBe(0);
    expect(data.outcomes[0]).toMatchObject({ status: "failed", failureType: "parse" });
  });

  it.each([
    ["package-lock.json", "npm"], ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"], ["bun.lock", "bun"], ["bun.lockb", "bun"],
  ] as const)("detects %s without reading the lockfile", (path, manager) => {
    const data = analyzeProjectMetadata([entry(path)], {}, 500);
    expect(data.packageManager.detected).toContain(manager);
    expect(data.outcomes[0]).toMatchObject({ status: "partially-inspected" });
    expect(data.outcomes[0].detail).toContain("contents were not parsed");
  });

  it("reports multiple lockfiles instead of selecting one", () => {
    const data = analyzeProjectMetadata([entry("package-lock.json"), entry("pnpm-lock.yaml")], {}, 500);
    expect(data.packageManager.detected).toEqual(["npm", "pnpm"]);
    expect(data.packageManager.multipleLockfiles).toBe(true);
  });

  it("accounts for each metadata file once across fully parsed, partial, failed, and unprocessed", () => {
    const entries = [
      entry("package.json"), entry("package-lock.json"), entry("tsconfig.json"),
      entry("jsconfig.json"), entry("bun.lock"),
    ];
    const data = analyzeProjectMetadata(entries, {
      "package.json": { content: '{"name":"sample"}' },
      "tsconfig.json": { content: '{ "compilerOptions": { "strict": true, }, }' },
      "jsconfig.json": { content: "{ malformed" },
    }, 500);
    expect(data.stats).toMatchObject({
      metadataFilesDiscovered: 5,
      metadataFilesFullyParsed: 2,
      metadataFilesPartiallyInspected: 2,
      metadataFilesFailed: 1,
      metadataFilesNotProcessed: 0,
    });
    expect(data.stats.metadataFilesFullyParsed + data.stats.metadataFilesPartiallyInspected + data.stats.metadataFilesFailed + data.stats.metadataFilesNotProcessed).toBe(data.stats.metadataFilesDiscovered);
    expect(new Set(data.outcomes.map((item) => item.path)).size).toBe(entries.length);
  });

  it("parses TypeScript config JSONC and exposes the same paths to import resolution", () => {
    const path = "config/tsconfig.json";
    const data = analyzeProjectMetadata([entry(path)], { [path]: { content: `{
      // project aliases
      "extends": "../tsconfig.base.json",
      "compilerOptions": {
        "baseUrl": "..", "paths": { "@/*": ["src/*"], },
        "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
        "jsx": "react-jsx", "strict": true, "allowJs": false,
        "resolveJsonModule": true,
      },
      "include": ["src",], "exclude": ["dist",],
    }` } }, 500);
    expect(data.tsConfigs[0]).toMatchObject({
      extends: "../tsconfig.base.json", baseUrl: "..", target: "ES2022", module: "ESNext",
      moduleResolution: "Bundler", jsx: "react-jsx", strict: true, allowJs: false,
      resolveJsonModule: true, include: ["src"], exclude: ["dist"], paths: { "@/*": ["src/*"] },
    });
    expect(data.resolverConfig).toEqual({ baseUrl: ".", paths: { "@/*": ["src/*"] } });
  });

  it("does not treat every JSON file as metadata and distinguishes documentation", () => {
    expect(classifyRepositoryFile("package.json")).toBe("metadata");
    expect(classifyRepositoryFile("packages/core/package.json")).toBe("metadata");
    expect(classifyRepositoryFile("node_modules/react/package.json")).toBe("other");
    expect(classifyRepositoryFile("dist/package.json")).toBe("other");
    expect(classifyRepositoryFile("tsconfig.json")).toBe("metadata");
    expect(classifyRepositoryFile("data/settings.json")).toBe("other");
    expect(classifyRepositoryFile("README.md")).toBe("documentation");
    expect(classifyRepositoryFile("src/index.ts")).toBe("source");
  });

  it("handles repositories with no metadata files", () => {
    const data = analyzeProjectMetadata([entry("README.md"), entry("src/index.ts")], {}, 500);
    expect(data.stats).toMatchObject({ metadataFilesDiscovered: 0, metadataFilesParsed: 0, metadataParsingFailures: 0 });
    expect(data.packageManifest).toBeNull();
    expect(data.tsConfigs).toEqual([]);
  });

  it("keeps fetch failures and size skips separate from parse failures", () => {
    const entries = [entry("package.json"), entry("tsconfig.json", 800)];
    const data = analyzeProjectMetadata(entries, { "package.json": { error: "404" } }, 500);
    expect(data.stats.metadataFetchFailures).toBe(1);
    expect(data.stats.metadataFilesNotProcessed).toBe(1);
    expect(data.outcomes.find((item) => item.path === "tsconfig.json")?.status).toBe("not-processed");
    expect(data.stats.metadataParsingFailures).toBe(0);
  });

  it("renders missing package fields consistently as Not declared", () => {
    const metadata = analyzeProjectMetadata([entry("package.json"), entry("tsconfig.json")], {
      "package.json": { content: '{"name":"bare"}' },
      "tsconfig.json": { content: '{"compilerOptions":{}}' },
    }, 500);
    const markup = renderToStaticMarkup(createElement(ProjectMetadataPanel, { metadata }));
    expect(markup).toContain("Not declared");
    expect(markup).not.toContain(">undefined<");
  });

  it("renders older saved analyses with metadata absent", () => {
    const markup = renderToStaticMarkup(createElement(ProjectMetadataPanel, {}));
    expect(markup).toContain("Not available for this saved analysis");
  });
});
