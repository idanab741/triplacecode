import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-card bg-bg p-6 shadow-soft ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
