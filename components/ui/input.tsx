import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-accent-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
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
