import { type ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ children, className = '', dot = false }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
      {children}
    </span>
  );
}
