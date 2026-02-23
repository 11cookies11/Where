import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  test("Extension should be present", async () => {
    const extension = vscode.extensions.getExtension("local.where-progress");
    assert.ok(extension, "Extension not found");
  });

  test("Where commands should be registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    const required = [
      "where.initializeSourceFile",
      "where.openSourceFile",
      "where.writeTaskToSource",
      "where.openDashboard",
      "where.refreshProgress"
    ];
    for (const command of required) {
      assert.ok(commands.includes(command), `Command ${command} is not registered`);
    }
  });
});
