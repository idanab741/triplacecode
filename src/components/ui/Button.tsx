import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = כפתור ראשי עם גרדיאנט כחול. secondary = כפתור משני אפור. */
  variant?: ButtonVariant;
  fullWidth?: boolean;
  /** אם מועבר, הכפתור מוצג כקישור ניווט (Link) במקום <button>. */
  href?: string;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white shadow-soft",
  secondary: "bg-bg-secondary text-ink",
};

export function Button({
  variant = "primary",
  fullWidth = false,
  href,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none ${
    fullWidth ? "w-full" : ""
  } ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
