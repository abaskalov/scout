/**
 * Orchestrator configuration.
 * Maps Scout projects to git repositories and validation commands.
 */

export type AgentTool = 'claude' | 'opencode';

export interface ProjectConfig {
  /** Path to the git repository */
  repoPath: string;
  /** AI tool to use for this project */
  agent: AgentTool;
  /** Target branch for PRs */
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
  /** Binary paths for AI tools */
  claudeBin: string;
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
    claudeBin: process.env.CLAUDE_BIN || 'claude',
    opencodeBin: process.env.OPENCODE_BIN || 'opencode',
    projects: {
      // Example:
      // 'avtozor': {
      //   repoPath: '/path/to/avtozor',
      //   agent: 'claude',
      //   targetBranch: 'dev',
      //   typecheckCmd: 'pnpm typecheck',
      //   lintCmd: 'pnpm lint --fix',
      //   maxAttempts: 3,
      // },
    },
  };
}
