export interface SSEEvent {
  type: string;
  projectId: string;
  payload: Record<string, unknown>;
}

type EventHandler = (data: SSEEvent) => void;

class EventBus {
  private listeners = new Set<EventHandler>();

  subscribe(handler: EventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  publish(event: SSEEvent): void {
    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch {
        // ignore broken listeners
      }
    }
  }

  /** Number of active listeners (useful for debugging/health checks) */
  get size(): number {
    return this.listeners.size;
  }
}

export const eventBus = new EventBus();
