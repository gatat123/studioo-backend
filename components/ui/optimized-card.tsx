'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  enableHover?: boolean;
}

// 메모이제이션으로 불필요한 리렌더링 방지
const OptimizedCard = memo(function OptimizedCard({
  children,
  onClick,
  className = '',
  enableHover = true
}: OptimizedCardProps) {
  return (
    <div
      className={cn(
        'relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700',
        'cursor-pointer transition-all duration-200 ease-out',
        // GPU 가속을 위한 will-change와 transform 사용
        'will-change-[transform,opacity]',
        enableHover && [
          // 호버 시 단순한 transform과 opacity만 사용 (box-shadow 대신)
          'hover:scale-[1.02]',
          'hover:border-gray-300 dark:hover:border-gray-600',
          // 포커스 상태 (접근성)
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500'
        ],
        className
      )}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* 호버 효과를 위한 오버레이 (box-shadow 대체) */}
      {enableHover && (
        <div
          className="absolute inset-0 rounded-lg bg-gradient-to-t from-gray-100/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {children}
    </div>
  );
});

OptimizedCard.displayName = 'OptimizedCard';

export default OptimizedCard;