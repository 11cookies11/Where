/* eslint-disable no-console */
const { spawnSync } = require("node:child_process");

const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";
const force = process.env.FORCE_INTEGRATION_TESTS === "1";

if (isWindows && !force) {
  console.log("Skipping integration tests on Windows by default.");
  console.log("Set FORCE_INTEGRATION_TESTS=1 to force execution.");
  process.exit(0);
}

const hasDisplay = Boolean(process.env.DISPLAY);
const useXvfb = isLinux && !hasDisplay;

const command = useXvfb ? "xvfb-run" : "node";
const args = useXvfb
  ? ["-a", "node", "./out/test/runTest.js"]
  : ["./out/test/runTest.js"];

if (useXvfb) {
  console.log("No DISPLAY detected on Linux; running integration tests with xvfb-run.");
}

const result = spawnSync(command, args, { stdio: "inherit" });

process.exit(result.status ?? 1);
