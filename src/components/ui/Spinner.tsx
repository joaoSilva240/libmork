'use client';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
  glyph?: string;
}

const sizeMap: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'text-xl w-6 h-6 leading-none max-w-full max-h-full overflow-hidden flex items-center justify-center',
  md: 'text-3xl w-9 h-9 leading-none max-w-full max-h-full overflow-hidden flex items-center justify-center',
  lg: 'text-5xl w-15 h-15 leading-none max-w-full max-h-full overflow-hidden flex items-center justify-center',
  xl: 'text-7xl w-21 h-21 leading-none max-w-full max-h-full overflow-hidden flex items-center justify-center',
};

export function Spinner({
  size = 'md',
  className = '',
  color,
  glyph = 'D',
}: SpinnerProps) {
  const sizeClass = sizeMap[size];

  return (
    <span
      className={`font-fantasy inline-flex items-center justify-center leading-none text-purple-400 select-none max-w-full max-h-full overflow-hidden animate-spin ${sizeClass} ${className}`}
      style={color ? { color } : undefined}
    >
      {glyph}
    </span>
  );
}
