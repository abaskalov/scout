#!/usr/bin/env tsx
/**
 * Scout Agent — autonomous bug fixer.
 *
 * Polls Scout API for new bugs, clones/pulls repos,
 * runs Claude Code to fix, pushes branch + creates PR.
 *
 * Usage:
 *   Local:  pnpm orchestrator
 *   Docker: node dist/orchestrator/process-bugs.js
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ScoutClient, type ScoutItem } from './scout-client.js';
import { parseRecording } from './parse-recording.js';
import { loadConfig, type AgentConfig, type ProjectConfig } from './config.js';

const config = loadConfig();

const client = new ScoutClient({
  apiUrl: config.scoutUrl,
  email: config.agentEmail,
  password: config.agentPassword,
});

// ── Helpers ──────────────────────────────────────────────────

function exec(cmd: string, cwd: string, timeoutMs = 120_000): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: timeoutMs, stdio: 'pipe' });
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string };
    return e.stderr || e.stdout || 'Command failed';
  }
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function repoName(url: string): string {
  return basename(url).replace(/\.git$/, '');
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// ── Git operations ───────────────────────────────────────────

function syncRepos(projectConfig: ProjectConfig, workspace: string): string[] {
  mkdirSync(workspace, { recursive: true });
  const repoPaths: string[] = [];

  for (const url of projectConfig.repos) {
    const name = repoName(url);
    const repoPath = join(workspace, name);

    if (existsSync(join(repoPath, '.git'))) {
      log(`  git pull: ${name}`);
      exec('git fetch --all --prune', repoPath);
      exec('git pull --ff-only || true', repoPath);
    } else {
      log(`  git clone: ${name}`);
      exec(`git clone ${url} ${name}`, workspace, 180_000);
    }

    repoPaths.push(repoPath);
  }

  return repoPaths;
}

function detectDefaultBranch(repoPath: string): string {
  const result = exec(
    "git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'",
    repoPath,
  ).trim();
  return result || 'master';
}

// ── AI Agent ─────────────────────────────────────────────────

function buildPrompt(item: ScoutItem, stepsLog: string, workspace: string): string {
  const agentPromptPath = join(import.meta.dirname, 'agent-prompt.md');
  const systemPrompt = existsSync(agentPromptPath)
    ? readFileSync(agentPromptPath, 'utf-8')
    : '';

  const context = [
    `# Bug Report`,
    ``,
    `**Description:** ${item.message}`,
    item.pageUrl ? `**Page:** ${item.pageUrl}` : null,
    item.cssSelector ? `**Element selector:** ${item.cssSelector}` : null,
    item.elementHtml ? `**Element HTML:** ${item.elementHtml}` : null,
    item.elementText ? `**Element text:** ${item.elementText}` : null,
    item.componentFile ? `**Component:** ${item.componentFile}` : null,
    item.viewportWidth ? `**Viewport:** ${item.viewportWidth}x${item.viewportHeight}` : null,
    stepsLog ? `\n**Reproduction steps:**\n${stepsLog}` : null,
    ``,
    `# Workspace`,
    ``,
    `You are in \`${workspace}\`. It may contain multiple repositories.`,
    `Determine which repo and file(s) need to be fixed based on the bug context.`,
    ``,
    `# Instructions`,
    ``,
    `1. Analyze the bug report and determine the affected repository`,
    `2. Navigate to the correct repo directory`,
    `3. Find and fix the root cause with minimal changes`,
    `4. Run typecheck and lint (check package.json for available scripts)`,
    `5. Stage and commit your changes: \`git add -A && git commit -m "fix: <description>"\``,
    `6. If you cannot fix confidently — explain why and stop`,
  ].filter(Boolean).join('\n');

  return systemPrompt
    ? `${systemPrompt}\n\n---\n\n${context}`
    : context;
}

function runAgent(prompt: string, cwd: string): string {
  // Write prompt to temp file to avoid shell escaping issues
  const promptPath = join(cwd, '.scout-prompt.md');
  writeFileSync(promptPath, prompt, 'utf-8');

  try {
    const cmd = `${config.agentBin} -p --dangerously-skip-permissions "$(cat ${promptPath})"`;
    return exec(cmd, cwd, 600_000); // 10 min timeout
  } finally {
    try { execSync(`rm -f ${promptPath}`, { cwd }); } catch { /* best effort */ }
  }
}

// ── Process a single bug ─────────────────────────────────────

