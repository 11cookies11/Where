import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  try {
    // In some shells this variable leaks in and breaks vscode test host startup.
    delete process.env.ELECTRON_RUN_AS_NODE;
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to run tests", error);
    process.exit(1);
  }
}

void main();
