import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-md border border-[rgba(23,34,31,0.12)] bg-white px-3 py-2 text-sm text-[#17221f] outline-none transition-colors placeholder:text-[#55635d] focus:border-[#cc6d2c] focus:ring-2 focus:ring-[#cc6d2c]/20",
        className
      )}
      {...props}
    />
  );
}
