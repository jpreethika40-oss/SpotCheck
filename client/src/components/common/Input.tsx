import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-charcoal">
            {label}
            {props.required && <span className="text-crimson ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-charcoal placeholder:text-muted/60 transition-colors focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta disabled:bg-ivory disabled:text-muted ${
            error ? 'border-crimson focus:border-crimson focus:ring-crimson' : 'border-warm'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-crimson font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-muted">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, rows = 3, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-charcoal">
            {label}
            {props.required && <span className="text-crimson ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-charcoal placeholder:text-muted/60 transition-colors focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta disabled:bg-ivory disabled:text-muted ${
            error ? 'border-crimson focus:border-crimson focus:ring-crimson' : 'border-warm'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-crimson font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-muted">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, children, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-charcoal">
            {label}
            {props.required && <span className="text-crimson ml-0.5">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-charcoal transition-colors focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta disabled:bg-ivory disabled:text-muted ${
            error ? 'border-crimson focus:border-crimson focus:ring-crimson' : 'border-warm'
          } ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="text-xs text-crimson font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-muted">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
