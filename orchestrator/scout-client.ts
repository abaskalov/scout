/**
 * Typed HTTP client for Scout API.
 * Used by the orchestrator to interact with Scout.
 */

export interface ScoutConfig {
  apiUrl: string;
  email: string;
  password: string;
}

export interface ScoutItem {
  id: string;
  projectId: string;
  message: string;
  status: string;
  pageUrl: string | null;
  pageRoute: string | null;
  componentFile: string | null;
  cssSelector: string | null;
  elementText: string | null;
  elementHtml: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  screenshotPath: string | null;
  sessionRecordingPath: string | null;
  reporterId: string | null;
  assigneeId: string | null;
  branchName: string | null;
  mrUrl: string | null;
  attemptCount: number;
  notes?: ScoutNote[];
}

export interface ScoutNote {
  id: string;
  itemId: string;
  userId: string | null;
  content: string;
  type: string;
  createdAt: string;
}

export interface ScoutProject {
  id: string;
  name: string;
  slug: string;
  autofixEnabled: boolean;
  isActive: boolean;
}

export class ScoutClient {
  private token: string | null = null;
  private apiUrl: string;
  private email: string;
  private password: string;

  constructor(config: ScoutConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.email = config.email;
    this.password = config.password;
  }

  private async request<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    if (!this.token) await this.login();

    const res = await fetch(`${this.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`Scout API ${path}: ${res.status} ${(err as { error: string }).error}`);
    }

    const json = await res.json() as { data: T };
    return json.data;
  }

  getToken(): string {
    return this.token || '';
  }

  async login(): Promise<void> {
    const res = await fetch(`${this.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });

    if (!res.ok) throw new Error(`Scout login failed: ${res.status}`);
    const json = await res.json() as { data: { token: string } };
    this.token = json.data.token;
  }

  async listProjects(): Promise<{ items: ScoutProject[] }> {
    return this.request('/api/projects/list', {});
  }

  async listItems(projectId: string, status?: string): Promise<{ items: ScoutItem[] }> {
    return this.request('/api/items/list', {
      projectId,
      status,
      perPage: 100,
    });
  }

  async getItem(id: string): Promise<ScoutItem> {
    return this.request('/api/items/get', { id });
  }

  async claimItem(id: string): Promise<ScoutItem> {
    return this.request('/api/items/claim', { id });
  }

  async updateStatus(id: string, status: string, extra?: {
    branchName?: string;
    mrUrl?: string;
    attemptCount?: number;
  }): Promise<ScoutItem> {
    return this.request('/api/items/update-status', { id, status, ...extra });
  }

  async resolveItem(id: string, extra?: {
    resolutionNote?: string;
    branchName?: string;
    mrUrl?: string;
  }): Promise<ScoutItem> {
    return this.request('/api/items/resolve', { id, ...extra });
  }

  async addNote(itemId: string, content: string): Promise<ScoutNote> {
    return this.request('/api/items/add-note', { itemId, content });
  }

  async countItems(projectId: string): Promise<{ counts: Record<string, number> }> {
    return this.request('/api/items/count', { projectId });
  }
}
