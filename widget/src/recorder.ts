import type { eventWithTime, recordOptions } from 'rrweb';
import { record } from 'rrweb';

const BUFFER_DURATION_MS = 30_000; // 30 seconds
const CHECKOUT_INTERVAL_MS = 10_000; // full snapshot every 10 seconds

let events: eventWithTime[] = [];
let stopFn: (() => void) | null = null;

// rrweb event types
const EVENT_TYPE_FULL_SNAPSHOT = 2;
const EVENT_TYPE_META = 4;

/**
 * Trim events older than 30 seconds, but always keep the last FullSnapshot
 * and everything after it (rrweb-player needs FullSnapshot to replay).
 */
function trimBuffer(): void {
  if (events.length === 0) return;

  const now = Date.now();
  const cutoff = now - BUFFER_DURATION_MS;

  // Find the last FullSnapshot within the buffer window
  let lastSnapshotIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.type === EVENT_TYPE_FULL_SNAPSHOT) {
      lastSnapshotIdx = i;
      break;
    }
  }

  if (lastSnapshotIdx <= 0) return; // No snapshot to anchor to, keep everything

  // Find the Meta event right before the FullSnapshot (if any)
  let startIdx = lastSnapshotIdx;
  if (startIdx > 0 && events[startIdx - 1]!.type === EVENT_TYPE_META) {
    startIdx = startIdx - 1;
  }

  // Only trim if the snapshot is within our time window
  if (events[lastSnapshotIdx]!.timestamp >= cutoff && startIdx > 0) {
    events = events.slice(startIdx);
  }
}

/**
 * Start the rrweb recorder with a rolling 30-second buffer.
 * Uses checkoutEveryNms to create periodic FullSnapshots so trimming works.
 */
export function startRecording(): void {
  if (stopFn) return;

  events = [];

  const opts: recordOptions<eventWithTime> = {
    emit(event: eventWithTime) {
      events.push(event);
      if (events.length % 50 === 0) {
        trimBuffer();
      }
    },
    maskAllInputs: false,
    recordCrossOriginIframes: false,
    // Exclude Scout widget from recording
    blockSelector: '#scout-widget-root',
    // Create a new FullSnapshot periodically so the rolling buffer always has one
    checkoutEveryNms: CHECKOUT_INTERVAL_MS,
  };

  stopFn = record(opts) ?? null;
}

/**
 * Stop the recorder entirely.
 */
export function stopRecording(): void {
  if (stopFn) {
    stopFn();
    stopFn = null;
  }
}

/**
 * Get the current buffer as a base64-encoded JSON string (trimmed to last 30 seconds).
 */
export function getRecordingBase64(): string {
  trimBuffer();
  const json = JSON.stringify(events);
  try {
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }
}

/**
 * Reset the buffer (call after successful submit).
 */
export function resetBuffer(): void {
  events = [];
}

/**
 * Check if the recorder is currently active.
 */
export function isRecording(): boolean {
  return stopFn !== null;
}
