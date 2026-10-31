import ts from "typescript";
import type { ExtractedImport, ImportKind } from "@/types/analysis";

function posToLineColumn(
  sourceFile: ts.SourceFile,
  pos: number,
): { line: number; column: number } {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return { line: line + 1, column: character + 1 };
}

function collectNamedBindings(
  namedBindings: ts.NamedImportBindings | undefined,
): string[] {
  if (!namedBindings) return [];
  if (ts.isNamespaceImport(namedBindings)) {
    return [`* as ${namedBindings.name.text}`];
  }
  if (ts.isNamedImports(namedBindings)) {
    return namedBindings.elements.map((el) =>
      el.propertyName
        ? `${el.propertyName.text} as ${el.name.text}`
        : el.name.text,
    );
  }
  return [];
}

function extractFromImportDeclaration(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  importingFile: string,
): ExtractedImport | null {
  if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
    return null;
  }

  const specifier = node.moduleSpecifier.text;
  const { line, column } = posToLineColumn(sourceFile, node.getStart(sourceFile));
  const isTypeOnly = node.importClause?.isTypeOnly === true;
  const symbols: string[] = [];

  if (node.importClause?.name) {
    symbols.push(node.importClause.name.text);
  }
  symbols.push(...collectNamedBindings(node.importClause?.namedBindings));

  const kind: ImportKind = isTypeOnly ? "import-type" : "static";

  return {
    importingFile,
    specifier,
    kind,
    importedSymbols: symbols,
    line,
    column,
    isTypeOnly,
  };
}

function extractFromExportDeclaration(
  node: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
  importingFile: string,
): ExtractedImport | null {
  if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
    return null;
  }

  const specifier = node.moduleSpecifier.text;
  const { line, column } = posToLineColumn(sourceFile, node.getStart(sourceFile));
  const isTypeOnly = node.isTypeOnly === true;

  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    const symbols = node.exportClause.elements.map((el) =>
      el.propertyName
        ? `${el.propertyName.text} as ${el.name.text}`
        : el.name.text,
    );
    return {
      importingFile,
      specifier,
      kind: "export-named",
      importedSymbols: symbols,
      line,
      column,
      isTypeOnly,
    };
  }

  // export * from "./mod"
  return {
    importingFile,
    specifier,
    kind: "export-star",
    importedSymbols: ["*"],
    line,
    column,
    isTypeOnly,
  };
}

function extractDynamicImport(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  importingFile: string,
): ExtractedImport | null {
  if (node.expression.kind !== ts.SyntaxKind.ImportKeyword) return null;
  const arg = node.arguments[0];
  if (!arg || !ts.isStringLiteralLike(arg)) return null;

  const { line, column } = posToLineColumn(sourceFile, node.getStart(sourceFile));
  return {
    importingFile,
    specifier: arg.text,
    kind: "dynamic",
    importedSymbols: [],
    line,
    column,
    isTypeOnly: false,
  };
}

function extractRequire(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  importingFile: string,
): ExtractedImport | null {
  if (!ts.isIdentifier(node.expression) || node.expression.text !== "require") {
    return null;
  }
  const arg = node.arguments[0];
  if (!arg || !ts.isStringLiteralLike(arg)) return null;

  const { line, column } = posToLineColumn(sourceFile, node.getStart(sourceFile));
  return {
    importingFile,
    specifier: arg.text,
    kind: "require",
    importedSymbols: [],
    line,
    column,
    isTypeOnly: false,
  };
}

function scriptKindForPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.JS;
}

/**
 * Extract import-like dependencies from a JS/TS source file using the
 * TypeScript Compiler API (AST), not regex.
 */
export function extractImportsFromSource(
  filePath: string,
  content: string,
): ExtractedImport[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(filePath),
  );

  const diagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    const first = diagnostics[0];
    const message = ts.flattenDiagnosticMessageText(first.messageText, " ");
    throw new Error(`Syntax parse failed at diagnostic ${first.code}: ${message}`);
  }

  const results: ExtractedImport[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const extracted = extractFromImportDeclaration(node, sourceFile, filePath);
      if (extracted) results.push(extracted);
    } else if (ts.isExportDeclaration(node)) {
      const extracted = extractFromExportDeclaration(node, sourceFile, filePath);
      if (extracted) results.push(extracted);
    } else if (ts.isCallExpression(node)) {
      const dynamic = extractDynamicImport(node, sourceFile, filePath);
      if (dynamic) results.push(dynamic);
      const required = extractRequire(node, sourceFile, filePath);
      if (required) results.push(required);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return results;
}
