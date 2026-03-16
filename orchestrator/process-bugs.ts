#!/usr/bin/env tsx
/**
 * Scout Orchestrator — main script.
 *
 * Fetches new bug items, claims them, runs opencode to fix,
 * validates, creates branch + MR, updates Scout status.
 *
 * Usage: npx tsx orchestrator/process-bugs.ts
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ScoutClient, type ScoutItem } from './scout-client.js';
import { parseRecording } from './parse-recording.js';
import { loadConfig, type ProjectConfig } from './config.js';

const config = loadConfig();
const client = new ScoutClient({
  apiUrl: config.scoutApiUrl,
  email: config.agentEmail,
  password: config.agentPassword,
});

function exec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 120_000 });
  } catch (err) {
    const execErr = err as { stderr?: string; stdout?: string };
    return execErr.stderr || execErr.stdout || 'Command failed';
  }
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

async function processItem(item: ScoutItem, projectConfig: ProjectConfig): Promise<void> {
  const sid = shortId(item.id);
  const branchName = `fix/scout-${sid}`;

  console.log(`\n--- Processing item ${sid}: "${item.message.slice(0, 60)}" ---`);

  // 1. Claim
  try {
    await client.claimItem(item.id);
    console.log(`  Claimed: ${sid}`);
  } catch (err) {
    console.log(`  Skip: already claimed or error: ${err}`);
    return;
  }

  // 2. Get full context
  const fullItem = await client.getItem(item.id);

  // 3. Parse recording if exists
  let stepsLog = '';
  if (fullItem.sessionRecordingPath) {
    const recordingPath = join(config.scoutApiUrl.replace(/^https?:\/\/[^/]+/, ''), fullItem.sessionRecordingPath);
    // Try to fetch recording from API
    try {
      const res = await fetch(`${config.scoutApiUrl}/${fullItem.sessionRecordingPath}`);
      if (res.ok) {
        const json = await res.text();
        stepsLog = parseRecording(json);
      }
    } catch {
      stepsLog = 'Could not load recording';
    }
  }

  // 4. Build context for opencode
  const context = [
    `Bug: ${fullItem.message}`,
    fullItem.pageUrl ? `Page: ${fullItem.pageUrl}` : null,
    fullItem.cssSelector ? `Element selector: ${fullItem.cssSelector}` : null,
    fullItem.elementHtml ? `Element HTML: ${fullItem.elementHtml}` : null,
    fullItem.elementText ? `Element text: ${fullItem.elementText}` : null,
    fullItem.componentFile ? `Component: ${fullItem.componentFile}` : null,
    fullItem.viewportWidth ? `Viewport: ${fullItem.viewportWidth}x${fullItem.viewportHeight}` : null,
    stepsLog ? `\nReproduction steps:\n${stepsLog}` : null,
    '\nFix ONLY this bug. Minimal changes. Run typecheck and lint after fixing.',
  ].filter(Boolean).join('\n');

  // 5. Create branch
  console.log(`  Branch: ${branchName}`);
  exec(`git checkout -b ${branchName}`, projectConfig.repoPath);

  // 6. Attempt fix
  let success = false;
  let attempt = 0;

  while (attempt < projectConfig.maxAttempts && !success) {
    attempt++;
    console.log(`  Attempt ${attempt}/${projectConfig.maxAttempts}...`);

    await client.addNote(item.id,
      `Attempt ${attempt}: Analyzing and fixing bug...`);

    // Run opencode
    try {
      const opencodeCmd = `${config.opencodeBin} run --agent scout-fixer "${context.replace(/"/g, '\\"')}"`;
      exec(opencodeCmd, projectConfig.repoPath);
    } catch (err) {
      await client.addNote(item.id,
        `Attempt ${attempt}: opencode execution error: ${String(err).slice(0, 500)}`);
      continue;
    }

    // Validate: typecheck
    console.log(`  Validating...`);
    const tcResult = exec(projectConfig.typecheckCmd, projectConfig.repoPath);
    if (tcResult.includes('error TS') || tcResult.includes('Error:')) {
      await client.addNote(item.id,
        `Attempt ${attempt}: Typecheck failed:\n${tcResult.slice(0, 500)}`);
      // Reset changes for retry
      exec('git checkout .', projectConfig.repoPath);
      continue;
    }

    // Validate: lint
    exec(projectConfig.lintCmd, projectConfig.repoPath);

    success = true;
  }

  if (!success) {
    await client.addNote(item.id,
      `Failed after ${projectConfig.maxAttempts} attempts. Needs human review.`);
    // Clean up branch
    exec('git checkout .', projectConfig.repoPath);
    exec(`git checkout - && git branch -D ${branchName}`, projectConfig.repoPath);
    console.log(`  FAILED after ${projectConfig.maxAttempts} attempts`);
    return;
  }

  // 7. Commit + push
  console.log(`  Committing...`);
  exec(`git add -A && git commit -m "fix(scout-${sid}): ${item.message.slice(0, 60)}"`,
    projectConfig.repoPath);
  exec(`git push origin ${branchName}`, projectConfig.repoPath);

  // 8. Create PR (GitHub) or MR (GitLab)
  console.log(`  Creating PR...`);
  let mrUrl = '';
  try {
    const prOutput = exec(
      `gh pr create --base ${projectConfig.targetBranch} ` +
      `--title "fix(scout): ${item.message.slice(0, 60)}" ` +
      `--body "Scout item: ${item.id}\n\n${item.message}" `,
      projectConfig.repoPath,
    );
    // Extract PR URL from gh output
    const urlMatch = prOutput.match(/https?:\/\/github\.com\/\S+\/pull\/\d+/);
    mrUrl = urlMatch ? urlMatch[0] : '';
  } catch {
    mrUrl = '';
  }

  // 9. Update Scout status
  await client.updateStatus(item.id, 'review', {
    branchName,
    mrUrl: mrUrl || undefined,
    attemptCount: attempt,
  });

  await client.addNote(item.id,
    `Fixed in ${attempt} attempt(s).${mrUrl ? ` MR: ${mrUrl}` : ' Branch pushed, create MR manually.'}`);

  console.log(`  SUCCESS: ${mrUrl || branchName}`);

  // Return to main branch
  exec('git checkout -', projectConfig.repoPath);
}

async function main() {
  console.log('Scout Orchestrator starting...');
  await client.login();
  console.log('Authenticated with Scout API');

  // Get projects with autofix enabled
  const { items: projects } = await client.listProjects();
  const autofixProjects = projects.filter((p) => p.autofixEnabled && p.isActive);

  for (const project of autofixProjects) {
    const projectConfig = config.projects[project.slug];
    if (!projectConfig) {
      console.log(`\nSkipping project "${project.name}" — no config for slug "${project.slug}"`);
      continue;
    }

    console.log(`\nProject: ${project.name} (${project.slug})`);

    // Get new unassigned items
    const { items } = await client.listItems(project.id, 'new');
    const unassigned = items.filter((i) => !i.assigneeId);

    if (unassigned.length === 0) {
      console.log('  No new unassigned items');
      continue;
    }

    console.log(`  Found ${unassigned.length} new item(s)`);

    for (const item of unassigned) {
      try {
        await processItem(item, projectConfig);
      } catch (err) {
        console.error(`  Error processing ${shortId(item.id)}: ${err}`);
        try {
          await client.addNote(item.id,
            `Orchestrator error: ${String(err).slice(0, 500)}`);
        } catch { /* best effort */ }
      }
    }
  }

  console.log('\nOrchestrator done.');
}

main().catch(console.error);
