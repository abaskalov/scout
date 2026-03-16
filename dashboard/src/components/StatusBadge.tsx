const colorMap: Record<string, string> = {
  new: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  review: 'bg-purple-100 text-purple-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const labelMap: Record<string, string> = {
  new: 'New',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export default function StatusBadge({ status }: { status: string }) {
  const color = colorMap[status] ?? 'bg-gray-100 text-gray-600';
  const label = labelMap[status] ?? status;

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}
