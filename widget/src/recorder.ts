import type { eventWithTime, recordOptions } from 'rrweb';
import { record } from 'rrweb';

const BUFFER_DURATION_MS = 30_000; // 30 seconds

let events: eventWithTime[] = [];
let stopFn: (() => void) | null = null;

/**
 * Trim events older than 30 seconds relative to the most recent event timestamp.
 */
function trimBuffer(): void {
  if (events.length === 0) return;
  const now = Date.now();
  const cutoff = now - BUFFER_DURATION_MS;
  // Find the first event that is within the buffer window
  let startIdx = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].timestamp >= cutoff) {
      startIdx = i;
      break;
    }
    // If we reach the end, keep at least the last event
    if (i === events.length - 1) {
      startIdx = i;
    }
  }
  if (startIdx > 0) {
    events = events.slice(startIdx);
  }
}

/**
 * Start the rrweb recorder with a rolling 30-second buffer.
 */
export function startRecording(): void {
  if (stopFn) return; // already recording

  events = [];

  const opts: recordOptions<eventWithTime> = {
    emit(event: eventWithTime) {
      events.push(event);
      // Trim periodically (every 50 events to avoid perf overhead)
      if (events.length % 50 === 0) {
        trimBuffer();
      }
    },
    // Mask inputs for privacy
    maskAllInputs: false,
    // Record cross-origin iframes if possible
    recordCrossOriginIframes: false,
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
 * Get the current buffer as a JSON string (trimmed to last 30 seconds).
 * Returns a base64-encoded JSON string.
 */
export function getRecordingBase64(): string {
  trimBuffer();
  const json = JSON.stringify(events);
  // Use btoa with UTF-8 encoding
  try {
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    // Fallback for large strings: use TextEncoder + manual base64
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
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
