import React from 'react';
import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export const Input = React.forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={clsx(
        'px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
