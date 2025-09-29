'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getSafeImageUrl, handleImageError, IMAGE_FALLBACKS } from '@/lib/utils/image-helpers';
import { cn } from '@/lib/utils';

interface SafeAvatarProps extends React.ComponentProps<typeof Avatar> {
  src?: string | null | undefined;
  alt?: string;
  fallbackText?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showFallback?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

/**
 * 안전한 아바타 컴포넌트
 * - 이미지 로드 실패 시 자동으로 fallback 처리
 * - null/undefined src 안전 처리
 * - 다양한 크기 지원
 */
export function SafeAvatar({
  src,
  alt = '',
  fallbackText,
  size = 'md',
  showFallback = true,
  className,
  ...props
}: SafeAvatarProps) {
  const safeSrc = getSafeImageUrl(src, IMAGE_FALLBACKS.avatar);
  const displayText = fallbackText || alt.charAt(0).toUpperCase() || '?';

  return (
    <Avatar className={cn(sizeClasses[size], className)} {...props}>
      <AvatarImage
        src={safeSrc}
        alt={alt}
        onError={(e) => handleImageError(e, IMAGE_FALLBACKS.avatar)}
      />
      {showFallback && (
        <AvatarFallback className={cn(
          "bg-muted font-medium flex items-center justify-center",
          sizeClasses[size]
        )}>
          {displayText}
        </AvatarFallback>
      )}
    </Avatar>
  );
}

/**
 * 사용자 아바타 (이름에서 이니셜 추출)
 */
interface SafeUserAvatarProps extends Omit<SafeAvatarProps, 'fallbackText'> {
  username?: string;
  displayName?: string;
}

export function SafeUserAvatar({
  username,
  displayName,
  alt,
  ...props
}: SafeUserAvatarProps) {
  const name = displayName || username || '';
  const initials = name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAvatar
      {...props}
      alt={alt || name}
      fallbackText={initials || name.charAt(0) || '?'}
    />
  );
}

export default SafeAvatar;