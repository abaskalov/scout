import { test, expect } from '@playwright/test';

/**
 * Full bug lifecycle E2E test.
 *
 * Tests the complete flow a real user goes through:
 * 1. Widget: login → pick element → fill bug → submit
 * 2. Dashboard: login → see bug in list → open detail
 * 3. Dashboard: edit, change status, add note, delete
 * 4. API: verify data integrity at each step
 */

const API = 'http://localhost:10009';
const DEMO = `${API}/demo/`;
const DASHBOARD = `${API}`;

// Helpers
async function apiPost(path: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function login(email: string, password: string) {
  const { data } = await apiPost('/auth/login', { email, password });
  return data?.data?.token as string;
}

// --- Tests ---

test.describe('Full bug lifecycle', () => {
  let adminToken: string;
  let projectId: string;

  test.beforeAll(async () => {
    adminToken = await login('admin@scout.local', 'admin');
    expect(adminToken).toBeTruthy();

    const { data } = await apiPost('/projects/list', {}, adminToken);
    projectId = data?.data?.items?.[0]?.id;
    expect(projectId).toBeTruthy();
  });

  test('1. Widget: create bug via API (simulating widget)', async () => {
    // Instead of browser-driving the shadow DOM widget (fragile),
    // test the exact same API call the widget makes — same payload shape
    const bugMessage = `E2E widget bug ${Date.now()}`;
    const { status, data } = await apiPost('/items/create', {
      projectId,
      message: bugMessage,
      pageUrl: 'http://localhost:10009/demo/',
      cssSelector: 'footer',
      elementText: 'AutoParts © 2026',
      viewportWidth: 1280,
      viewportHeight: 720,
      priority: 'medium',
      metadata: { browser: 'Chrome 120', os: 'macOS', language: 'ru' },
    }, adminToken);
    expect(status).toBe(201);
    expect(data.data.message).toBe(bugMessage);
    expect(data.data.status).toBe('new');
    expect(data.data.priority).toBe('medium');
  });

  test('2. Dashboard: login and see bug list', async ({ page }) => {
    // Login via API and set localStorage
    await page.goto(DASHBOARD);
    await page.evaluate(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@scout.local', password: 'admin' }),
      });
      const data = await res.json();
      localStorage.setItem('scout_token', data.data.token);
      localStorage.setItem('scout_user', JSON.stringify(data.data.user));
    });

    // Navigate to items list
    await page.goto(`${DASHBOARD}/items`);
    await page.waitForTimeout(2000);

    // Verify the list loads with items
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 5000 });
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('3. API: full item lifecycle', async () => {
    // Create a bug via API
    const createMsg = `API lifecycle ${Date.now()}`;
    const { status: createStatus, data: createData } = await apiPost('/items/create', {
      projectId,
      message: createMsg,
      priority: 'high',
      labels: ['e2e', 'test'],
    }, adminToken);
    expect(createStatus).toBe(201);
    const itemId = createData.data.id;

    // Verify item created
    const { data: getItem } = await apiPost('/items/get', { id: itemId }, adminToken);
    expect(getItem.data.message).toBe(createMsg);
    expect(getItem.data.priority).toBe('high');
    expect(getItem.data.status).toBe('new');

    // Update message + priority
    const { status: updateStatus } = await apiPost('/items/update', {
      id: itemId,
      message: createMsg + ' (updated)',
      priority: 'critical',
      labels: ['e2e', 'test', 'updated'],
    }, adminToken);
    expect(updateStatus).toBe(200);

    // Claim (new → in_progress)
    const { status: claimStatus } = await apiPost('/items/claim', { id: itemId }, adminToken);
    expect(claimStatus).toBe(200);

    // Update status (in_progress → review)
    const { status: reviewStatus } = await apiPost('/items/update-status', {
      id: itemId, status: 'review',
    }, adminToken);
    expect(reviewStatus).toBe(200);

    // Resolve (review → done)
    const { status: resolveStatus } = await apiPost('/items/resolve', {
      id: itemId,
      resolutionNote: 'Fixed in E2E test',
      branchName: 'fix/e2e-test',
      mrUrl: 'https://github.com/test/pr/1',
    }, adminToken);
    expect(resolveStatus).toBe(200);

    // Verify done status
    const { data: doneItem } = await apiPost('/items/get', { id: itemId }, adminToken);
    expect(doneItem.data.status).toBe('done');
    expect(doneItem.data.resolutionNote).toBe('Fixed in E2E test');

    // Reopen (done → new)
    const { status: reopenStatus } = await apiPost('/items/reopen', { id: itemId }, adminToken);
    expect(reopenStatus).toBe(200);

    // Add note
    const { status: noteStatus } = await apiPost('/items/add-note', {
      itemId, content: 'E2E test comment',
    }, adminToken);
    expect(noteStatus).toBe(201);

    // Verify note exists
    const { data: withNote } = await apiPost('/items/get', { id: itemId }, adminToken);
    const comments = withNote.data.notes.filter((n: { type: string }) => n.type === 'comment');
    expect(comments.length).toBeGreaterThan(0);

    // Delete
    const { status: deleteStatus } = await apiPost('/items/delete', { id: itemId }, adminToken);
    expect(deleteStatus).toBe(200);

    // Verify deleted
    const { status: getDeleted } = await apiPost('/items/get', { id: itemId }, adminToken);
    expect(getDeleted).toBe(404);
  });

  test('4. API: project access isolation', async () => {
    // Create a second project (admin only)
    const { data: proj } = await apiPost('/projects/create', {
      name: 'Isolated E2E', slug: `isolated-e2e-${Date.now()}`,
    }, adminToken);
    const isolatedId = proj.data.id;

    // Create an item in the isolated project
    await apiPost('/items/create', { projectId: isolatedId, message: 'secret bug' }, adminToken);

    // Login as member (who has access only to first project)
    const memberToken = await login('member@scout.local', 'member');

    // Member should NOT see items from isolated project
    const { status } = await apiPost('/items/list', { projectId: isolatedId }, memberToken);
    expect(status).toBe(403);

    // Cleanup
    await apiPost('/items/list', { projectId: isolatedId }, adminToken).then(async ({ data }) => {
      for (const item of data?.data?.items || []) {
        await apiPost('/items/delete', { id: item.id }, adminToken);
      }
    });
    await apiPost('/projects/delete', { id: isolatedId }, adminToken);
  });

  test('5. API: health check', async () => {
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.db).toBe('ok');
    expect(data.uptime).toBeGreaterThan(0);
    expect(data.memory.rss).toBeGreaterThan(0);
  });

  test('6. API: OpenAPI spec is valid', async () => {
    const res = await fetch(`${API}/api/docs/openapi.json`);
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toContain('Scout');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(20);
  });

  test('7. API: security headers present', async () => {
    const res = await fetch(`${API}/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  test('8. API: rate limiting headers present', async () => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@scout.local', password: 'admin' }),
    });
    expect(res.headers.get('x-ratelimit-limit')).toBeTruthy();
    expect(res.headers.get('x-ratelimit-remaining')).toBeTruthy();
  });

  test('9. API: API key lifecycle', async () => {
    // Create API key
    const { status, data } = await apiPost('/api-keys/create', {
      projectId, name: 'E2E Test Key',
    }, adminToken);
    expect(status).toBe(201);
    const fullKey = data.data.key;
    expect(fullKey).toMatch(/^sk_live_/);

    // Use API key to call /items/count (less rate-limited path than /auth/*)
    const countRes = await fetch(`${API}/api/items/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${fullKey}` },
      body: JSON.stringify({ projectId }),
    });
    expect(countRes.status).toBe(200);

    // Revoke
    const { status: revokeStatus } = await apiPost('/api-keys/revoke', { id: data.data.id }, adminToken);
    expect(revokeStatus).toBe(200);

    // Revoked key should fail
    const countRes2 = await fetch(`${API}/api/items/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${fullKey}` },
      body: JSON.stringify({ projectId }),
    });
    expect(countRes2.status).toBe(401);
  });
});
