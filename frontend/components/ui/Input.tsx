import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md text-base text-gray-900 caret-gray-900 placeholder:text-gray-400 bg-white
                     focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent
                     disabled:bg-gray-50 disabled:text-gray-500
                     ${error ? 'border-danger' : ''}
                     ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
