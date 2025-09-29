'use client';

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';
import { getSafeImageUrl, IMAGE_FALLBACKS } from '@/lib/utils/image-helpers';

interface SafeImageProps extends Omit<ImageProps, 'src' | 'onError'> {
  src: string | null | undefined;
  fallback?: string;
  showPlaceholder?: boolean;
  placeholderClassName?: string;
}

/**
 * 안전한 이미지 컴포넌트
 * - null/undefined src 처리
 * - 이미지 로드 실패 시 fallback 처리
 * - 플레이스홀더 지원
 */
export function SafeImage({
  src,
  alt = '',
  fallback = IMAGE_FALLBACKS.placeholder,
  showPlaceholder = true,
  placeholderClassName,
  className,
  ...props
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const imageSrc = getSafeImageUrl(hasError ? fallback : src, fallback);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* 로딩 플레이스홀더 */}
      {isLoading && showPlaceholder && (
        <div
          className={cn(
            "absolute inset-0 bg-muted animate-pulse rounded",
            placeholderClassName
          )}
        />
      )}

      <Image
        src={imageSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-200",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        {...props}
      />
    </div>
  );
}

/**
 * 아바타용 안전한 이미지 컴포넌트
 */
interface SafeAvatarImageProps extends SafeImageProps {
  size?: number;
}

export function SafeAvatarImage({
  size = 40,
  className,
  ...props
}: SafeAvatarImageProps) {
  return (
    <SafeImage
      {...props}
      width={size}
      height={size}
      fallback={IMAGE_FALLBACKS.avatar}
      className={cn("rounded-full object-cover", className)}
    />
  );
}

/**
 * 프로젝트 썸네일용 안전한 이미지 컴포넌트
 */
export function SafeProjectImage({
  className,
  ...props
}: SafeImageProps) {
  return (
    <SafeImage
      {...props}
      fallback={IMAGE_FALLBACKS.project}
      className={cn("rounded-lg object-cover", className)}
    />
  );
}

/**
 * 씬 이미지용 안전한 이미지 컴포넌트
 */
export function SafeSceneImage({
  className,
  ...props
}: SafeImageProps) {
  return (
    <SafeImage
      {...props}
      fallback={IMAGE_FALLBACKS.scene}
      className={cn("rounded object-cover", className)}
    />
  );
}