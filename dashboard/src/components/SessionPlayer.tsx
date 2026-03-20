import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from '../i18n';

// rrweb replayer styles — injected into player container
const REPLAYER_CSS = `
.replayer-wrapper { position: relative !important; }
.replayer-wrapper iframe {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  z-index: 1 !important;
  border: none !important;
}
.replayer-mouse {
  position: absolute !important;
  z-index: 100 !important;
  width: 20px;
  height: 20px;
  transition: left 0.05s linear, top 0.05s linear;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
  background-image: url('data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjMDAwMDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGRhdGEtbmFtZT0iTGF5ZXIgMSIgdmlld0JveD0iMCAwIDUwIDUwIiB4PSIwcHgiIHk9IjBweCI+PHRpdGxlPkRlc2lnbl90bnA8L3RpdGxlPjxwYXRoIGQ9Ik00OC43MSw0Mi45MUwzNC4wOCwyOC4yOSw0NC4zMywxOEExLDEsMCwwLDAsNDQsMTYuMzlMMi4zNSwxLjA2QTEsMSwwLDAsMCwxLjA2LDIuMzVMMTYuMzksNDRhMSwxLDAsMCwwLDEuNjUuMzZMMjguMjksMzQuMDgsNDIuOTEsNDguNzFhMSwxLDAsMCwwLDEuNDEsMGw0LjM4LTQuMzhBMSwxLDAsMCwwLDQ4LjcxLDQyLjkxWm0tNS4wOSwzLjY3TDI5LDMyYTEsMSwwLDAsMC0xLjQxLDBsLTkuODUsOS44NUwzLjY5LDMuNjlsMzguMTIsMTRMMzIsMjcuNThBMSwxLDAsMCwwLDMyLDI5TDQ2LjU5LDQzLjYyWiI+PC9wYXRoPjwvc3ZnPg==');
}
.replayer-mouse::after {
  content: '';
  display: inline-block;
  width: 32px;
  height: 32px;
  background: rgb(73, 80, 246);
  border-radius: 100%;
  transform: translate(-50%, -50%);
  opacity: 0.3;
}
.replayer-mouse.active::after {
  animation: click 0.4s ease-in-out 1;
}
.replayer-mouse-tail {
  position: absolute !important;
  z-index: 99 !important;
  pointer-events: none;
}
@keyframes click {
  0% { opacity: 0.3; width: 40px; height: 40px; }
  50% { opacity: 0.6; width: 16px; height: 16px; }
  100% { opacity: 0.3; width: 32px; height: 32px; }
}
`;

interface SessionPlayerProps {
  recordingPath: string;
}

