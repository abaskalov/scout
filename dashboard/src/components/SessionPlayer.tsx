import { useEffect, useRef, useState } from 'react';

interface SessionPlayerProps {
  recordingPath: string;
}

interface RRWebEvent {
  type: number;
  data?: { width?: number; height?: number };
}

export default function SessionPlayer({ recordingPath }: SessionPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const playerRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayer() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(recordingPath);
        if (!res.ok) throw new Error(`Не удалось загрузить запись: ${res.status}`);
        const events: RRWebEvent[] = await res.json();

        if (cancelled || !containerRef.current || !wrapperRef.current) return;

        const rrwebPlayer = await import('rrweb-player');
        await import('rrweb-player/dist/style.css');

        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';

        // Extract original viewport from Meta event (type 4)
        const metaEvent = events.find((e) => e.type === 4);
        const originalWidth = metaEvent?.data?.width || 1440;
        const originalHeight = metaEvent?.data?.height || 900;

        // Use original viewport dimensions so recorded page CSS renders correctly.
        // Container scrolls horizontally if player is wider than available space.
        const RRWebPlayer = rrwebPlayer.default;
        playerRef.current = new RRWebPlayer({
          target: containerRef.current,
          props: {
            events,
            width: originalWidth,
            height: originalHeight,
            autoPlay: false,
            showController: true,
          },
        });

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить запись');
          setLoading(false);
        }
      }
    }

    loadPlayer();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      playerRef.current = null;
    };
  }, [recordingPath]);

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="w-full">
      {loading && (
        <div className="py-4 text-sm text-gray-500">Загрузка записи...</div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto rounded-lg border border-gray-200"
      />
    </div>
  );
}
