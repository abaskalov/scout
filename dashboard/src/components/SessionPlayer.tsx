import { useEffect, useRef, useState } from 'react';

interface SessionPlayerProps {
  recordingPath: string;
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
        const events = await res.json();

        if (cancelled || !containerRef.current || !wrapperRef.current) return;

        // Dynamically import rrweb-player
        const rrwebPlayer = await import('rrweb-player');
        await import('rrweb-player/dist/style.css');

        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';

        // Calculate responsive size based on container width
        const containerWidth = wrapperRef.current.clientWidth;
        const playerWidth = Math.min(containerWidth, 900);
        const playerHeight = Math.round(playerWidth * 0.6); // 16:10 aspect ratio

        const RRWebPlayer = rrwebPlayer.default;
        playerRef.current = new RRWebPlayer({
          target: containerRef.current,
          props: {
            events,
            width: playerWidth,
            height: playerHeight,
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
      <div ref={containerRef} className="w-full overflow-hidden rounded-lg border border-gray-200" />
    </div>
  );
}
