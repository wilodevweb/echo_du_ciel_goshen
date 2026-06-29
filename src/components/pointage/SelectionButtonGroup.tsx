export type SelectionOption<T extends string> = {
  value: T;
  label: string;
};

export function SelectionButtonGroup<T extends string>({
  options,
  value,
  onChange,
  columns,
  compact = false,
}: {
  options: SelectionOption<T>[];
  value: T;
  onChange: (value: T) => void;
  columns: 2 | 3;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange(option.value);
            }}
            className={`flex items-center justify-center rounded-full border text-center font-bold shadow-sm transition-colors ${
              compact ? "h-11 px-3 text-sm" : "h-12 px-4 text-base"
            } ${
              isSelected
                ? "border-fiverr bg-fiverr/10 text-gray-950"
                : "border-gray-200 bg-gray-50 text-gray-950 hover:border-fiverr hover:bg-fiverr/5"
            }`}
          >
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
