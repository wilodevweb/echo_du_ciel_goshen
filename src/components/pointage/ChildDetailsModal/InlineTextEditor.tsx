import React from "react";

export function InlineTextEditor({
  value,
  onChange,
  placeholder,
  className = "",
  autoFocus = false,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={style}
      className={`w-full border-0 bg-transparent p-0 leading-tight text-white placeholder:text-white/30 outline-none ${className}`}
    />
  );
}
