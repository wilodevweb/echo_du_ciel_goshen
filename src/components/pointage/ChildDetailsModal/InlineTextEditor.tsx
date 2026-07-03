import React from "react";

export function InlineTextEditor({
  value,
  onChange,
  placeholder,
  className = "",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`w-full border-0 bg-transparent p-0 leading-tight text-white placeholder:text-white/30 outline-none ${className}`}
    />
  );
}
