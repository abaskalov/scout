const LABEL_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
  'bg-violet-100 text-violet-700',
  'bg-lime-100 text-lime-700',
  'bg-rose-100 text-rose-700',
  'bg-emerald-100 text-emerald-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

function getLabelColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length]!;
}

export function parseLabels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((l): l is string => typeof l === 'string');
    return [];
  } catch {
    return [];
  }
}

export default function Labels({ labels, size = 'sm' }: { labels: string[]; size?: 'sm' | 'xs' }) {
  if (labels.length === 0) return null;

  const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'xs' ? 'px-1.5 py-0' : 'px-2 py-0.5';

  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <span
          key={label}
          className={`inline-block rounded-full ${padding} ${textSize} font-medium ${getLabelColor(label)}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
