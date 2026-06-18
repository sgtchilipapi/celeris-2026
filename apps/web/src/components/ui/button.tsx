import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function buttonVariants(options: { variant?: ButtonVariant; className?: string } = {}) {
  const variant = options.variant ?? "default";

  return cn(
    "inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-medium no-underline transition-colors disabled:pointer-events-none disabled:opacity-60 [&.disabled]:pointer-events-none [&.disabled]:opacity-60",
    variant === "default" && "border-transparent bg-[#17221f] text-white hover:bg-[#24332f]",
    variant === "secondary" && "border-[rgba(23,34,31,0.12)] bg-transparent text-[#17221f] hover:bg-[rgba(23,34,31,0.05)]",
    variant === "ghost" && "border-transparent bg-transparent text-[#17221f] hover:bg-[rgba(23,34,31,0.05)]",
    options.className
  );
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, className })} {...props} />;
}
