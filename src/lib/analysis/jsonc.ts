/** Strip JSONC comments without damaging comment markers inside strings. */
export function stripJsoncComments(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const current = input[i];
    const next = input[i + 1];

    if (inString) {
      output += current;
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') inString = false;
      continue;
    }

    if (current === '"') {
      inString = true;
      output += current;
      continue;
    }
    if (current === "/" && next === "/") {
      i += 2;
      while (i < input.length && input[i] !== "\n" && input[i] !== "\r") i++;
      output += input[i] ?? "";
      continue;
    }
    if (current === "/" && next === "*") {
      i += 2;
      let closed = false;
      while (i < input.length) {
        if (input[i] === "*" && input[i + 1] === "/") {
          i++;
          closed = true;
          break;
        }
        if (input[i] === "\n" || input[i] === "\r") output += input[i];
        i++;
      }
      if (!closed) throw new SyntaxError("Unterminated JSONC block comment.");
      continue;
    }
    output += current;
  }

  return removeTrailingCommas(output);
}

function removeTrailingCommas(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const current = input[i];
    if (inString) {
      output += current;
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') inString = false;
      continue;
    }
    if (current === '"') {
      inString = true;
      output += current;
      continue;
    }
    if (current === ",") {
      let next = i + 1;
      while (/\s/.test(input[next] ?? "")) next++;
      if (input[next] === "}" || input[next] === "]") continue;
    }
    output += current;
  }
  return output;
}

export function parseJsonc(input: string): unknown {
  return JSON.parse(stripJsoncComments(input)) as unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
