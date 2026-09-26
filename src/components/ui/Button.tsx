import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-copper-500 text-white hover:bg-copper-600 border-transparent',
  secondary: 'bg-navy-700 text-white hover:bg-navy-800 border-transparent',
  ghost: 'bg-transparent text-navy-700 hover:bg-stone-100 border-transparent',
  outline: 'bg-white text-navy-700 hover:bg-stone-50 border-stone-300',
  danger: 'bg-copper-600 text-white hover:bg-copper-700 border-transparent',
  success: 'bg-success-500 text-white hover:bg-success-600 border-transparent',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface LinkButtonProps {
  to: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function LinkButton({ to, variant = 'primary', size = 'md', className = '', children }: LinkButtonProps) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-all duration-200 active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
