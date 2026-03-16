import type { eventWithTime, recordOptions } from 'rrweb';
import { record } from 'rrweb';

const BUFFER_DURATION_MS = 30_000;
const CHECKOUT_INTERVAL_MS = 10_000;

let events: eventWithTime[] = [];
let stopFn: (() => void) | null = null;
let paused = false;

const EVENT_TYPE_FULL_SNAPSHOT = 2;
const EVENT_TYPE_META = 4;

function trimBuffer(): void {
  if (events.length === 0) return;

  let lastSnapshotIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.type === EVENT_TYPE_FULL_SNAPSHOT) {
      lastSnapshotIdx = i;
      break;
    }
  }

  if (lastSnapshotIdx <= 0) return;

  let startIdx = lastSnapshotIdx;
  if (startIdx > 0 && events[startIdx - 1]!.type === EVENT_TYPE_META) {
    startIdx = startIdx - 1;
  }

  const now = Date.now();
  const cutoff = now - BUFFER_DURATION_MS;
  if (events[lastSnapshotIdx]!.timestamp >= cutoff && startIdx > 0) {
    events = events.slice(startIdx);
  }
}

export function startRecording(): void {
  if (stopFn) return;

  events = [];
  paused = false;

  const opts: recordOptions<eventWithTime> = {
    emit(event: eventWithTime) {
      // Don't record events while Scout UI is shown
      if (paused) return;
      events.push(event);
      if (events.length % 50 === 0) {
        trimBuffer();
      }
    },
    maskAllInputs: false,
    recordCrossOriginIframes: false,
    checkoutEveryNms: CHECKOUT_INTERVAL_MS,
  };

  stopFn = record(opts) ?? null;
}

/**
 * Pause recording (while Scout UI is visible).
 * Events are silently dropped until resumed.
 */
export function pauseRecording(): void {
  paused = true;
}

/**
 * Resume recording after Scout UI is closed.
 */
export function resumeRecording(): void {
  paused = false;
}

export function stopRecording(): void {
  if (stopFn) {
    stopFn();
    stopFn = null;
  }
}

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

export function resetBuffer(): void {
  events = [];
}

export function isRecording(): boolean {
  return stopFn !== null;
}
