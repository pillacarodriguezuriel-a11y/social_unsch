import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

/**
 * Componente atómico de botón estilizado según el Crimson Heritage Design System.
 */
export function Button({
  children,
  variant = 'primary',
  isLoading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'relative w-full py-3.5 px-6 rounded-xl text-sm font-bold tracking-wide transition-all outline-none flex items-center justify-center gap-2 select-none shadow-sm active:scale-[0.99] cursor-pointer';

  const variants = {
    primary:
      'bg-primary hover:bg-primary/95 text-surface focus:ring-4 focus:ring-primary/20 disabled:bg-neutral-gray/30 disabled:text-neutral-gray/60 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none',
    secondary:
      'bg-surface hover:bg-secondary/10 text-primary border border-secondary/30 focus:ring-4 focus:ring-secondary/15 disabled:bg-surface disabled:text-neutral-gray/40 disabled:border-secondary/10 disabled:cursor-not-allowed',
    ghost:
      'bg-transparent hover:bg-primary/5 text-primary focus:ring-4 focus:ring-primary/5 disabled:text-neutral-gray/40 disabled:bg-transparent disabled:cursor-not-allowed',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}
