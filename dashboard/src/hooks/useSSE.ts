import { useEffect, useRef } from 'react';

const SSE_EVENTS = [
  'item.created',
  'item.updated',
  'item.deleted',
  'item.status_changed',
  'item.assigned',
  'item.commented',
] as const;

export type SSEEventType = typeof SSE_EVENTS[number];

interface SSEOptions {
  projectId?: string | number | null;
  onEvent: (event: SSEEventType, data: unknown) => void;
}

export function useSSE({ projectId, onEvent }: SSEOptions): void {
  // Keep a stable ref to the callback so we don't reconnect on every render
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const token = localStorage.getItem('scout_token');
    if (!token) return;

    const params = new URLSearchParams({ token });
    if (projectId != null) params.set('projectId', String(projectId));

    const url = `/api/events/stream?${params}`;
    const source = new EventSource(url);

    for (const eventType of SSE_EVENTS) {
      source.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = e.data ? JSON.parse(e.data) : {};
          onEventRef.current(eventType, data);
        } catch {
          // Malformed data — ignore
        }
      });
    }

    // EventSource auto-reconnects on error — no manual handling needed

    return () => {
      source.close();
    };
  }, [projectId]);
}
