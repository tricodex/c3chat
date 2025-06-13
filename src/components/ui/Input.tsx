import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full px-3 py-2 bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-lg",
          "text-[var(--c3-text-primary)] placeholder-[var(--c3-text-tertiary)]",
          "focus:outline-none focus:border-[var(--c3-primary)] focus:ring-2 focus:ring-[var(--c3-primary)]/20",
          "transition-all duration-200",
          "backdrop-filter backdrop-blur-sm",
          {
            "border-[var(--c3-error)] focus:border-[var(--c3-error)] focus:ring-[var(--c3-error)]/20": error,
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input }; 