async function processItem(
  item: ScoutItem,
  projectConfig: ProjectConfig,
  workspace: string,
): Promise<void> {
  const sid = shortId(item.id);

  log(`Processing: ${sid} — "${item.message.slice(0, 60)}"`);

  // 1. Claim
  try {
    await client.claimItem(item.id);
    log(`  Claimed: ${sid}`);
  } catch (err) {
    log(`  Skip (already claimed): ${sid}`);
    return;
  }

  // 2. Full context
  const fullItem = await client.getItem(item.id);

  // 3. Parse recording
  let stepsLog = '';
  if (fullItem.sessionRecordingPath) {
    try {
      const token = client.getToken();
      const url = `${config.scoutUrl}/${fullItem.sessionRecordingPath}?token=${token}`;
      const res = await fetch(url);
      if (res.ok) stepsLog = parseRecording(await res.text());
    } catch {
      stepsLog = '';
    }
  }

  // 4. Sync repos
  const repoPaths = syncRepos(projectConfig, workspace);

  // 5. Create branch in all repos (AI will commit only in the affected one)
  const branchName = `fix/scout-${sid}`;
  for (const rp of repoPaths) {
    const defaultBranch = detectDefaultBranch(rp);
    exec(`git checkout ${defaultBranch}`, rp);
    exec(`git pull --ff-only || true`, rp);
    exec(`git checkout -b ${branchName}`, rp);
  }

  // 6. Run AI agent
  let success = false;
  let attempt = 0;
  const prompt = buildPrompt(fullItem, stepsLog, workspace);

  while (attempt < config.maxAttempts && !success) {
    attempt++;
    log(`  Attempt ${attempt}/${config.maxAttempts}`);

    await client.addNote(item.id, `Attempt ${attempt}: analyzing and fixing...`);

    const output = runAgent(prompt, workspace);

    // Check if any repo has changes
    const changedRepo = repoPaths.find((rp) => {
      const status = exec('git status --porcelain', rp).trim();
      const diffStaged = exec('git diff --cached --name-only', rp).trim();
      return status.length > 0 || diffStaged.length > 0;
    });

    // Also check if agent already committed
    const committedRepo = repoPaths.find((rp) => {
      const log = exec(`git log ${branchName} --not origin/${detectDefaultBranch(rp)} --oneline`, rp).trim();
      return log.length > 0;
    });

    const affectedRepo = committedRepo || changedRepo;

    if (!affectedRepo) {
      await client.addNote(item.id, `Attempt ${attempt}: no changes produced`);
      continue;
    }

    // If changes are uncommitted, commit them
    if (changedRepo && !committedRepo) {
      exec('git add -A', affectedRepo);
      exec(`git commit -m "fix(scout-${sid}): ${item.message.slice(0, 60)}"`, affectedRepo);
    }

    success = true;

    // 7. Push + PR
    log(`  Pushing: ${repoName(affectedRepo)}`);
    const pushResult = exec(`git push origin ${branchName}`, affectedRepo);

    if (pushResult.includes('fatal:') || pushResult.includes('error:')) {
      await client.addNote(item.id, `Attempt ${attempt}: push failed:\n${pushResult.slice(0, 300)}`);
      success = false;
      exec('git reset HEAD~1', affectedRepo);
      continue;
    }

    // 8. Create PR
    log(`  Creating PR...`);
    let mrUrl = '';
    const defaultBranch = detectDefaultBranch(affectedRepo);
    const prTitle = `fix(scout): ${item.message.slice(0, 60)}`;
    const prBody = `Scout bug: ${sid}\\n\\n${item.message}`;

    const prOutput = exec(
      `gh pr create --base ${defaultBranch} --title "${prTitle}" --body "${prBody}" 2>&1`,
      affectedRepo,
    );
    const urlMatch = prOutput.match(/https?:\/\/\S+\/pull\/\d+/);
    mrUrl = urlMatch ? urlMatch[0] : '';

    // 9. Update Scout
    await client.updateStatus(item.id, 'review', {
      branchName,
      mrUrl: mrUrl || undefined,
      attemptCount: attempt,
    });

    const note = mrUrl
      ? `Fixed in ${attempt} attempt(s). PR: ${mrUrl}`
      : `Fixed in ${attempt} attempt(s). Branch: ${branchName}`;
    await client.addNote(item.id, note);
    log(`  SUCCESS: ${mrUrl || branchName}`);
  }

  // Cleanup: return all repos to default branch
  for (const rp of repoPaths) {
    const defaultBranch = detectDefaultBranch(rp);
    exec(`git checkout ${defaultBranch}`, rp);
    if (!success) {
      exec(`git branch -D ${branchName} 2>/dev/null || true`, rp);
    }
  }

  if (!success) {
    await client.addNote(item.id, `Failed after ${config.maxAttempts} attempts. Needs human review.`);
    log(`  FAILED: ${sid}`);
  }
}

// ── Main loop ────────────────────────────────────────────────

async function poll(): Promise<void> {
  await client.login();
  log('Authenticated with Scout API');

  const { items: projects } = await client.listProjects();
  const active = projects.filter((p) => p.autofixEnabled && p.isActive);

  for (const project of active) {
    const projectConfig = config.projects[project.slug];
    if (!projectConfig) {
      log(`Skip "${project.slug}" — not in agent config`);
      continue;
    }

    const workspace = join(config.workspace, project.slug);
    log(`Project: ${project.name} (${project.slug})`);

    const { items } = await client.listItems(project.id, 'new');
    const unassigned = items.filter((i) => !i.assigneeId);

    if (unassigned.length === 0) {
      log('  No new bugs');
      continue;
    }

    log(`  Found ${unassigned.length} bug(s)`);

    for (const item of unassigned) {
      try {
        await processItem(item, projectConfig, workspace);
      } catch (err) {
        log(`  Error: ${shortId(item.id)} — ${err}`);
        try {
          await client.addNote(item.id, `Agent error: ${String(err).slice(0, 500)}`);
        } catch { /* best effort */ }
      }
    }
  }
}

async function main(): Promise<void> {
  log('Scout Agent starting');
  log(`Scout URL: ${config.scoutUrl}`);
  log(`Workspace: ${config.workspace}`);
  log(`Poll interval: ${config.pollInterval}s`);
  log(`Projects: ${Object.keys(config.projects).join(', ') || '(none)'}`);

  // Initial run
  await poll();

  // If poll_interval is 0 — single run (for testing)
  if (config.pollInterval <= 0) {
    log('Single run mode — exiting');
    return;
  }

  // Polling loop
  log(`Next poll in ${config.pollInterval}s...`);
  setInterval(async () => {
    try {
      await poll();
    } catch (err) {
      log(`Poll error: ${err}`);
    }
    log(`Next poll in ${config.pollInterval}s...`);
  }, config.pollInterval * 1000);
}

main().catch((err) => {
  log(`Fatal: ${err}`);
  process.exit(1);
});
