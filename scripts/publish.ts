#!/usr/bin/env bun

import { $ } from "bun";
import { writeFile } from "node:fs/promises";

// 1. Validation
const bump = process.env.BUMP;
if (!bump || !["patch", "minor", "major"].includes(bump)) {
  console.error("Missing BUMP env. Use patch, minor, or major.");
  process.exit(1);
}

if (!process.env.NPM_TOKEN) {
  console.error("NPM_TOKEN is not set.");
  process.exit(1);
}

// 2. Version Calculation
const pkgFile = Bun.file("package.json");
const pkg = await pkgFile.json();
const currentVersion = pkg.version;

const [major, minor, patch] = currentVersion.split(".").map(Number);
const newVersion = (() => {
  switch (bump) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      return currentVersion;
  }
})();

console.log(`Bumping ${currentVersion} -> ${newVersion}`);

// 3. Update Files
pkg.version = newVersion;
await writeFile("package.json", JSON.stringify(pkg, null, 2) + "\n");

// 4. Build
console.log("Running build...");
await $`bun run build`;

// 5. Publish using CLI flag for authentication
console.log("Publishing to NPM...");
try {
  // We pass the token directly to the publish command
  await $`npm publish --access public --//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}`;
  console.log("NPM publish successful.");
} catch (error) {
  console.error("NPM publish failed.");
  process.exit(1);
}

// 6. GitHub Outputs
const tag = `v${newVersion}`;
if (process.env.GITHUB_OUTPUT) {
  await writeFile(
    process.env.GITHUB_OUTPUT,
    `version=${newVersion}\ntag=${tag}\n`,
    { flag: "a" },
  );
}

console.log(`Process complete for ${tag}`);
