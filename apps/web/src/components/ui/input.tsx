import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm text-slate-50 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/15",
        className
      )}
      {...props}
    />
  );
}
