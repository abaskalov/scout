import { useTranslation } from '../i18n';

const colorMap: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-600',
};

export default function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const { t } = useTranslation();
  if (!priority) return null;
  const color = colorMap[priority] ?? 'bg-gray-100 text-gray-600';
  const label = t(`items.priorities.${priority}`);

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}

export { colorMap as priorityColorMap };
