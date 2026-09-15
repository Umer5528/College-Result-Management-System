import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * options: [{ value, label }] OR pass <option> children directly.
 */
const Select = forwardRef(function Select(
  { label, error, help, className = '', options, placeholder, id, required, children, ...props },
  ref
) {
  const selectId = id || props.name;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="label">
          {label} {required && <span className="text-danger-500">*</span>}
        </label>
      )}
      <div className="relative">
        <select ref={ref} id={selectId} className={`select ${error ? 'input-error' : ''}`} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {error ? <p className="error-text">{error}</p> : help ? <p className="help-text">{help}</p> : null}
    </div>
  );
});

export default Select;
