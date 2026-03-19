import { db } from '../db/client.js';
import { webhooks, projects } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { logger } from '../lib/logger.js';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  project: { id: string; slug: string };
  data: Record<string, unknown>;
}

/**
 * Dispatch webhook event to all active webhooks for the project.
 * Runs asynchronously — does not block the request.
 * Retries once on failure.
 */
export async function dispatchWebhooks(
  projectId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const hooks = db.select().from(webhooks)
      .where(and(
        eq(webhooks.projectId, projectId),
        eq(webhooks.isActive, true),
      )).all();

    if (hooks.length === 0) return;

    // Look up project slug for the payload
    const project = db.select({ slug: projects.slug }).from(projects)
      .where(eq(projects.id, projectId)).get();
    const slug = project?.slug ?? '';

    for (const hook of hooks) {
      const events: string[] = JSON.parse(hook.events);
      if (!events.includes(event)) continue;

      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        project: { id: projectId, slug },
        data,
      };

      // Fire in background — don't await
      sendWebhook(hook.url, hook.secret, payload)
        .catch(err => logger.warn({ err, url: hook.url, event }, 'Webhook delivery failed'));
    }
  } catch (err) {
    logger.error({ err, projectId, event }, 'Webhook dispatch error');
  }
}

/**
 * Detect Slack webhook URLs and format payload accordingly.
 */
function isSlackUrl(url: string): boolean {
  return url.includes('hooks.slack.com');
}

const eventLabels: Record<string, string> = {
  'item.created': '\u{1F41B} Новый баг',
  'item.status_changed': '\u{1F504} Статус изменён',
  'item.assigned': '\u{1F464} Назначен',
  'item.commented': '\u{1F4AC} Новый комментарий',
  'item.deleted': '\u{1F5D1}\uFE0F Удалён',
};

function formatSlackPayload(payload: WebhookPayload): Record<string, unknown> {
  const { event, data } = payload;
  const item = data.item as Record<string, unknown> | undefined;

  const label = eventLabels[event] ?? event;
  const message = (item?.message as string) ?? '';
  const pageUrl = item?.pageUrl as string | undefined;

  return {
    text: `${label}: ${message}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${label}*\n${message || '(нет описания)'}`,
        },
      },
      ...(pageUrl ? [{
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `\u{1F4CD} ${pageUrl}` }],
      }] : []),
    ],
  };
}

async function sendWebhook(
  url: string,
  secret: string | null,
  payload: WebhookPayload,
): Promise<void> {
  const isSlack = isSlackUrl(url);
  const bodyObj = isSlack ? formatSlackPayload(payload) : payload;
  const body = JSON.stringify(bodyObj);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Scout-Webhook/1.0',
  };

  if (secret && !isSlack) {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Scout-Signature'] = `sha256=${signature}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    logger.warn({ url, status: res.status }, 'Webhook first attempt failed, retrying in 2s');
    // Retry once after 2s
    await new Promise(r => setTimeout(r, 2000));
    const retryRes = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!retryRes.ok) {
      throw new Error(`Webhook delivery failed after retry: ${retryRes.status}`);
    }
  }
}

/**
 * Send a test payload to a specific webhook.
 */
export async function sendTestWebhook(
  url: string,
  secret: string | null,
  projectId: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const project = db.select({ slug: projects.slug }).from(projects)
    .where(eq(projects.id, projectId)).get();

  const payload: WebhookPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    project: { id: projectId, slug: project?.slug ?? '' },
    data: {
      message: 'This is a test webhook from Scout',
      item: {
        id: '00000000-0000-0000-0000-000000000000',
        message: 'Тестовый баг-репорт',
        status: 'new',
        pageUrl: 'https://example.com/test',
      },
    },
  };

  try {
    const isSlack = isSlackUrl(url);
    const bodyObj = isSlack ? formatSlackPayload(payload) : payload;
    const body = JSON.stringify(bodyObj);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Scout-Webhook/1.0',
    };

    if (secret && !isSlack) {
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      headers['X-Scout-Signature'] = `sha256=${signature}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });

    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
