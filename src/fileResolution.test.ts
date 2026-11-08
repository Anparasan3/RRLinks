import { test, expect, describe } from "bun:test";
import { isInside } from "./fileResolution";

describe("isInside", () => {
  test("is true for a file below the folder", () => {
    expect(isInside("/repo/apps/web/app/page.tsx", "/repo/apps/web")).toBe(true);
  });

  test("is false for a sibling folder sharing a name prefix", () => {
    expect(isInside("/repo/apps/web-admin/page.tsx", "/repo/apps/web")).toBe(false);
  });

  test("is false for the folder itself and for files outside it", () => {
    expect(isInside("/repo/apps/web", "/repo/apps/web")).toBe(false);
    expect(isInside("/repo/apps/rr/app/routes.ts", "/repo/apps/web")).toBe(false);
  });
});
