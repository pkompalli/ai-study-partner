'use client'
interface ResponsePillsProps {
  followupPills: string[];
  onSelect: (text: string) => void;
  disabled: boolean;
}

export function ResponsePills({ followupPills, onSelect, disabled }: ResponsePillsProps) {
  if (followupPills.length === 0) return null;

  return (
    <div className="ml-10 mt-1.5 mb-1 flex flex-wrap gap-1.5">
      <span className="text-xs text-gray-400 self-center mr-0.5">Explore:</span>
      {followupPills.map((pill, i) => (
        <button
          key={i}
          onClick={() => onSelect(pill)}
          disabled={disabled}
          className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pill}
        </button>
      ))}
    </div>
  );
}
