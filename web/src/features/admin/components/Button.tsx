import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-text text-white hover:bg-text/90',
  secondary:
    'bg-card border border-border-strong text-text hover:bg-surface',
  ghost: 'bg-transparent text-text hover:bg-surface',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-[12px]',
  md: 'px-3.5 py-1.5 text-[13px]',
};

export const Button = ({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...rest
}: Props) => (
  <button
    {...rest}
    className={`inline-flex items-center gap-1.5 rounded font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
  />
);
