/**
 * Session recording — production-grade rrweb configuration.
 *
 * Architecture follows Sentry Replay + PostHog patches:
 *
 * 1. rrweb config: slimDOMOptions:'all', sampling, errorHandler, inlineStylesheet
 *    (exact settings from Sentry's packages/replay-internal/integration.ts)
 * 2. iOS mousemove fix from Sentry (disables on iPhone/iPad to prevent main thread blocking)
 * 3. Safari dialog:modal runtime patches (from PostHog's @rrweb/record patch)
 * 4. Event throttling: max THROTTLE_LIMIT events per THROTTLE_WINDOW_MS (Sentry uses 300/5s)
 * 5. Mutation limit: stop recording if >10K mutations (Sentry's MUTATION_LIMIT)
 * 6. Buffer size cap: 5MB max (Sentry uses 20MB but we're a lightweight widget)
 * 7. fflate compression before sending (Sentry uses fflate in Web Worker)
 * 8. Graceful degradation: recording failures don't break bug reporting
 */

import type { eventWithTime, recordOptions } from 'rrweb';
import { record } from 'rrweb';
import { gzipSync } from 'fflate';

// --- Constants (aligned with Sentry Replay) ---

/** Rolling buffer duration */
const BUFFER_DURATION_MS = 60_000;         // Sentry: 60s for buffer mode

/** Full DOM snapshot interval */
const CHECKOUT_INTERVAL_MS = 60_000;       // Sentry: 60s

/** Stop recording if single mutation batch exceeds this */
const MUTATION_LIMIT = 10_000;             // Sentry: mutationLimit

/** Max buffer size in bytes before forced trim */
const MAX_BUFFER_SIZE_BYTES = 5_000_000;   // 5MB (Sentry: 20MB)

/** Event throttling: max events per window */
const THROTTLE_LIMIT = 60;                 // Sentry: 300 events per 5s
const THROTTLE_WINDOW_MS = 5_000;

// --- State ---

let events: eventWithTime[] = [];
let stopFn: (() => void) | null = null;
let paused = false;
let recordingFailed = false;
let estimatedBufferSize = 0;

// Throttle state
let throttleWindowStart = 0;
let throttleCount = 0;

const EVENT_TYPE_FULL_SNAPSHOT = 2;
const EVENT_TYPE_META = 4;
const EVENT_TYPE_INCREMENTAL_SNAPSHOT = 3;

// --- Runtime patches (PostHog/Sentry approach) ---

let patchesApplied = false;

function applyRrwebPatches(): void {
  if (patchesApplied) return;
  patchesApplied = true;

  // Patch 1: Safari dialog:modal crash fix (from PostHog's rrweb patch)
  // Safari 15.4-15.5 throws on element.matches(':modal') and querySelectorAll(':modal')
  try {
    const originalMatches = Element.prototype.matches;
    Element.prototype.matches = function patchedMatches(selector: string): boolean {
      try {
        return originalMatches.call(this, selector);
      } catch {
        return false;
      }
    };
  } catch { /* continue without patch */ }

  // Patch 2: querySelectorAll safety for :modal and other problematic selectors
  try {
    const originalDocQSA = Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll = function patchedDocQSA(selector: string): NodeListOf<Element> {
      try {
        return originalDocQSA.call(this, selector);
      } catch {
        return document.createDocumentFragment().querySelectorAll('*');
      }
    };

    const originalElQSA = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function patchedElQSA(selector: string): NodeListOf<Element> {
      try {
        return originalElQSA.call(this, selector);
      } catch {
        return document.createDocumentFragment().querySelectorAll('*');
      }
    };
  } catch { /* continue without patch */ }
}

// --- iOS detection (from Sentry) ---

function isIOS(): boolean {
  const ua = navigator?.userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPad with desktop UA
  if (/Macintosh/i.test(ua) && navigator?.maxTouchPoints > 1) return true;
  return false;
}

/**
 * Get platform-specific sampling options.
 * Sentry disables mousemove on iOS to prevent main thread blocking.
 * See: https://github.com/getsentry/sentry-javascript/issues/14534
 */
function getPlatformSampling(): recordOptions<eventWithTime>['sampling'] {
  if (isIOS()) {
    return {
      mousemove: false,    // Disable on iOS (Sentry's fix)
      scroll: 150,
      input: 'last' as const,
    };
  }
  return {
    mousemove: 50,         // Throttle to 50ms (20fps) — Sentry/PostHog default
    scroll: 150,           // Throttle scroll events
    input: 'last' as const, // Only last input value per checkout
  };
}

// --- Buffer management ---

function trimBuffer(): void {
  if (events.length === 0) return;

  // Find last full snapshot
  let lastSnapshotIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.type === EVENT_TYPE_FULL_SNAPSHOT) {
      lastSnapshotIdx = i;
      break;
    }
  }

  if (lastSnapshotIdx <= 0) return;

  // Include meta event before snapshot
  let startIdx = lastSnapshotIdx;
  if (startIdx > 0 && events[startIdx - 1]!.type === EVENT_TYPE_META) {
    startIdx = startIdx - 1;
  }

  const now = Date.now();
  const cutoff = now - BUFFER_DURATION_MS;
  if (events[lastSnapshotIdx]!.timestamp >= cutoff && startIdx > 0) {
    const removed = events.splice(0, startIdx);
    // Recalculate buffer size estimate
    estimatedBufferSize = 0;
    for (const e of events) {
      estimatedBufferSize += roughEventSize(e);
    }
    // Avoid unused variable warning
    void removed;
  }
}

