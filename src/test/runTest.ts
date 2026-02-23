import * as path from "node:path";
import * as fs from "node:fs/promises";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  try {
    // In some shells this variable leaks in and breaks vscode test host startup.
    delete process.env.ELECTRON_RUN_AS_NODE;
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    await runWithRetry(extensionDevelopmentPath, extensionTestsPath);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to run tests", error);
    process.exit(1);
  }
}

void main();

async function runWithRetry(
  extensionDevelopmentPath: string,
  extensionTestsPath: string
): Promise<void> {
  try {
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldRetry =
      message.includes("currently being updated") || message.includes("Test run failed with code");
    if (!shouldRetry) {
      throw error;
    }

    const testRuntimeDir = path.resolve(extensionDevelopmentPath, ".vscode-test");
    await fs.rm(testRuntimeDir, { recursive: true, force: true });
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  }
}
