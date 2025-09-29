'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StarBorderProps {
  className?: string;
  children?: React.ReactNode;
  colors?: string[];
  speed?: string;
}

export default function StarBorder({
  className,
  children,
  colors = ['#8b5cf6', '#ec4899', '#8b5cf6'],
  speed = '6s'
}: StarBorderProps) {
  const gradientColors = colors.join(', ');

  return (
    <div className={cn('relative', className)}>
      {/* Animated gradient border */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          padding: '2px',
          background: `linear-gradient(90deg, ${gradientColors})`,
          backgroundSize: '200% 100%',
          animation: `gradient ${speed} linear infinite`,
        }}
      >
        <div className="h-full w-full rounded-lg bg-background" />
      </div>

      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-lg opacity-30 blur-xl"
        style={{
          background: `linear-gradient(90deg, ${gradientColors})`,
          backgroundSize: '200% 100%',
          animation: `gradient ${speed} linear infinite`,
        }}
      />

      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          >
            <svg
              className="h-2 w-2 text-violet-500/50"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}