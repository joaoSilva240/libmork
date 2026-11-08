import { forwardRef, useId, InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, className = "", id, required, "aria-describedby": ariaDescribedBy, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-secondary-muted mb-1">
            {label}
            {required && (
              <span className="ml-1 text-accent-vibrant" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`
            w-full px-4 py-2 border rounded-lg bg-dominant-dark text-secondary-pure placeholder-secondary-muted/60
            focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-vibrant
            disabled:bg-dominant-container disabled:text-secondary-muted disabled:cursor-not-allowed
            ${error ? "border-accent-dark" : "border-secondary-border"}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-accent-vibrant">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
