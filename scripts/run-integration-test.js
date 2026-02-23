/* eslint-disable no-console */
const { spawnSync } = require("node:child_process");

const isWindows = process.platform === "win32";
const force = process.env.FORCE_INTEGRATION_TESTS === "1";

if (isWindows && !force) {
  console.log("Skipping integration tests on Windows by default.");
  console.log("Set FORCE_INTEGRATION_TESTS=1 to force execution.");
  process.exit(0);
}

const result = spawnSync("node", ["./out/test/runTest.js"], {
  stdio: "inherit",
  shell: true
});

process.exit(result.status ?? 1);
