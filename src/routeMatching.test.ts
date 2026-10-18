import { test, expect, describe } from "bun:test";
import { looksLikeRoutePath, looksLikeUrlPath, normalizeSegments, segmentsMatch } from "./routeMatching";

describe("looksLikeRoutePath", () => {
  const extensions = [".tsx", ".ts", ".jsx", ".js"];

  test("accepts a plain file path ending in a known extension", () => {
    expect(looksLikeRoutePath("routes/home.tsx", extensions)).toBe(true);
  });

  test("rejects a dynamic template literal", () => {
    expect(looksLikeRoutePath("routes/${name}.tsx", extensions)).toBe(false);
  });

  test("rejects an http(s) URL", () => {
    expect(looksLikeRoutePath("https://example.com/foo.tsx", extensions)).toBe(false);
  });

  test("rejects a value without a known extension", () => {
    expect(looksLikeRoutePath("routes/home", extensions)).toBe(false);
  });
});

describe("looksLikeUrlPath", () => {
  test("accepts an absolute path", () => {
    expect(looksLikeUrlPath("/api/chat/settings")).toBe(true);
  });

  test("accepts a path with a param placeholder", () => {
    expect(looksLikeUrlPath("/api/someroute/:someId/some")).toBe(true);
  });

  test("rejects a relative-looking string", () => {
    expect(looksLikeUrlPath("api/chat/settings")).toBe(false);
  });

  test("rejects an http(s) URL", () => {
    expect(looksLikeUrlPath("https://example.com/api")).toBe(false);
  });

  test("rejects a dynamic template literal", () => {
    expect(looksLikeUrlPath("/api/${id}/some")).toBe(false);
  });

  test("rejects a string with spaces", () => {
    expect(looksLikeUrlPath("/not a path")).toBe(false);
  });
});

describe("normalizeSegments", () => {
  test("splits a path into non-empty segments", () => {
    expect(normalizeSegments("/api/chat/settings/")).toEqual(["api", "chat", "settings"]);
  });

  test("returns an empty array for the root path", () => {
    expect(normalizeSegments("/")).toEqual([]);
  });
});

describe("segmentsMatch", () => {
  test("matches identical static segments", () => {
    expect(segmentsMatch(["api", "chat", "settings"], ["api", "chat", "settings"])).toBe(true);
  });

  test("matches a dynamic segment against any literal value", () => {
    expect(segmentsMatch(["api", "someroute", ":someId", "some"], ["api", "someroute", "123", "some"])).toBe(true);
  });

  test("matches a dynamic segment against its own placeholder", () => {
    expect(segmentsMatch(["api", "someroute", ":someId", "some"], ["api", "someroute", ":someId", "some"])).toBe(true);
  });

  test("rejects a different static segment", () => {
    expect(segmentsMatch(["api", "chat", "settings"], ["api", "chat", "other"])).toBe(false);
  });

  test("rejects a different segment count", () => {
    expect(segmentsMatch(["api", "chat"], ["api", "chat", "settings"])).toBe(false);
  });

  test("matches a trailing splat against any remainder", () => {
    expect(segmentsMatch(["files", "*"], ["files", "a", "b", "c"])).toBe(true);
  });
});
