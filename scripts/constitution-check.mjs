#!/usr/bin/env node
/**
 * The constitution as a machine gate.
 *
 * MASTER-PLAN §13 asks for "the witness pattern encoded into the tooling."
 * A markdown file cannot enforce anything at 2am. This can. It runs in CI and
 * as a pre-commit hook, costs nothing, and has no opinions to be argued out of.
 *
 * Exit non-zero = the commit violates a law in CLAUDE.md / DESIGN-PRINCIPLES.md.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SOURCE_GLOBS = ["app", "components", "lib", "supabase"];

/** Each rule: things that must NEVER appear in application source. */
const BANNED = [
  {
    id: "brick-decrement",
    law: "CLAUDE.md — Bricks are append-only. No decrement path may exist in code.",
    pattern:
      /\b(bricks?)\b[^\n]{0,60}\b(--|-=|decrement|subtract|reset|delete\s+from|\.pop\(|splice)/i,
  },
  {
    id: "brick-sql-mutation",
    law: "CLAUDE.md — Bricks are append-only.",
    pattern: /\b(update|delete)\s+(from\s+)?(public\.)?bricks\b/i,
  },
  {
    // Voss, item-1 round 4: the SQL patterns above assume keyword-first
    // ordering and miss the Supabase client's chained form, where the table
    // name comes first and the verb after: supabase.from("bricks").delete().
    // Confirmed live — a file whose entire job was to decrement bricks passed
    // clean. This is the shape the app's actual DB client produces.
    id: "brick-client-mutation",
    law: "CLAUDE.md — Bricks are append-only (Supabase client form).",
    pattern: /\bbricks?["'`]?\s*\)[^\n]{0,40}\.(delete|update)\s*\(/i,
  },
  {
    id: "batch-reclustering",
    law: "CLAUDE.md — Threads never shuffle. No batch re-clustering, ever.",
    pattern: /\b(hdbscan|kmeans|k-means|recluster|re-cluster|reassignAllThreads)\b/i,
  },
  {
    id: "breakable-streak",
    law: "DESIGN-PRINCIPLES §1.1 — no resettable consecutive-day metric, in any form.",
    pattern: /\bstreak(Count|Days|Broken|Freeze|_count|s?\s*=\s*0)\b/i,
  },
  {
    id: "punishment-decay",
    law: "DESIGN-PRINCIPLES §1.2 — no state that worsens through inaction. Ripen, never rot.",
    pattern: /\b(wilt|wither|decay(Rate|Timer)|rotStage|damageUser|loseHeart|hearts?Left)\b/i,
  },
  {
    id: "ranked-comparison",
    law: "DESIGN-PRINCIPLES §1.3 — no leagues, no ranked comparison.",
    pattern: /\b(leaderboard|leagueRank|globalRank|rankAmongUsers)\b/i,
  },
  {
    id: "variable-ratio",
    law: "DESIGN-PRINCIPLES §1.5 — no variable-ratio rewards. Quest rotation is date-seeded.",
    pattern: /\b(lootBox|mysteryReward|randomBonus|Math\.random\(\)[^\n]{0,40}(reward|bonus|brick))/i,
  },
];

/** Copy that must never be rendered to a user. */
const BANNED_COPY = [
  "you missed",
  "days missed",
  "don't break your",
  "we miss you",
  "you've lost",
  "streak lost",
  "keep your streak",
];

function sourceFiles() {
  const out = execSync(
    `git ls-files ${SOURCE_GLOBS.join(" ")} | grep -E '\\.(ts|tsx|sql)$' || true`,
    { encoding: "utf8" },
  );
  return out.split("\n").filter(Boolean);
}

const violations = [];

for (const file of sourceFiles()) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // tracked in the index but not on disk (mid-rebase, deleted file)
  }
  const lines = text.split("\n");

  lines.forEach((line, i) => {
    // Comments are allowed to NAME a banned mechanic — that is how the laws get
    // documented in situ, and a check that forbids describing the rule is a
    // check nobody can live with. Only real code counts.
    const isSql = file.endsWith(".sql");
    const stripped = line
      .replace(isSql ? /--.*$/ : /\/\/.*$/, "") // SQL vs TS line comments
      .replace(/\/\*.*?\*\//g, "")
      .replace(/^\s*\*.*$/, ""); // jsdoc continuation
    if (!stripped.trim()) return;

    for (const rule of BANNED) {
      if (rule.pattern.test(stripped)) {
        violations.push({ file, line: i + 1, id: rule.id, law: rule.law, text: line.trim() });
      }
    }
    for (const phrase of BANNED_COPY) {
      if (stripped.toLowerCase().includes(phrase)) {
        violations.push({
          file,
          line: i + 1,
          id: "guilt-copy",
          law: "DESIGN-PRINCIPLES §1.4 — absence is never rendered as a gap.",
          text: line.trim(),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("\n✘ CONSTITUTION VIOLATION — this change cannot be committed.\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.id}]`);
    console.error(`    ${v.law}`);
    console.error(`    > ${v.text}\n`);
  }
  console.error(
    "These laws override any request made in the moment, including Jene's.\n" +
      "If this is genuinely intended, the plan requires an explicit, literal 'override'.\n",
  );
  process.exit(1);
}

console.log(`✓ constitution check clean (${sourceFiles().length} source files)`);
