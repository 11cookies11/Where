import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  test("Extension should be present", async () => {
    const extension = vscode.extensions.getExtension("11cookies11.where-progress");
    assert.ok(extension, "Extension not found");
  });

  test("Where commands should be registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    const required = [
      "where.initializeSourceFile",
      "where.initSourceFile",
      "where.openSourceFile",
      "where.archiveCurrentPlan",
      "where.queryPlanHistory",
      "where.writeTaskToSource",
      "where.cycleTaskStatus",
      "where.setTaskStatus",
      "where.renameTask",
      "where.deleteTask",
      "where.promoteTask",
      "where.demoteTask",
      "where.validateSource",
      "where.openDashboard",
      "where.refreshProgress"
    ];
    for (const command of required) {
      assert.ok(commands.includes(command), `Command ${command} is not registered`);
    }
  });
});
