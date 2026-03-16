import { useEffect, useRef, useState, useCallback } from 'react';

interface SessionPlayerProps {
  recordingPath: string;
}

interface RRWebEvent {
  type: number;
  timestamp: number;
  data?: { width?: number; height?: number; href?: string };
}

/**
 * Session replay player using raw rrweb Replayer (not rrweb-player).
 * Pattern from PostHog/Highlight: CSS transform: scale() for responsive fit.
 */
export default function SessionPlayer({ recordingPath }: SessionPlayerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<{ wrapper: HTMLElement; play: () => void; pause: () => void; getMirror: () => unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [totalTime, setTotalTime] = useState('00:00');

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  // Scale replayer to fit container — PostHog/Highlight pattern
  const scaleToFit = useCallback(() => {
    const replayer = replayerRef.current;
    const container = wrapperRef.current;
    if (!replayer?.wrapper || !container) return;

    const iframe = replayer.wrapper.querySelector('iframe');
    if (!iframe) return;

    const replayWidth = iframe.width ? parseInt(iframe.width) : (iframe as HTMLIFrameElement).contentWindow?.innerWidth || 1440;
    const replayHeight = iframe.height ? parseInt(iframe.height) : (iframe as HTMLIFrameElement).contentWindow?.innerHeight || 900;

    const containerWidth = container.clientWidth;
    // Cap at 0.999 to avoid Chrome GPU compositing bug (PostHog fix)
    const scale = Math.min(containerWidth / replayWidth, 0.999);
    const scaledHeight = Math.round(replayHeight * scale);

    replayer.wrapper.style.transformOrigin = 'top left';
    replayer.wrapper.style.transform = `scale(${scale})`;
    replayer.wrapper.style.width = `${replayWidth}px`;
    replayer.wrapper.style.height = `${replayHeight}px`;

    // Set frame container height to match scaled replay
    if (frameRef.current) {
      frameRef.current.style.height = `${scaledHeight}px`;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayer() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(recordingPath);
        if (!res.ok) throw new Error(`Не удалось загрузить запись: ${res.status}`);
        const events: RRWebEvent[] = await res.json();

        if (cancelled || !frameRef.current) return;

        // Check if events have FullSnapshot (type 2)
        const hasFullSnapshot = events.some((e) => e.type === 2);
        if (!hasFullSnapshot) {
          setError('Запись повреждена: отсутствует начальный снимок страницы');
          setLoading(false);
          return;
        }

        // Calculate total duration
        const first = events[0]?.timestamp || 0;
        const last = events[events.length - 1]?.timestamp || 0;
        setTotalTime(formatTime(last - first));

        // Dynamic import to avoid SSR issues
        const { Replayer } = await import('rrweb');

        if (cancelled || !frameRef.current) return;

        frameRef.current.innerHTML = '';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const replayer = new Replayer(events as any, {
          root: frameRef.current,
          triggerFocus: false,
          mouseTail: {
            strokeStyle: '#3b82f6',
            lineWidth: 2,
          },
          UNSAFE_replayCanvas: true,
          useVirtualDom: false,
        });

        replayerRef.current = replayer as unknown as typeof replayerRef.current;

        // Listen for resize events from recorded session
        replayer.on('resize', () => scaleToFit());

        // Timer update
        replayer.on('event-cast', (e: unknown) => {
          const ev = e as { timestamp?: number };
          if (first && ev.timestamp) {
            setCurrentTime(formatTime(ev.timestamp - first));
          }
        });

        replayer.on('finish', () => setPlaying(false));

        // Initial scale after first render
        setTimeout(scaleToFit, 100);

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить запись');
          setLoading(false);
        }
      }
    }

    loadPlayer();

    // Re-scale on window resize
    window.addEventListener('resize', scaleToFit);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', scaleToFit);
      if (frameRef.current) {
        frameRef.current.innerHTML = '';
      }
      replayerRef.current = null;
    };
  }, [recordingPath, scaleToFit]);

  const togglePlay = () => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    if (playing) {
      (replayer as unknown as { pause: () => void }).pause();
      setPlaying(false);
    } else {
      (replayer as unknown as { play: (t?: number) => void }).play();
      setPlaying(true);
    }
  };

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
      {/* Replay frame — scaled to fit container */}
      <div
        ref={frameRef}
        className="w-full overflow-hidden rounded-t-lg border border-gray-200 bg-white relative"
      />
      {/* Simple controls */}
      {!loading && !error && (
        <div className="flex items-center gap-3 rounded-b-lg border border-t-0 border-gray-200 bg-gray-50 px-4 py-2">
          <button
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            title={playing ? 'Пауза' : 'Воспроизвести'}
          >
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="1" y="1" width="3.5" height="10" rx="1" />
                <rect x="7.5" y="1" width="3.5" height="10" rx="1" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <polygon points="2,0 12,6 2,12" />
              </svg>
            )}
          </button>
          <span className="text-xs font-mono text-gray-500">
            {currentTime} / {totalTime}
          </span>
        </div>
      )}
    </div>
  );
}
