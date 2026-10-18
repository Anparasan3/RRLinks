import { test, expect, describe } from "bun:test";
import { findMatchingParen, splitTopLevelArgs, parseStringLiteral } from "./jsExpressionParsing";

describe("findMatchingParen", () => {
  test("finds the matching close paren", () => {
    const str = 'route("a", "b")';
    expect(findMatchingParen(str, 5)).toBe(str.length - 1);
  });

  test("skips parens inside string literals", () => {
    const str = 'route("a)", "b")';
    expect(findMatchingParen(str, 5)).toBe(str.length - 1);
  });

  test("returns -1 when unbalanced", () => {
    expect(findMatchingParen("route(", 5)).toBe(-1);
  });
});

describe("splitTopLevelArgs", () => {
  test("splits simple comma-separated args", () => {
    expect(splitTopLevelArgs('"a", "b"')).toEqual(['"a"', '"b"']);
  });

  test("keeps commas inside nested arrays together", () => {
    expect(splitTopLevelArgs('"a", ["b", "c"]')).toEqual(['"a"', '["b", "c"]']);
  });

  test("keeps commas inside string literals together", () => {
    expect(splitTopLevelArgs('"a,b", "c"')).toEqual(['"a,b"', '"c"']);
  });
});

describe("parseStringLiteral", () => {
  test("unwraps a double-quoted string", () => {
    expect(parseStringLiteral('"hello"')).toBe("hello");
  });

  test("unwraps a single-quoted string", () => {
    expect(parseStringLiteral("'hello'")).toBe("hello");
  });

  test("returns null for a non-string argument", () => {
    expect(parseStringLiteral("[1, 2]")).toBe(null);
  });
});
