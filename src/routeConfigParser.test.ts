import { test, expect, describe } from "bun:test";
import { joinRoutePath, parseRoutesConfig } from "./routeConfigParser";

describe("joinRoutePath", () => {
  test("joins two segments with a single slash", () => {
    expect(joinRoutePath("api", "chat")).toBe("api/chat");
  });

  test("strips redundant leading/trailing slashes", () => {
    expect(joinRoutePath("/api/", "/chat/")).toBe("api/chat");
  });

  test("drops empty segments", () => {
    expect(joinRoutePath("", "chat")).toBe("chat");
    expect(joinRoutePath("api", "")).toBe("api");
  });
});

describe("parseRoutesConfig", () => {
  test("parses a flat route() and index()", () => {
    const source = `
      export default [
        index("routes/home.tsx"),
        route("about", "routes/about.tsx"),
      ];
    `;
    expect(parseRoutesConfig(source)).toEqual([
      { pattern: "", file: "routes/home.tsx" },
      { pattern: "about", file: "routes/about.tsx" },
    ]);
  });

  test("joins prefix() onto its children's paths", () => {
    const source = `
      export default [
        ...prefix("api", [
          route("someroute/:someId/some", "routes/api/someroute.tsx"),
        ]),
      ];
    `;
    expect(parseRoutesConfig(source)).toEqual([
      { pattern: "api/someroute/:someId/some", file: "routes/api/someroute.tsx" },
    ]);
  });

  test("layout() contributes no path segment but nests its children", () => {
    const source = `
      export default [
        layout("routes/layout.tsx", [
          route("dashboard", "routes/dashboard.tsx"),
        ]),
      ];
    `;
    expect(parseRoutesConfig(source)).toEqual([
      { pattern: "", file: "routes/layout.tsx" },
      { pattern: "dashboard", file: "routes/dashboard.tsx" },
    ]);
  });

  test("handles routes with an options object before children", () => {
    const source = `
      export default [
        route("about", "routes/about.tsx", { id: "about" }, [
          index("routes/about.index.tsx"),
        ]),
      ];
    `;
    expect(parseRoutesConfig(source)).toEqual([
      { pattern: "about", file: "routes/about.tsx" },
      { pattern: "about", file: "routes/about.index.tsx" },
    ]);
  });
});
