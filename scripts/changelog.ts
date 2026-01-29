#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { createOpencode } from "@opencode-ai/sdk";
import { $ } from "bun";

export const team = ["donnes", "actions-user"];

export async function getLatestRelease() {
  return fetch("https://api.github.com/repos/donnes/syncode/releases/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    })
    .then((data: { tag_name: string }) => data.tag_name.replace(/^v/, ""));
}

type Commit = {
  hash: string;
  author: string | null;
  message: string;
};

export async function getCommits(from: string, to: string): Promise<Commit[]> {
  const fromRef = from.startsWith("v") ? from : `v${from}`;
  const toRef = to === "HEAD" ? to : to.startsWith("v") ? to : `v${to}`;

  // Get commit data with GitHub usernames from the API
  const compare =
    await $`gh api "/repos/donnes/syncode/compare/${fromRef}...${toRef}" --jq '.commits[] | {sha: .sha, login: .author.login, message: .commit.message}'`.text();

  const commitData = new Map<
    string,
    { login: string | null; message: string }
  >();
  for (const line of compare.split("\n").filter(Boolean)) {
    const data = JSON.parse(line) as {
      sha: string;
      login: string | null;
      message: string;
    };
    commitData.set(data.sha, {
      login: data.login,
      message: data.message.split("\n")[0] ?? "",
    });
  }

  // Get commits from the range
  const log =
    await $`git log ${fromRef}..${toRef} --oneline --format="%H"`.text();
  const hashes = log.split("\n").filter(Boolean);

  const commits: Commit[] = [];
  for (const hash of hashes) {
    const data = commitData.get(hash);
    if (!data) continue;

    const message = data.message;
    if (message.match(/^(ignore:|test:|chore:|ci:|release:)/i)) continue;

    commits.push({
      hash: hash.slice(0, 7),
      author: data.login,
      message,
    });
  }

  return filterRevertedCommits(commits);
}

function filterRevertedCommits(commits: Commit[]): Commit[] {
  const revertPattern = /^Revert "(.+)"$/;
  const seen = new Map<string, Commit>();

  for (const commit of commits) {
    const match = commit.message.match(revertPattern);
    if (match) {
      const original = match[1]!;
      if (seen.has(original)) seen.delete(original);
      else seen.set(commit.message, commit);
    } else {
      const revertMsg = `Revert "${commit.message}"`;
      if (seen.has(revertMsg)) seen.delete(revertMsg);
      else seen.set(commit.message, commit);
    }
  }

  return [...seen.values()];
}

async function summarizeCommit(
  opencode: Awaited<ReturnType<typeof createOpencode>>,
  message: string,
): Promise<string> {
  console.log("summarizing commit:", message);
  const session = await opencode.client.session.create();
  const result = await opencode.client.session
    .prompt({
      path: { id: session.data!.id },
      body: {
        model: { providerID: "opencode", modelID: "claude-sonnet-4-5" },
        tools: {
          "*": false,
        },
        parts: [
          {
            type: "text",
            text: `Summarize this commit message for a changelog entry. Return ONLY a single line summary starting with a capital letter. Be concise but specific. If the commit message is already well-written, just clean it up (capitalize, fix typos, proper grammar). Do not include any prefixes like "fix:" or "feat:".

Commit: ${message}`,
          },
        ],
      },
      signal: AbortSignal.timeout(120_000),
    })
    .then(
      (x) => x.data?.parts?.find((y) => y.type === "text")?.text ?? message,
    );
  return result.trim();
}

export async function generateChangelog(
  commits: Commit[],
  opencode: Awaited<ReturnType<typeof createOpencode>>,
) {
  // Summarize commits in parallel with max 10 concurrent requests
  const BATCH_SIZE = 10;
  const summaries: string[] = [];
  for (let i = 0; i < commits.length; i += BATCH_SIZE) {
    const batch = commits.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((c) => summarizeCommit(opencode, c.message)),
    );
    summaries.push(...results);
  }

  const lines: string[] = [];
  lines.push("## Changes");

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i]!;
    const attribution =
      commit.author && !team.includes(commit.author)
        ? ` (@${commit.author})`
        : "";
    lines.push(`- ${summaries[i]}${attribution}`);
  }

  return lines;
}

export async function getContributors(from: string, to: string) {
  const fromRef = from.startsWith("v") ? from : `v${from}`;
  const toRef = to === "HEAD" ? to : to.startsWith("v") ? to : `v${to}`;
  const compare =
    await $`gh api "/repos/donnes/syncode/compare/${fromRef}...${toRef}" --jq '.commits[] | {login: .author.login, message: .commit.message}'`.text();
  const contributors = new Map<string, Set<string>>();

  for (const line of compare.split("\n").filter(Boolean)) {
    const { login, message } = JSON.parse(line) as {
      login: string | null;
      message: string;
    };
    const title = message.split("\n")[0] ?? "";
    if (title.match(/^(ignore:|test:|chore:|ci:|release:)/i)) continue;

    if (login && !team.includes(login)) {
      if (!contributors.has(login)) contributors.set(login, new Set());
      contributors.get(login)!.add(title);
    }
  }

  return contributors;
}

export async function buildNotes(from: string, to: string) {
  const commits = await getCommits(from, to);

  if (commits.length === 0) {
    return [];
  }

  console.log("generating changelog since " + from);

  const opencode = await createOpencode({ port: 5044 });
  const notes: string[] = [];

  try {
    const lines = await generateChangelog(commits, opencode);
    notes.push(...lines);
    console.log("---- Generated Changelog ----");
    console.log(notes.join("\n"));
    console.log("-----------------------------");
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.log("Changelog generation timed out, using raw commits");
      for (const commit of commits) {
        const attribution =
          commit.author && !team.includes(commit.author)
            ? ` (@${commit.author})`
            : "";
        notes.push(`- ${commit.message}${attribution}`);
      }
    } else {
      throw error;
    }
  } finally {
    opencode.server.close();
  }

  const contributors = await getContributors(from, to);

  if (contributors.size > 0) {
    notes.push("");
    notes.push(
      `**Thank you to ${contributors.size} community contributor${contributors.size > 1 ? "s" : ""}:**`,
    );
    for (const [username, userCommits] of contributors) {
      notes.push(`- @${username}:`);
      for (const c of userCommits) {
        notes.push(`  - ${c}`);
      }
    }
  }

  return notes;
}

// CLI entrypoint
if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      from: { type: "string", short: "f" },
      to: { type: "string", short: "t", default: "HEAD" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(`
Usage: bun scripts/changelog.ts [options]

Options:
  -f, --from <version>   Starting version (default: latest GitHub release)
  -t, --to <ref>         Ending ref (default: HEAD)
  -h, --help             Show this help message

Examples:
  bun scripts/changelog.ts                     # Latest release to HEAD
  bun scripts/changelog.ts --from 1.0.0        # v1.0.0 to HEAD
  bun scripts/changelog.ts -f 1.0.0 -t 1.1.0
`);
    process.exit(0);
  }

  const to = values.to!;
  const from = values.from ?? (await getLatestRelease());

  console.log(`Generating changelog: v${from} -> ${to}\n`);

  const notes = await buildNotes(from, to);
  console.log("\n=== Final Notes ===");
  console.log(notes.join("\n"));
}
