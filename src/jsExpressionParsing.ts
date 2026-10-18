/**
 * Generic, domain-agnostic helpers for picking apart JS call-expression text
 * (balanced parens, comma-separated arguments, string literals). Knows
 * nothing about routes — reusable for parsing any `name(arg, arg, ...)` call.
 */

export function findMatchingParen(str: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < str.length && str[i] !== quote) {
        if (str[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function splitTopLevelArgs(str: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  let inString: string | null = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      current += ch;
      if (ch === "\\") {
        current += str[++i] ?? "";
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      current += ch;
      continue;
    }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

export function parseStringLiteral(arg: string | undefined): string | null {
  if (!arg) return null;
  const m = /^(["'`])([\s\S]*)\1$/.exec(arg.trim());
  return m ? m[2] : null;
}
