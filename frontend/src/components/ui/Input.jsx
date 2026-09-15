import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = forwardRef(function Input(
  { label, error, help, className = '', type = 'text', required, id, ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputId = id || props.name;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label} {required && <span className="text-danger-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isPassword && showPassword ? 'text' : type}
          className={`input ${isPassword ? 'pr-10' : ''} ${error ? 'input-error' : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? <p className="error-text">{error}</p> : help ? <p className="help-text">{help}</p> : null}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, help, className = '', id, ...props }, ref) {
  const inputId = id || props.name;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <textarea ref={ref} id={inputId} className={`input ${error ? 'input-error' : ''}`} rows={3} {...props} />
      {error ? <p className="error-text">{error}</p> : help ? <p className="help-text">{help}</p> : null}
    </div>
  );
});

export default Input;
