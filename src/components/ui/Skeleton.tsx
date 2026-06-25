import { HTMLAttributes } from "react";

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}
