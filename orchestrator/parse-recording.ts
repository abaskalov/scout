/**
 * Parse rrweb recording JSON into human-readable text log.
 * Used to provide AI agent with reproduction steps.
 */

interface RRWebEvent {
  type: number;
  timestamp: number;
  data: {
    source?: number;
    type?: number;
    x?: number;
    y?: number;
    tag?: string;
    text?: string;
    href?: string;
    selector?: string;
    // rrweb event data varies by type
    [key: string]: unknown;
  };
}

// rrweb event types
const EVENT_TYPE = {
  DomContentLoaded: 0,
  Load: 1,
  FullSnapshot: 2,
  IncrementalSnapshot: 3,
  Meta: 4,
  Custom: 5,
} as const;

// rrweb incremental source types
const INCREMENTAL_SOURCE = {
  Mutation: 0,
  MouseMove: 1,
  MouseInteraction: 2,
  Scroll: 3,
  ViewportResize: 4,
  Input: 5,
  TouchMove: 6,
  MediaInteraction: 7,
  StyleSheetRule: 8,
} as const;

// Mouse interaction types
const MOUSE_INTERACTION = {
  0: 'mouseup',
  1: 'mousedown',
  2: 'click',
  3: 'contextmenu',
  4: 'dblclick',
  5: 'focus',
  6: 'blur',
  7: 'touchstart',
  8: 'touchmove_departed',
  9: 'touchend',
} as const;

export function parseRecording(jsonString: string): string {
  let events: RRWebEvent[];
  try {
    events = JSON.parse(jsonString);
  } catch {
    return 'Failed to parse recording JSON';
  }

  if (!Array.isArray(events) || events.length === 0) {
    return 'Empty recording';
  }

  const startTime = events[0]!.timestamp;
  const lines: string[] = [];

  for (const event of events) {
    const seconds = ((event.timestamp - startTime) / 1000).toFixed(1);

    if (event.type === EVENT_TYPE.Meta) {
      const href = event.data?.href;
      if (href) lines.push(`[${seconds}s] page: ${href}`);
      continue;
    }

    if (event.type !== EVENT_TYPE.IncrementalSnapshot) continue;

    const source = event.data?.source;

    // Mouse interactions (clicks)
    if (source === INCREMENTAL_SOURCE.MouseInteraction) {
      const interactionType = event.data?.type as number;
      const actionName = MOUSE_INTERACTION[interactionType as keyof typeof MOUSE_INTERACTION];
      if (actionName === 'click' || actionName === 'dblclick') {
        const selector = event.data?.selector || `(${event.data?.x}, ${event.data?.y})`;
        lines.push(`[${seconds}s] ${actionName}: ${selector}`);
      }
    }

    // Scroll
    if (source === INCREMENTAL_SOURCE.Scroll) {
      const y = event.data?.y;
      if (typeof y === 'number') {
        lines.push(`[${seconds}s] scroll: ${y}px`);
      }
    }

    // Input (typing)
    if (source === INCREMENTAL_SOURCE.Input) {
      const text = event.data?.text;
      const selector = event.data?.selector;
      if (text) {
        lines.push(`[${seconds}s] type: "${text.toString().substring(0, 100)}" in ${selector || 'input'}`);
      }
    }

    // Viewport resize
    if (source === INCREMENTAL_SOURCE.ViewportResize) {
      const width = event.data?.width;
      const height = event.data?.height;
      if (width && height) {
        lines.push(`[${seconds}s] viewport: ${width}x${height}`);
      }
    }
  }

  if (lines.length === 0) {
    return 'No significant user actions recorded';
  }

  return lines.join('\n');
}

/**
 * Load and parse recording from file path.
 */
export async function parseRecordingFile(filePath: string): Promise<string> {
  const { readFileSync } = await import('node:fs');
  const json = readFileSync(filePath, 'utf-8');
  return parseRecording(json);
}
