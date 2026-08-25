'use client';

import { useState, useEffect } from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
}

const CHARACTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

const sizeMap: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'text-base w-4 h-4',
  md: 'text-xl w-6 h-6',
  lg: 'text-3xl w-10 h-10',
  xl: 'text-5xl w-14 h-14',
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
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const sizeClass = sizeMap[size];

  return (
    <span
      className={`font-fantasy flex items-center justify-center select-none ${sizeClass} ${className}`}
      style={color ? { color } : undefined}
    >
      {CHARACTERS[index]}
    </span>
  );
}
