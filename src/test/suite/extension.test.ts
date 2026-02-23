import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  test("Extension should be present", async () => {
    const extension = vscode.extensions.getExtension("local.where-progress");
    assert.ok(extension, "Extension not found");
  });

  test("Source initialization command should be registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("where.initializeSourceFile"),
      "Command where.initializeSourceFile is not registered"
    );
  });
});
