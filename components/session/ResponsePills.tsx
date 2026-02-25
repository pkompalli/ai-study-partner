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
          className="inline-flex items-center px-3 py-1.5 rounded-full text-sm border border-gray-200 bg-white text-gray-700 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pill}
        </button>
      ))}
    </div>
  );
}
