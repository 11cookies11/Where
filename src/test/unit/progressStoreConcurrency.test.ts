import * as assert from "node:assert";
import { isSameMtime } from "../../fileVersion";

suite("Progress Store Concurrency Unit Tests", () => {
  test("treats near-identical mtime values as same", () => {
    assert.strictEqual(isSameMtime(1000.1, 1000.4), true);
  });

  test("detects mtime drift", () => {
    assert.strictEqual(isSameMtime(1000.1, 1001.0), false);
  });
});
