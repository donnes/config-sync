/**
 * Sync agent configs between system and repository
 */

import * as p from "@clack/prompts";
import { adapterRegistry } from "../adapters/registry";
import type { Platform } from "../adapters/types";
import { getConfig } from "../config/manager";
import { checkAndMigrateConfig } from "../config/migrations";
import type { GlobalConfig } from "../config/types";

export async function syncCommand() {
  p.intro("Sync Agent Configs");

  await checkAndMigrateConfig();

  let config: GlobalConfig;
  try {
    config = getConfig();
  } catch (_error) {
    p.cancel(
      "Configuration not found. Run 'syncode new' or 'syncode init' first.",
    );
    return;
  }

  if (config.agents.length === 0) {
    p.cancel(
      "No agents configured. Run 'syncode new' or 'syncode init' to set up agents.",
    );
    return;
  }

  // Select direction
  const direction = await p.select({
    message: "Sync direction",
    options: [
      {
        value: "import",
        label: "Import (system → repo)",
        hint: "Copy configs from system to repo",
      },
      {
        value: "export",
        label: "Export (repo → system)",
        hint: "Sync configs from repo to system",
      },
    ],
  });

  if (p.isCancel(direction)) {
    p.cancel("Cancelled");
    return;
  }

  const platform: Platform =
    process.platform === "darwin"
      ? "macos"
      : process.platform === "win32"
        ? "windows"
        : "linux";

  const agentOptions = config.agents.map((agentId) => {
    const adapter = adapterRegistry.get(agentId);
    const label = adapter?.name || agentId;
    return {
      value: agentId,
      label,
      hint: adapter ? undefined : "No adapter found",
    };
  });

  const selectedAgents = await p.multiselect({
    message: `Select agents to ${direction === "import" ? "import" : "export"}`,
    options: agentOptions,
    initialValues: config.agents,
    required: false,
  });

  if (p.isCancel(selectedAgents)) {
    p.cancel("Cancelled");
    return;
  }

  if ((selectedAgents as string[]).length === 0) {
    p.cancel("No agents selected");
    return;
  }

  const s = p.spinner();
  s.start(
    `${direction === "import" ? "Importing" : "Exporting"} ${(selectedAgents as string[]).length} agent(s)`,
  );

  const repoPath = config.repoPath.startsWith("~")
    ? config.repoPath.replace("~", process.env.HOME || "")
    : config.repoPath;

  let successCount = 0;
  let failCount = 0;

  for (const agentId of selectedAgents as string[]) {
    const adapter = adapterRegistry.get(agentId);
    if (!adapter) {
      s.message(`Warning: Adapter not found for ${agentId}`);
      failCount++;
      continue;
    }

    const systemPath = adapter.getConfigPath(platform);
    const agentRepoPath = adapter.getRepoPath(repoPath);

    try {
      if (direction === "import") {
        const result = await adapter.import(systemPath, agentRepoPath);
        if (result.success) {
          s.message(`✓ Imported ${adapter.name}`);
          successCount++;
        } else {
          s.message(`✗ Failed to import ${adapter.name}: ${result.message}`);
          failCount++;
        }
      } else {
        const result = await adapter.export(agentRepoPath, systemPath);
        if (result.success) {
          s.message(`✓ Exported ${adapter.name}`);
          successCount++;
        } else {
          s.message(`✗ Failed to export ${adapter.name}: ${result.message}`);
          failCount++;
        }
      }
    } catch (error) {
      s.message(`✗ Error syncing ${adapter.name}: ${error}`);
      failCount++;
    }
  }

  s.stop(`Sync complete: ${successCount} succeeded, ${failCount} failed`);

  p.outro(
    direction === "import"
      ? "Configs imported to repository. Commit and push to sync across machines."
      : "Configs exported to system. Your agents are now synced!",
  );
}
