import { db } from '../db/client.js';
import { scoutItems, scoutItemNotes, type User, type ItemStatus } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors.js';

const STATUS_LABELS: Record<ItemStatus, string> = {
  new: 'новые',
  in_progress: 'в работе',
  review: 'на ревью',
  done: 'готово',
  cancelled: 'отменено',
};

const VALID_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  new: ['in_progress', 'cancelled'],
  in_progress: ['review', 'done', 'cancelled'],
  review: ['in_progress', 'done'],
  done: [],
  cancelled: [],
};

function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function addAutoNote(
  itemId: string,
  userId: string,
  content: string,
  type: 'status_change' | 'assignment',
): void {
  db.insert(scoutItemNotes).values({
    id: randomUUID(),
    itemId,
    userId,
    content,
    type,
  }).run();
}

function saveFile(base64: string, dir: string, ext: string): string {
  const fullDir = join(process.cwd(), 'storage', dir);
  mkdirSync(fullDir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const filePath = join(fullDir, filename);
  const buffer = Buffer.from(base64, 'base64');
  writeFileSync(filePath, buffer);
  return `storage/${dir}/${filename}`;
}

function deleteFile(path: string | null): void {
  if (!path) return;
  const fullPath = join(process.cwd(), path);
  if (existsSync(fullPath)) unlinkSync(fullPath);
}

export function validateTransition(from: ItemStatus, to: ItemStatus): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new ValidationError(`Invalid status transition: ${from} → ${to}`);
  }
}

export function createItem(data: {
  projectId: string;
  message: string;
  reporterId: string;
  pageUrl?: string | null;
  pageRoute?: string | null;
  componentFile?: string | null;
  cssSelector?: string | null;
  elementText?: string | null;
  elementHtml?: string | null;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  screenshot?: string | null;
  sessionRecording?: string | null;
}) {
  const id = randomUUID();
  let screenshotPath: string | null = null;
  let sessionRecordingPath: string | null = null;

  if (data.screenshot) {
    screenshotPath = saveFile(data.screenshot, 'screenshots', 'png');
  }
  if (data.sessionRecording) {
    sessionRecordingPath = saveFile(data.sessionRecording, 'recordings', 'json');
  }

  db.insert(scoutItems).values({
    id,
    projectId: data.projectId,
    message: data.message,
    pageUrl: data.pageUrl ?? null,
    pageRoute: data.pageRoute ?? null,
    componentFile: data.componentFile ?? null,
    cssSelector: data.cssSelector ?? null,
    elementText: data.elementText ?? null,
    elementHtml: data.elementHtml ?? null,
    viewportWidth: data.viewportWidth ?? null,
    viewportHeight: data.viewportHeight ?? null,
    screenshotPath,
    sessionRecordingPath,
    reporterId: data.reporterId,
  }).run();

  return db.select().from(scoutItems).where(eq(scoutItems.id, id)).get()!;
}

export function claimItem(itemId: string, user: User) {
  // Atomic: only claim if status=new AND unassigned
  const result = db.update(scoutItems)
    .set({
      status: 'in_progress',
      assigneeId: user.id,
      updatedAt: now(),
    })
    .where(and(
      eq(scoutItems.id, itemId),
      eq(scoutItems.status, 'new'),
      isNull(scoutItems.assigneeId),
    ))
    .run();

  if (result.changes === 0) {
    const item = db.select().from(scoutItems).where(eq(scoutItems.id, itemId)).get();
    if (!item) throw new NotFoundError('Item');
    throw new ConflictError('Item already claimed or not in "new" status');
  }

  addAutoNote(itemId, user.id, `Назначено: ${user.name}`, 'assignment');
  addAutoNote(itemId, user.id, 'Статус: новые → в работе', 'status_change');

  return db.select().from(scoutItems).where(eq(scoutItems.id, itemId)).get()!;
}

export function updateItemStatus(
  itemId: string,
  newStatus: ItemStatus,
  user: User,
  extra?: {
    branchName?: string;
    mrUrl?: string;
    attemptCount?: number;
    resolutionNote?: string;
  },
) {
  const item = db.select().from(scoutItems).where(eq(scoutItems.id, itemId)).get();
  if (!item) throw new NotFoundError('Item');

  validateTransition(item.status as ItemStatus, newStatus);

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now(),
  };

  if (extra?.branchName !== undefined) updateData.branchName = extra.branchName;
  if (extra?.mrUrl !== undefined) updateData.mrUrl = extra.mrUrl;
  if (extra?.attemptCount !== undefined) updateData.attemptCount = extra.attemptCount;
  if (extra?.resolutionNote !== undefined) updateData.resolutionNote = extra.resolutionNote;

  if (newStatus === 'done') {
    updateData.resolvedById = user.id;
    updateData.resolvedAt = now();
  }

  db.update(scoutItems).set(updateData).where(eq(scoutItems.id, itemId)).run();
  const fromLabel = STATUS_LABELS[item.status as ItemStatus] || item.status;
  const toLabel = STATUS_LABELS[newStatus] || newStatus;
  addAutoNote(itemId, user.id, `Статус: ${fromLabel} → ${toLabel}`, 'status_change');

  return db.select().from(scoutItems).where(eq(scoutItems.id, itemId)).get()!;
}

export function deleteItem(itemId: string): void {
  const item = db.select().from(scoutItems).where(eq(scoutItems.id, itemId)).get();
  if (!item) throw new NotFoundError('Item');

  // Clean up files
  deleteFile(item.screenshotPath);
  deleteFile(item.sessionRecordingPath);

  db.delete(scoutItems).where(eq(scoutItems.id, itemId)).run();
}
