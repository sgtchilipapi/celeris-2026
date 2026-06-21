import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function buttonVariants(options: { variant?: ButtonVariant; className?: string } = {}) {
  const variant = options.variant ?? "default";

  return cn(
    "inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold no-underline transition-colors disabled:pointer-events-none disabled:opacity-60 [&.disabled]:pointer-events-none [&.disabled]:opacity-60",
    variant === "default" &&
      "border-transparent bg-[linear-gradient(135deg,#8b5cf6,#22d3ee)] text-white shadow-[0_0_32px_rgba(139,92,246,0.24)] hover:border-white/20",
    variant === "secondary" && "border-white/10 bg-white/[0.04] text-slate-50 hover:bg-white/[0.07]",
    variant === "ghost" && "border-transparent bg-transparent text-slate-100 hover:bg-white/[0.06]",
    options.className
  );
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, className })} {...props} />;
}
