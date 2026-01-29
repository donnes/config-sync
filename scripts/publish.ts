#!/usr/bin/env bun

import { $ } from "bun";

// 1. Validation
if (!process.env.NPM_TOKEN) {
  console.error("NPM_TOKEN is not set.");
  process.exit(1);
}

console.log("=== syncode publish ===\n");

// 2. Build
console.log("Running build...");
await $`bun run build`;

// 3. Publish to NPM
console.log("\nPublishing to NPM...");
try {
  await $`npm publish --access public --//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}`;
  console.log("NPM publish successful.");
} catch (_error) {
  console.error("NPM publish failed.");
  process.exit(1);
}

// 4. Read version for output
const pkg = await Bun.file("package.json").json();
console.log(`\nPublished ${pkg.name}@${pkg.version}`);
