/**
 * Orchestrator configuration.
 * Maps Scout projects to git repositories and validation commands.
 */

export interface ProjectConfig {
  /** Path to the git repository */
  repoPath: string;
  /** Target branch for MR */
  targetBranch: string;
  /** Command to run typecheck */
  typecheckCmd: string;
  /** Command to run linting */
  lintCmd: string;
  /** Max fix attempts before giving up */
  maxAttempts: number;
}

export interface OrchestratorConfig {
  /** Scout API URL */
  scoutApiUrl: string;
  /** Agent credentials */
  agentEmail: string;
  agentPassword: string;
  /** opencode binary path (default: 'opencode') */
  opencodeBin: string;
  /** Project configs keyed by Scout project slug */
  projects: Record<string, ProjectConfig>;
}

/**
 * Load config from environment variables and defaults.
 */
export function loadConfig(): OrchestratorConfig {
  return {
    scoutApiUrl: process.env.SCOUT_API_URL || 'http://localhost:10009',
    agentEmail: process.env.SCOUT_AGENT_EMAIL || 'agent@scout.local',
    agentPassword: process.env.SCOUT_AGENT_PASSWORD || 'agent',
    opencodeBin: process.env.OPENCODE_BIN || 'opencode',
    projects: {
      // Example: map Scout project slug to git repository
      // 'my-app': {
      //   repoPath: '/path/to/my-app',
      //   targetBranch: 'main',
      //   typecheckCmd: 'npm run typecheck',
      //   lintCmd: 'npm run lint:fix',
      //   maxAttempts: 3,
      // },
    },
  };
}
