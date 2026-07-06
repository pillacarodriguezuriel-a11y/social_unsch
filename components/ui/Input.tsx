import React, { ForwardedRef, forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: boolean;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Componente atómico de entrada de datos adaptado al Crimson Heritage Design System.
 * Soporta estados de error, iconos izquierdo/derecho y etiquetas institucionales.
 */
const Input = forwardRef(
  (
    { label, error, helperText, leftIcon, rightIcon, className = '', ...props }: InputProps,
    ref: ForwardedRef<HTMLInputElement>
  ) => {
    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label className="text-xs font-bold text-neutral-gray uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-4 text-neutral-gray pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full px-4 py-3 text-sm font-medium bg-white border ${
              error
                ? 'border-primary focus:ring-primary/20 focus:border-primary'
                : 'border-secondary/40 focus:ring-primary/10 focus:border-primary'
            } text-primary placeholder:text-neutral-gray/50 rounded-xl transition-all outline-none focus:ring-4 ${
              leftIcon ? 'pl-11' : ''
            } ${rightIcon ? 'pr-11' : ''} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 text-neutral-gray flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {helperText && (
          <span className={`text-xs font-semibold ${error ? 'text-primary' : 'text-neutral-gray/70'}`}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
