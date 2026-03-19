const colorMap: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-600',
};

const labelMap: Record<string, string> = {
  critical: 'Критический',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

export default function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority) return null;
  const color = colorMap[priority] ?? 'bg-gray-100 text-gray-600';
  const label = labelMap[priority] ?? priority;

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}

export { colorMap as priorityColorMap, labelMap as priorityLabelMap };
