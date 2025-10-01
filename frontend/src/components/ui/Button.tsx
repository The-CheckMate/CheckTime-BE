import React, { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

export const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={clsx(
        'px-6 py-4 rounded-md font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors',
        className,
      )}
      {...props}
    />
  );
});

Button.displayName = 'Button';
