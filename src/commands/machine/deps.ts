import { join } from "node:path";
import * as p from "@clack/prompts";
import { getConfig } from "../../config/manager";
import { exists } from "../../utils/fs";
import { contractHome, expandHome } from "../../utils/paths";
import { getPlatformName } from "../../utils/platform";
import { execLive } from "../../utils/shell";

export async function machineDepsCommand() {
  p.intro("Machine Dependencies");

  let repoPath: string;
  try {
    const config = getConfig();
    repoPath = expandHome(config.repoPath);
  } catch (_error) {
    p.cancel(
      "Configuration not found. Run 'syncode new' or 'syncode init' first.",
    );
    return;
  }

  p.log.info(`Platform: ${getPlatformName()}`);
  p.log.info(`Repository: ${contractHome(repoPath)}`);

  if (!exists(repoPath)) {
    p.cancel("Repository path not found.");
    return;
  }

  const installScriptPath = resolveInstallScript(repoPath);

  if (!installScriptPath) {
    p.log.warning("install.sh not found in repo root.");
    p.log.info(
      "Create an install.sh script or run 'syncode init' to generate one.",
    );
    return;
  }

  const confirm = await p.confirm({
    message: `Run ${contractHome(installScriptPath)}?`,
    initialValue: true,
  });

  if (p.isCancel(confirm) || !confirm) {
    return;
  }

  const spinner = p.spinner();
  spinner.start("Running install script...");

  const success = await execLive(`bash "${installScriptPath}"`);

  if (success) {
    spinner.stop("Install script completed");
    p.log.success("Dependencies installed successfully");
  } else {
    spinner.stop("Install script had errors");
  }

  p.outro("Done");
}

function resolveInstallScript(repoPath: string): string | null {
  const candidates = ["install.sh"];

  for (const candidate of candidates) {
    const fullPath = join(repoPath, candidate);
    if (exists(fullPath)) {
      return fullPath;
    }
  }
  return null;
}
