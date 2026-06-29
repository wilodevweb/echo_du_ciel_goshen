import React, { InputHTMLAttributes, forwardRef, useId } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full flex flex-col mb-4">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--foreground)] mb-1">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`
            flex h-11 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] px-3 py-2 text-sm 
            transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium 
            placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-fiverr focus:border-transparent
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        {!error && helperText && <p className="mt-1 text-sm text-[var(--input-placeholder)]">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
