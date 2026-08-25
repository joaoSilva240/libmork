import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-secondary-muted mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-2 border rounded-lg bg-dominant-dark text-secondary-pure placeholder-secondary-muted/60
            focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-vibrant
            disabled:bg-dominant-container disabled:text-secondary-muted disabled:cursor-not-allowed
            ${error ? 'border-accent-dark' : 'border-secondary-border'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-accent-vibrant">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