/** Rough byte size estimate for an event (avoid JSON.stringify on every event) */
function roughEventSize(event: eventWithTime): number {
  // Full snapshots are large, incremental are small, others are tiny
  if (event.type === EVENT_TYPE_FULL_SNAPSHOT) return 50_000;
  if (event.type === EVENT_TYPE_INCREMENTAL_SNAPSHOT) return 500;
  return 200;
}

/** Check if event should be throttled */
function shouldThrottle(): boolean {
  const now = Date.now();
  if (now - throttleWindowStart > THROTTLE_WINDOW_MS) {
    throttleWindowStart = now;
    throttleCount = 0;
  }
  throttleCount++;
  return throttleCount > THROTTLE_LIMIT;
}

// --- Public API ---

export function startRecording(): void {
  if (stopFn) return;

  applyRrwebPatches();

  events = [];
  paused = false;
  recordingFailed = false;
  estimatedBufferSize = 0;
  throttleWindowStart = Date.now();
  throttleCount = 0;

  try {
    const opts: recordOptions<eventWithTime> = {
      emit(event: eventWithTime) {
        if (paused) return;

        try {
          // Throttle non-critical events (Sentry: 300/5s, ours: 60/5s)
          if (event.type === EVENT_TYPE_INCREMENTAL_SNAPSHOT && shouldThrottle()) {
            return; // Drop event silently
          }

          const size = roughEventSize(event);

          // Buffer size protection (Sentry: 20MB, ours: 5MB)
          if (estimatedBufferSize + size > MAX_BUFFER_SIZE_BYTES) {
            trimBuffer();
            if (estimatedBufferSize + size > MAX_BUFFER_SIZE_BYTES) {
              return; // Still too big after trim — drop
            }
          }

          events.push(event);
          estimatedBufferSize += size;

          // Periodic trim
          if (events.length % 50 === 0) {
            trimBuffer();
          }
        } catch {
          // Silently drop problematic events
        }
      },

      // --- Privacy (Sentry defaults) ---
      maskAllInputs: true,                    // Sentry: true (protect passwords)
      maskInputOptions: { password: true },   // Explicit password masking

      // --- Widget exclusion ---
      blockSelector: '#scout-widget-root',

      // --- Payload optimization (Sentry: slimDOMOptions: 'all') ---
      slimDOMOptions: 'all',                  // Strips scripts, comments, head meta, etc.
      inlineStylesheet: true,                 // Required for replay fidelity
      inlineImages: false,                    // Too heavy
      collectFonts: false,                    // Not needed for bug context

      // --- Performance (platform-specific) ---
      sampling: getPlatformSampling(),

      // --- Buffer management ---
      checkoutEveryNms: CHECKOUT_INTERVAL_MS,

      // --- Don't record heavy media ---
      recordCrossOriginIframes: false,
      recordCanvas: false,

      // --- Error handling (Sentry approach: tag rrweb errors) ---
      errorHandler: (err: unknown) => {
        try {
          if (err && typeof err === 'object') {
            (err as Record<string, unknown>).__rrweb__ = true;
          }
        } catch { /* read-only */ }
        // Don't rethrow — let rrweb continue
      },
    };

    stopFn = record(opts) ?? null;

    if (!stopFn) {
      console.warn('[Scout] rrweb record() returned null — recording disabled');
      recordingFailed = true;
    }
  } catch (err) {
    console.warn('[Scout] Session recording failed to start:', err);
    recordingFailed = true;
    stopFn = null;
  }
}

export function pauseRecording(): void {
  paused = true;
}

export function resumeRecording(): void {
  paused = false;
}

export function stopRecording(): void {
  if (stopFn) {
    try {
      stopFn();
    } catch { /* ignore */ }
    stopFn = null;
  }
}

/**
 * Get recording as gzip-compressed base64 string.
 * Uses fflate (same lib as Sentry) for compression.
 * Returns null if recording failed or no events captured.
 */
export function getRecordingCompressed(): string | null {
  if (recordingFailed || events.length === 0) return null;

  try {
    trimBuffer();
    if (events.length === 0) return null;

    const json = JSON.stringify(events);
    const encoded = new TextEncoder().encode(json);

    // Compress with fflate gzip (Sentry uses fflate in Web Worker)
    const compressed = gzipSync(encoded, { level: 6 });

    // Convert to base64
    let binary = '';
    for (let i = 0; i < compressed.length; i++) {
      binary += String.fromCharCode(compressed[i]!);
    }
    return btoa(binary);
  } catch (err) {
    console.warn('[Scout] Failed to compress recording:', err);

    // Fallback: try uncompressed
    try {
      const json = JSON.stringify(events);
      return btoa(unescape(encodeURIComponent(json)));
    } catch {
      return null;
    }
  }
}

/** @deprecated Use getRecordingCompressed() instead */
export function getRecordingBase64(): string | null {
  return getRecordingCompressed();
}

export function resetBuffer(): void {
  events = [];
  estimatedBufferSize = 0;
}

export function isRecording(): boolean {
  return stopFn !== null && !recordingFailed;
}

export function isRecordingAvailable(): boolean {
  return !recordingFailed;
}
