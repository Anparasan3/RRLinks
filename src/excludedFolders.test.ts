import { test, expect, describe } from "bun:test";
import { DEFAULT_EXCLUDED_FOLDERS, excludeGlob, isInExcludedFolder } from "./excludedFolders";

const ws = "/repo";

describe("isInExcludedFolder", () => {
  test("skips files in dependency, build and generated folders", () => {
    for (const p of [
      "/repo/node_modules/react-router/dist/index.js",
      "/repo/build/server/routes.js",
      "/repo/dist/app.js",
      "/repo/.next/server/app/page.js",
      "/repo/.react-router/types/app/+types/root.ts",
      "/repo/apps/web/.next/cache/x.js",
    ]) {
      expect(isInExcludedFolder(p, ws, DEFAULT_EXCLUDED_FOLDERS)).toBe(true);
    }
  });

  test("keeps normal source files", () => {
    expect(isInExcludedFolder("/repo/app/routes.ts", ws, DEFAULT_EXCLUDED_FOLDERS)).toBe(false);
    expect(isInExcludedFolder("/repo/src/components/Nav.tsx", ws, DEFAULT_EXCLUDED_FOLDERS)).toBe(false);
  });

  test("only matches whole folder names, not file names or prefixes", () => {
    expect(isInExcludedFolder("/repo/app/build.ts", ws, DEFAULT_EXCLUDED_FOLDERS)).toBe(false);
    expect(isInExcludedFolder("/repo/app/builder/page.tsx", ws, DEFAULT_EXCLUDED_FOLDERS)).toBe(false);
  });

  test("ignores excluded names above the workspace root", () => {
    expect(isInExcludedFolder("/home/me/build/repo/app/routes.ts", "/home/me/build/repo", DEFAULT_EXCLUDED_FOLDERS)).toBe(false);
  });

  test("honours custom folders", () => {
    expect(isInExcludedFolder("/repo/generated/api.ts", ws, ["generated"])).toBe(true);
  });
});

describe("excludeGlob", () => {
  test("builds one brace glob from the folder names", () => {
    expect(excludeGlob(["node_modules", ".next"])).toBe("**/{node_modules,.next}/**");
    expect(excludeGlob(["dist"])).toBe("**/dist/**");
  });

  test("drops unsafe names and falls back to node_modules", () => {
    expect(excludeGlob(["a,b", "c/d", "{x}"])).toBe("**/node_modules/**");
    expect(excludeGlob(["dist", "bad*name"])).toBe("**/dist/**");
  });
});
