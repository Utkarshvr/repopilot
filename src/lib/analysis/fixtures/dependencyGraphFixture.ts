import { resolveAllImports } from "../dependencyResolver";
import { buildDependencyGraph } from "../graphBuilder";
import type { ExtractedImport } from "@/types/analysis";

export const FIXTURE_FILE_PATHS = [
  "src/index.ts",
  "src/app.ts",
  "src/auth/authService.ts",
  "src/auth/authController.ts",
  "src/users/userService.ts",
  "src/users/userController.ts",
  "src/utils/logger.ts",
  "src/isolated.ts",
  "src/cycle/cycleA.ts",
  "src/cycle/cycleB.ts",
  "src/self.ts",
];

function imp(importingFile: string, specifier: string, line: number): ExtractedImport {
  return {
    importingFile,
    specifier,
    kind: "static",
    importedSymbols: [],
    line,
    column: 1,
    isTypeOnly: false,
  };
}

export function buildDependencyGraphFixture() {
  const imports: ExtractedImport[] = [
    imp("src/index.ts", "./app", 1),
    imp("src/index.ts", "./notFound", 2),
    imp("src/index.ts", "react", 3),
    imp("src/app.ts", "./auth/authController", 1),
    imp("src/app.ts", "./auth/authController", 2), // duplicate relationship
    imp("src/app.ts", "./users/userController", 3),
    imp("src/auth/authController.ts", "./authService", 1),
    imp("src/auth/authService.ts", "../utils/logger", 1),
    imp("src/users/userController.ts", "./userService", 1),
    imp("src/users/userService.ts", "../utils/logger", 1),
    imp("src/cycle/cycleA.ts", "./cycleB", 1),
    imp("src/cycle/cycleB.ts", "./cycleA", 1),
    imp("src/self.ts", "./self", 1),
  ];
  const resolvedImports = resolveAllImports(imports, FIXTURE_FILE_PATHS, null);
  const graph = buildDependencyGraph(FIXTURE_FILE_PATHS, resolvedImports, "fixture");
  return { graph, imports, resolvedImports };
}
