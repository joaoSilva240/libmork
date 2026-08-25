'use client';

import { useState, useEffect } from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
}

const CHARACTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// Aumentado em ~50% no tamanho da fonte e dimensões mantendo max-w-full max-h-full overflow-hidden
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
}: SpinnerProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % CHARACTERS.length);
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const sizeClass = sizeMap[size];

  return (
    <span
      className={`font-fantasy inline-flex items-center justify-center leading-none text-white select-none max-w-full max-h-full overflow-hidden ${sizeClass} ${className}`}
      style={color ? { color } : undefined}
    >
      {CHARACTERS[index]}
    </span>
  );
}
