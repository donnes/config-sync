/**
 * Config migration system
 */

import * as p from "@clack/prompts";
import type { Platform } from "../adapters/types";
import { detectInstalledAgents, getAgentMetadata } from "../agents/metadata";
import { getConfig, setConfig } from "./manager";
import type { GlobalConfig } from "./types";

export async function checkAndMigrateConfig(
  silent: boolean = false,
): Promise<void> {
  try {
    const config = getConfig();
    const platform = getPlatform();
    const missing = findMissingConfigs(config, platform);

    if (missing.length === 0) {
      return;
    }

    if (silent) {
      return;
    }

    const names = missing
      .map((id) => getAgentMetadata(id)?.displayName || id)
      .join(", ");

    const shouldAdd = await p.confirm({
      message: `New config available: ${names}. Add to your config?`,
      initialValue: false,
    });

    if (p.isCancel(shouldAdd) || !shouldAdd) {
      return;
    }

    config.agents = [...config.agents, ...missing];
    setConfig(config);

    p.log.success(`✓ Added ${names} to your config`);
    p.log.info(`Run 'syncode sync' to import configs to your repo`);
  } catch {
    return;
  }
}

function findMissingConfigs(
  config: GlobalConfig,
  platform: Platform,
): string[] {
  const installedAgents = detectInstalledAgents(platform);
  return installedAgents.filter((id) => !config.agents.includes(id));
}

export function hasNewConfigsAvailable(): boolean {
  try {
    const config = getConfig();
    const missing = findMissingConfigs(config, getPlatform());
    return missing.length > 0;
  } catch {
    return false;
  }
}

export function getNewConfigsAvailable(): string[] {
  try {
    const config = getConfig();
    return findMissingConfigs(config, getPlatform());
  } catch {
    return [];
  }
}

function getPlatform(): Platform {
  if (process.platform === "darwin") {
    return "macos";
  }
  if (process.platform === "win32") {
    return "windows";
  }
  return "linux";
}
