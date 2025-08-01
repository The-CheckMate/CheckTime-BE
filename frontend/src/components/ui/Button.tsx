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
        'px-4 py-2 rounded-md font-semibold text-white bg-brand-blue-500 hover:bg-brand-blue-700 active:bg-brand-blue-900 transition-colors',
        className,
      )}
      {...props}
    />
  );
});

Button.displayName = 'Button';
