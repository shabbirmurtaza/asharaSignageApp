interface Props {
  className?: string;
}

export const Skeleton = ({ className = 'h-4 w-full' }: Props) => (
  <div className={`animate-pulse rounded bg-tertiary ${className}`} />
);
