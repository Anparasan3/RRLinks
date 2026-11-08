import { test, expect, describe } from "bun:test";
import { appRouterSegments, pagesRouterSegments, compareSpecificity } from "./nextjsRoutes";
import { segmentsMatch, normalizeSegments, stripQueryAndHash } from "./routeMatching";

describe("appRouterSegments", () => {
  test("maps a route handler to its URL path", () => {
    expect(appRouterSegments("api/analytics/summary/route.ts")).toEqual(["api", "analytics", "summary"]);
  });

  test("maps a page to its URL path", () => {
    expect(appRouterSegments("dashboard/settings/page.tsx")).toEqual(["dashboard", "settings"]);
  });

  test("maps the root page to the empty path", () => {
    expect(appRouterSegments("page.tsx")).toEqual([]);
  });

  test("converts dynamic and catch-all folders", () => {
    expect(appRouterSegments("api/users/[id]/route.ts")).toEqual(["api", "users", ":id"]);
    expect(appRouterSegments("docs/[...slug]/page.tsx")).toEqual(["docs", "*"]);
    expect(appRouterSegments("shop/[[...slug]]/page.tsx")).toEqual(["shop", "*"]);
  });

  test("drops route groups and parallel slots", () => {
    expect(appRouterSegments("(marketing)/about/page.tsx")).toEqual(["about"]);
    expect(appRouterSegments("dashboard/@team/page.tsx")).toEqual(["dashboard"]);
  });

  test("skips private folders and intercepting routes", () => {
    expect(appRouterSegments("_components/page.tsx")).toBeNull();
    expect(appRouterSegments("feed/(..)photo/[id]/page.tsx")).toBeNull();
  });

  test("ignores non-routable files", () => {
    expect(appRouterSegments("dashboard/layout.tsx")).toBeNull();
    expect(appRouterSegments("api/utils.ts")).toBeNull();
  });

  test("accepts Windows separators", () => {
    expect(appRouterSegments("api\\health\\route.js")).toEqual(["api", "health"]);
  });
});

describe("pagesRouterSegments", () => {
  test("maps an API file to its URL path", () => {
    expect(pagesRouterSegments("api/analytics/summary.ts")).toEqual(["api", "analytics", "summary"]);
  });

  test("maps index files to their folder", () => {
    expect(pagesRouterSegments("api/users/index.ts")).toEqual(["api", "users"]);
    expect(pagesRouterSegments("index.tsx")).toEqual([]);
  });

  test("converts dynamic segments", () => {
    expect(pagesRouterSegments("api/users/[id].ts")).toEqual(["api", "users", ":id"]);
    expect(pagesRouterSegments("blog/[...slug].tsx")).toEqual(["blog", "*"]);
  });

  test("skips special, declaration and test files", () => {
    expect(pagesRouterSegments("_app.tsx")).toBeNull();
    expect(pagesRouterSegments("_document.tsx")).toBeNull();
    expect(pagesRouterSegments("types.d.ts")).toBeNull();
    expect(pagesRouterSegments("api/users.test.ts")).toBeNull();
    expect(pagesRouterSegments("styles.css")).toBeNull();
  });
});

describe("compareSpecificity", () => {
  test("ranks a static segment ahead of a dynamic one", () => {
    const routes = [["api", "users", ":id"], ["api", "users", "me"]];
    routes.sort(compareSpecificity);
    expect(routes[0]).toEqual(["api", "users", "me"]);
  });

  test("ranks an exact path ahead of a catch-all", () => {
    const routes = [["files", "*"], ["files"]];
    routes.sort(compareSpecificity);
    expect(routes[0]).toEqual(["files"]);
  });
});

describe("matching a fetch() string against Next.js routes", () => {
  test("links '/api/analytics/summary' to the app router handler", () => {
    const pattern = appRouterSegments("api/analytics/summary/route.ts")!;
    expect(segmentsMatch(pattern, normalizeSegments("/api/analytics/summary"))).toBe(true);
  });

  test("ignores the query string and hash", () => {
    const pattern = appRouterSegments("api/analytics/summary/route.ts")!;
    const literal = normalizeSegments(stripQueryAndHash("/api/analytics/summary?range=7d#top"));
    expect(segmentsMatch(pattern, literal)).toBe(true);
  });
});