export default function SessionPlayer({ recordingPath }: SessionPlayerProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<any>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [totalTime, setTotalTime] = useState('00:00');
  const [duration, setDuration] = useState(0);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const rescale = useCallback(() => {
    const replayer = replayerRef.current;
    const container = wrapperRef.current;
    if (!replayer?.wrapper || !container || !frameRef.current) return;

    const iframe = replayer.wrapper.querySelector('iframe');
    if (!iframe) return;

    const w = parseInt(iframe.width) || 1440;
    const h = parseInt(iframe.height) || 900;
    const containerW = container.clientWidth;
    const scale = Math.min(containerW / w, 1);

    // Keep original aspect ratio, ensure minimum visible height
    const scaledH = Math.round(h * scale);
    const minH = 400;
    const finalH = Math.max(scaledH, minH);

    replayer.wrapper.style.transformOrigin = 'top left';
    replayer.wrapper.style.transform = `scale(${scale})`;
    replayer.wrapper.style.position = 'relative';
    replayer.wrapper.style.width = `${w}px`;
    replayer.wrapper.style.height = `${h}px`;

    frameRef.current.style.height = `${finalH}px`;
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const r = replayerRef.current;
      if (!r || !duration) return;
      const meta = r.getMetaData?.();
      if (!meta) return;
      const elapsed = r.getCurrentTime?.() || 0;
      setCurrentTime(fmt(elapsed));
      setProgress(Math.min(100, (elapsed / duration) * 100));
    }, 200);
  }, [duration]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(recordingPath);
        if (!res.ok) throw new Error(t('items.detail.recording.loadError', { status: String(res.status) }));
        const events = await res.json();

        if (cancelled || !frameRef.current) return;

        if (!events.some((e: any) => e.type === 2)) {
          setError(t('items.detail.recording.corrupted'));
          setLoading(false);
          return;
        }

        const first = events[0]?.timestamp || 0;
        const last = events[events.length - 1]?.timestamp || 0;
        const dur = last - first;
        setDuration(dur);
        setTotalTime(fmt(dur));

        const { Replayer } = await import('rrweb');
        if (cancelled || !frameRef.current) return;

        // Clear the container before initializing rrweb replayer
        while (frameRef.current.firstChild) {
          frameRef.current.removeChild(frameRef.current.firstChild);
        }

        // Set up MutationObserver BEFORE Replayer init to intercept cross-origin
        // <link> stylesheets as they're inserted into the replay iframe.
        // rrweb inlines CSS during recording (inlineStylesheet:true), so external
        // links are redundant — removing them prevents CORS errors.
        const hostname = window.location.hostname;
        function removeCrossOriginLinks(root: Node): void {
          (root as Element).querySelectorAll?.('link[rel="stylesheet"]')?.forEach((link: Element) => {
            const href = link.getAttribute('href') || '';
            if (href.startsWith('http') && !href.includes(hostname)) {
              link.setAttribute('href', ''); // Prevent fetch before removal
              link.remove();
            }
          });
        }

        try {
          observerRef.current = new MutationObserver((mutations) => {
            for (const m of mutations) {
              for (const node of m.addedNodes) {
                if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
                  const href = node.getAttribute('href') || '';
                  if (href.startsWith('http') && !href.includes(hostname)) {
                    node.setAttribute('href', '');
                    node.remove();
                  }
                }
                if (node instanceof HTMLElement) {
                  removeCrossOriginLinks(node);
                }
              }
            }
          });
        } catch { /* MutationObserver not available */ }

        const replayer = new Replayer(events as any, {
          root: frameRef.current,
          triggerFocus: false,
          UNSAFE_replayCanvas: true,
          skipInactive: true,
          mouseTail: { strokeStyle: '#3b82f6', lineWidth: 2 },
          loadTimeout: 0,
        });

        // Observe the replay iframe for cross-origin link insertions
        try {
          const iframe = replayer.wrapper?.querySelector('iframe');
          const iframeDoc = iframe?.contentDocument;
          if (iframeDoc && observerRef.current) {
            removeCrossOriginLinks(iframeDoc);
            observerRef.current.observe(iframeDoc, { childList: true, subtree: true });
          }
        } catch { /* cross-origin iframe — ignore */ }

        replayerRef.current = replayer;
        replayer.pause(0);

        // Inject cursor/mouse styles into player container
        const styleEl = document.createElement('style');
        styleEl.textContent = REPLAYER_CSS;
        frameRef.current.prepend(styleEl);

        replayer.on('finish', () => {
          setPlaying(false);
          stopTimer();
        });

        requestAnimationFrame(() => {
          rescale();
          setLoading(false);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('items.detail.recording.genericError'));
          setLoading(false);
        }
      }
    }

    load();
    window.addEventListener('resize', rescale);

    return () => {
      cancelled = true;
      stopTimer();
      window.removeEventListener('resize', rescale);
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      replayerRef.current = null;
      if (frameRef.current) {
        while (frameRef.current.firstChild) {
          frameRef.current.removeChild(frameRef.current.firstChild);
        }
        frameRef.current.style.height = '';
      }
    };
  }, [recordingPath, rescale]);

  const toggle = () => {
    const r = replayerRef.current;
    if (!r) return;
    if (playing) {
      r.pause();
      setPlaying(false);
      stopTimer();
    } else {
      // If at end, restart from beginning
      const current = r.getCurrentTime?.() || 0;
      const atEnd = duration > 0 && current >= duration - 100;
      const startFrom = atEnd ? 0 : current;
      if (atEnd) {
        setProgress(0);
        setCurrentTime('00:00');
      }
      r.play(startFrom);
      r.setConfig?.({ speed });
      setPlaying(true);
      startTimer();
    }
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    const r = replayerRef.current;
    if (r) r.setConfig?.({ speed: s });
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = replayerRef.current;
    if (!r || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = Math.round(pct * duration);
    r.pause(time);
    setCurrentTime(fmt(time));
    setProgress(pct * 100);
    if (playing) {
      r.play(time);
      r.setConfig?.({ speed });
    }
  };

  return (
    <div ref={wrapperRef} className="w-full">
      {loading && <div className="py-4 text-sm text-gray-500">{t('items.detail.recording.loading')}</div>}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {!error && (
        <>
          <div ref={frameRef} className="w-full overflow-hidden rounded-t-lg border border-gray-200 bg-white" />
          {!loading && (
            <div className="rounded-b-lg border border-t-0 border-gray-200 bg-gray-50 px-4 py-2">
              {/* Timeline */}
              <div
                className="mb-2 h-1.5 w-full cursor-pointer rounded-full bg-gray-200"
                onClick={seek}
              >
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggle}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
                  title={playing ? t('items.detail.recording.pause') : t('items.detail.recording.play')}
                >
                  {playing ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                      <rect x="1" y="0" width="3" height="10" rx="1" />
                      <rect x="6" y="0" width="3" height="10" rx="1" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                      <polygon points="1,0 10,5 1,10" />
                    </svg>
                  )}
                </button>
                <span className="text-xs font-mono text-gray-500 min-w-[90px]">
                  {currentTime} / {totalTime}
                </span>
                <div className="flex gap-1">
                  {[0.25, 0.5, 1, 2, 4, 8].map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                        speed === s
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
