import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { logger } from './debug-helpers';

/**
 * 안전하게 날짜를 파싱하는 함수
 */
export function safeParseDateString(dateString: string | Date | null | undefined): Date | null {
  if (!dateString) return null;

  try {
    // 이미 Date 객체인 경우
    if (dateString instanceof Date) {
      return isValid(dateString) ? dateString : null;
    }

    // 문자열이 아닌 경우 문자열로 변환
    const dateStr = typeof dateString === 'string' ? dateString : String(dateString);

    // 빈 문자열이나 'null', 'undefined' 처리
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') {
      return null;
    }

    // ISO 문자열 파싱 시도 (UTC 시간 처리)
    const date = parseISO(dateStr);
    if (isValid(date)) {
      return date;
    }

    // 타임스탬프 숫자인 경우
    const timestamp = Number(dateStr);
    if (!isNaN(timestamp) && timestamp > 0) {
      const timestampDate = new Date(timestamp);
      if (isValid(timestampDate)) {
        return timestampDate;
      }
    }

    // 일반적인 Date 생성자 시도
    const fallbackDate = new Date(dateStr);
    if (isValid(fallbackDate) && !isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }

    return null;
  } catch (error) {
    logger.dateError(dateString, error, 'safeParseDateString');
    return null;
  }
}

/**
 * 안전한 formatDistanceToNow 함수
 */
export function safeFormatDistanceToNow(
  dateInput: string | Date | null | undefined,
  options?: {
    addSuffix?: boolean;
    locale?: typeof ko;
  }
): string {
  if (!dateInput) {
    return '날짜 없음';
  }

  // 이미 Date 객체인 경우
  let date: Date | null;
  if (dateInput instanceof Date) {
    date = isValid(dateInput) ? dateInput : null;
  } else {
    date = safeParseDateString(dateInput);
  }

  if (!date) {
    return '날짜 없음';
  }

  try {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: ko,
      ...options
    });
  } catch (error) {
    logger.dateError(dateInput, error, 'safeFormatDistanceToNow');
    return '날짜 형식 오류';
  }
}

/**
 * 안전한 format 함수
 */
export function safeFormat(
  dateInput: string | Date | null | undefined,
  formatString: string,
  options?: {
    locale?: typeof ko;
  }
): string {
  if (!dateInput) {
    return '날짜 없음';
  }

  // 이미 Date 객체인 경우
  let date: Date | null;
  if (dateInput instanceof Date) {
    date = isValid(dateInput) ? dateInput : null;
  } else {
    date = safeParseDateString(dateInput);
  }

  if (!date) {
    return '날짜 없음';
  }

  try {
    return format(date, formatString, {
      locale: ko,
      ...options
    });
  } catch (error) {
    logger.dateError(dateInput, error, `safeFormat(${formatString})`);
    return '날짜 형식 오류';
  }
}

/**
 * 안전한 날짜 정렬을 위한 타임스탬프 반환
 */
export function safeGetTime(dateInput: string | Date | null | undefined): number {
  if (!dateInput) return 0;

  // 이미 Date 객체인 경우
  if (dateInput instanceof Date) {
    return isValid(dateInput) && !isNaN(dateInput.getTime()) ? dateInput.getTime() : 0;
  }

  // 문자열인 경우
  const date = safeParseDateString(dateInput);
  return date ? date.getTime() : 0;
}

/**
 * 날짜 문자열 유효성 검사
 */
export function isValidDateString(dateString: string | null | undefined): boolean {
  return safeParseDateString(dateString) !== null;
}

/**
 * 안전한 toLocaleDateString
 */
export function safeToLocaleDateString(
  dateInput: string | Date | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) {
    return '날짜 없음';
  }

  let date: Date | null;
  if (dateInput instanceof Date) {
    date = isValid(dateInput) ? dateInput : null;
  } else {
    date = safeParseDateString(dateInput);
  }

  if (!date) {
    return '날짜 없음';
  }

  try {
    return date.toLocaleDateString(locale || 'ko-KR', options);
  } catch (error) {
    logger.dateError(dateInput, error, 'safeToLocaleDateString');
    return '날짜 형식 오류';
  }
}

/**
 * 안전한 toLocaleString
 */
export function safeToLocaleString(
  dateInput: string | Date | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) {
    return '날짜 없음';
  }

  let date: Date | null;
  if (dateInput instanceof Date) {
    date = isValid(dateInput) ? dateInput : null;
  } else {
    date = safeParseDateString(dateInput);
  }

  if (!date) {
    return '날짜 없음';
  }

  try {
    return date.toLocaleString(locale || 'ko-KR', options);
  } catch (error) {
    logger.dateError(dateInput, error, 'safeToLocaleString');
    return '날짜 형식 오류';
  }
}