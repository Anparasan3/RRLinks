/**
 * Installs a built .vsix into a real, freshly-downloaded VS Code (via
 * @vscode/test-electron) and confirms it shows up in `--list-extensions`.
 * No display/xvfb needed — extension install/list run through VS Code's
 * headless CLI path, not the Electron GUI.
 *
 * Usage: bun scripts/verify-install.ts <path-to-vsix>
 */
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";
import { spawnSync } from "child_process";
import * as path from "path";
import pkg from "../package.json";

async function main(): Promise<void> {
  const vsixPath = process.argv[2];
  if (!vsixPath) {
    console.error("Usage: bun scripts/verify-install.ts <path-to-vsix>");
    process.exit(1);
  }

  const extensionId = `${pkg.publisher}.${pkg.name}`;
  const vscodeExecutablePath = await downloadAndUnzipVSCode();
  const [cliPath, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

  console.log(`Installing ${vsixPath} into a throwaway VS Code...`);
  const install = spawnSync(cliPath, [...cliArgs, "--install-extension", path.resolve(vsixPath), "--force"], {
    encoding: "utf-8",
  });
  console.log(install.stdout);
  if (install.status !== 0) {
    console.error(install.stderr);
    console.error(`Install failed (exit ${install.status}).`);
    process.exit(1);
  }

  const list = spawnSync(cliPath, [...cliArgs, "--list-extensions"], { encoding: "utf-8" });
  if (!list.stdout.toLowerCase().includes(extensionId.toLowerCase())) {
    console.error(`${extensionId} not found after install. Installed extensions:\n${list.stdout}`);
    process.exit(1);
  }

  console.log(`Verified: ${extensionId} installs correctly.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
