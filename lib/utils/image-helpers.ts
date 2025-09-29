import { useState, useEffect } from 'react';
import { logger } from './debug-helpers';

/**
 * 이미지 URL이 유효한지 검사하는 함수
 */
export function isValidImageUrl(url: string | null | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }

    const img = new Image();

    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);

    // 타임아웃 설정 (5초)
    setTimeout(() => resolve(false), 5000);

    img.src = url;
  });
}

/**
 * 안전한 이미지 URL을 반환하는 함수
 */
export function getSafeImageUrl(
  url: string | null | undefined,
  fallback: string = '/images/placeholder.png'
): string {
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  // 상대 경로를 절대 경로로 변환
  if (url.startsWith('/')) {
    return url;
  }

  // HTTP/HTTPS URL인지 확인
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.href;
  } catch (error) {
    logger.imageError(url, error, 'getSafeImageUrl - URL parsing failed');
    return fallback;
  }
}

/**
 * 이미지 로드 상태를 관리하는 Hook
 */
export function useImageLoad(src: string | null | undefined, fallback?: string) {
  const [imageSrc, setImageSrc] = useState<string>(getSafeImageUrl(src, fallback));
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setImageSrc(getSafeImageUrl(null, fallback));
      setIsLoading(false);
      setHasError(true);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    isValidImageUrl(src).then((isValid) => {
      if (isValid) {
        setImageSrc(getSafeImageUrl(src, fallback));
        setHasError(false);
      } else {
        setImageSrc(getSafeImageUrl(null, fallback));
        setHasError(true);
      }
      setIsLoading(false);
    });
  }, [src, fallback]);

  return { imageSrc, isLoading, hasError };
}

/**
 * 공통 이미지 fallback URL들
 */
export const IMAGE_FALLBACKS = {
  avatar: '/images/default-avatar.svg',
  project: '/images/default-project.svg',
  scene: '/images/default-scene.svg',
  placeholder: '/images/placeholder.svg',
} as const;

/**
 * 이미지 에러 핸들러
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackUrl?: string
) {
  const img = event.currentTarget;
  if (fallbackUrl && img.src !== fallbackUrl) {
    img.src = fallbackUrl;
  }
}

/**
 * Base64 데이터 URL인지 확인하는 함수
 */
export function isDataUrl(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Blob URL인지 확인하는 함수
 */
export function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:');
}

/**
 * 이미지 타입이 지원되는지 확인하는 함수
 */
export function isSupportedImageType(type: string): boolean {
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  return supportedTypes.includes(type.toLowerCase());
}

/**
 * 파일 크기를 인간이 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 이미지 치수를 가져오는 함수
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}