import { afterEach, describe, expect, it, vi } from "vitest";
import { clearContentAnalysisCache, extractImportsCached, hashFileContent } from "./contentAnalysisCache";
import { resolveAllImports } from "./dependencyResolver";

afterEach(clearContentAnalysisCache);

describe("content-addressed AST extraction cache", () => {
  it("reuses extraction for identical contents while restoring the importing path", async () => {
    const extract = vi.fn(async (importingFile: string) => [{
      importingFile, specifier: "@/shared", kind: "static" as const,
      importedSymbols: [], line: 1, column: 1, isTypeOnly: false,
    }]);
    const first = await extractImportsCached("src/one.ts", 'import "@/shared";', extract);
    const second = await extractImportsCached("src/two.ts", 'import "@/shared";', extract);
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(second.imports[0].importingFile).toBe("src/two.ts");
  });

  it("hashes content deterministically and keeps resolution dependent on revision config", async () => {
    const content = 'import "@/shared";';
    expect(await hashFileContent(content)).toBe(await hashFileContent(content));
    const extracted = [{ importingFile: "src/app.ts", specifier: "@/shared", kind: "static" as const, importedSymbols: [], line: 1, column: 1, isTypeOnly: false }];
    const index = ["src/app.ts", "src/shared.ts", "lib/shared.ts"];
    expect(resolveAllImports(extracted, index, { baseUrl: ".", paths: { "@/*": ["src/*"] } })[0].resolvedPath).toBe("src/shared.ts");
    expect(resolveAllImports(extracted, index, { baseUrl: ".", paths: { "@/*": ["lib/*"] } })[0].resolvedPath).toBe("lib/shared.ts");
  });

  it("does not reuse extraction across parser modes with different extensions", async () => {
    const extract = vi.fn(async (filePath: string) => [{
      importingFile: filePath, specifier: "./module", kind: "static" as const,
      importedSymbols: [], line: 1, column: 1, isTypeOnly: false,
    }]);
    await extractImportsCached("src/view.tsx", "same source", extract);
    const js = await extractImportsCached("src/view.jsx", "same source", extract);
    expect(js.cacheHit).toBe(false);
    expect(extract).toHaveBeenCalledTimes(2);
  });
});
