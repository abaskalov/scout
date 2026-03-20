/**
 * Scout Agent configuration.
 *
 * Reads from agent.yaml (mounted as volume in Docker)
 * or falls back to environment variables for simple setups.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ProjectConfig {
  /** Git repository URLs to clone into workspace */
  repos: string[];
}

export interface AgentConfig {
  /** Scout API URL */
  scoutUrl: string;
  /** Agent credentials (email/password or API key) */
  agentEmail: string;
  agentPassword: string;
  /** Workspace directory where repos are cloned */
  workspace: string;
  /** Polling interval in seconds */
  pollInterval: number;
  /** AI agent binary */
  agentBin: string;
  /** Max fix attempts per bug */
  maxAttempts: number;
  /** Projects: Scout slug → config */
  projects: Record<string, ProjectConfig>;
}

/**
 * Parse a simple YAML subset (no dependency needed).
 * Supports: scalars, lists (- item), nested objects (2-space indent).
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  const stack: { obj: Record<string, unknown>; indent: number }[] = [
    { obj: result, indent: -1 },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Pop stack to correct level
    while (stack.length > 1 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }
    const current = stack[stack.length - 1]!.obj;

    // List item: "- value"
    if (trimmed.startsWith('- ')) {
      const parentKey = Object.keys(current).pop();
      if (parentKey && Array.isArray(current[parentKey])) {
        (current[parentKey] as unknown[]).push(trimmed.slice(2).trim());
      }
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();

    if (!rawValue) {
      // Check if next non-empty line is a list item
      const nextLine = lines.slice(i + 1).find((l) => l.trim() && !l.trim().startsWith('#'));
      if (nextLine && nextLine.trim().startsWith('- ')) {
        current[key] = [] as unknown[];
      } else {
        current[key] = {} as Record<string, unknown>;
        stack.push({ obj: current[key] as Record<string, unknown>, indent });
      }
    } else {
      // Parse scalar value
      const num = Number(rawValue);
      if (!Number.isNaN(num) && rawValue !== '') {
        current[key] = num;
      } else if (rawValue === 'true') {
        current[key] = true;
      } else if (rawValue === 'false') {
        current[key] = false;
      } else {
        // Strip quotes
        current[key] = rawValue.replace(/^["']|["']$/g, '');
      }
    }
  }

  return result;
}

export function loadConfig(configPath?: string): AgentConfig {
  const path = configPath
    || process.env.SCOUT_AGENT_CONFIG
    || join(import.meta.dirname, 'agent.yaml');

  let fileConfig: Record<string, unknown> = {};
  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf-8');
    fileConfig = parseSimpleYaml(raw);
  }

  // Build projects map from YAML
  const projects: Record<string, ProjectConfig> = {};
  const yamlProjects = fileConfig.projects as Record<string, unknown> | undefined;
  if (yamlProjects && typeof yamlProjects === 'object') {
    for (const [slug, val] of Object.entries(yamlProjects)) {
      if (val && typeof val === 'object' && 'repos' in val) {
        projects[slug] = { repos: (val as { repos: string[] }).repos };
      }
    }
  }

  return {
    scoutUrl: env('SCOUT_URL', str(fileConfig.scout_url, 'http://localhost:10009')),
    agentEmail: env('SCOUT_AGENT_EMAIL', str(fileConfig.agent_email, 'agent@scout.local')),
    agentPassword: env('SCOUT_AGENT_PASSWORD', str(fileConfig.agent_password, 'agent')),
    workspace: env('SCOUT_WORKSPACE', str(fileConfig.workspace, '/workspace')),
    pollInterval: num(env('POLL_INTERVAL', str(fileConfig.poll_interval, '300'))),
    agentBin: env('SCOUT_AGENT_BIN', str(fileConfig.agent_bin, 'claude')),
    maxAttempts: num(env('MAX_ATTEMPTS', str(fileConfig.max_attempts, '3'))),
    projects,
  };
}

function env(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function str(val: unknown, fallback: string): string {
  return val != null ? String(val) : fallback;
}

function num(val: string): number {
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}
