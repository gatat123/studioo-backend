/**
 * 디버그 및 로깅 유틸리티
 */

// 환경별 로깅 제어
const isDebugMode = process.env.NODE_ENV === 'development' ||
                   process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';

/**
 * 안전한 콘솔 로깅 (프로덕션에서는 중요한 에러만 표시)
 */
export const logger = {
  debug: (...args: any[]) => {
    if (isDebugMode) {
      console.log('[DEBUG]', ...args);
    }
  },

  info: (...args: any[]) => {
    if (isDebugMode) {
      console.info('[INFO]', ...args);
    }
  },

  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * 날짜 파싱 문제 전용 로거
   */
  dateError: (input: any, error: any, context?: string) => {
    const errorInfo = {
      input,
      inputType: typeof input,
      error: error?.message || error,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
      timezone: typeof window !== 'undefined' ?
        Intl.DateTimeFormat().resolvedOptions().timeZone : 'Server'
    };

    // 프로덕션에서도 날짜 오류는 중요하므로 항상 로깅
    console.error('[DATE_ERROR]', errorInfo);

    // 개발 환경에서는 더 자세한 정보
    if (isDebugMode) {
      console.group('[DATE_ERROR_DETAILS]');
      console.log('Input:', input);
      console.log('Type:', typeof input);
      console.log('String representation:', String(input));
      console.log('Error:', error);
      console.log('Context:', context);
      console.groupEnd();
    }
  },

  /**
   * 이미지 로드 에러 로거
   */
  imageError: (src: any, error: any, context?: string) => {
    const errorInfo = {
      src,
      error: error?.message || error,
      context,
      timestamp: new Date().toISOString()
    };

    if (isDebugMode) {
      console.warn('[IMAGE_ERROR]', errorInfo);
    }
  }
};

/**
 * 성능 측정 유틸리티
 */
export class PerformanceTracker {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = performance.now();

    if (isDebugMode) {
      console.time(label);
    }
  }

  end() {
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    if (isDebugMode) {
      console.timeEnd(this.label);
      console.log(`[PERF] ${this.label}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }
}

/**
 * 타입 안전성 체크 유틸리티
 */
export const typeCheck = {
  isString: (value: any): value is string => typeof value === 'string',
  isNumber: (value: any): value is number => typeof value === 'number' && !isNaN(value),
  isDate: (value: any): value is Date => value instanceof Date,
  isValidDateString: (value: any): boolean => {
    if (!typeCheck.isString(value)) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },
  isNull: (value: any): value is null => value === null,
  isUndefined: (value: any): value is undefined => value === undefined,
  isNullish: (value: any): value is null | undefined => value == null
};

/**
 * API 응답 검증 유틸리티
 */
export const validateApiResponse = {
  /**
   * 날짜 필드가 올바른 형식인지 확인
   */
  checkDateFields: (data: any, fields: string[]) => {
    const issues: string[] = [];

    fields.forEach(field => {
      const value = data?.[field];
      if (value && !typeCheck.isValidDateString(value)) {
        issues.push(`Invalid date format in field: ${field}, value: ${value}`);
      }
    });

    if (issues.length > 0 && isDebugMode) {
      logger.warn('API Response Date Issues:', issues);
    }

    return issues;
  }
};

/**
 * 환경 정보 수집
 */
export const getEnvironmentInfo = () => {
  const info = {
    nodeEnv: process.env.NODE_ENV,
    isClient: typeof window !== 'undefined',
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
    timezone: typeof window !== 'undefined' ?
      Intl.DateTimeFormat().resolvedOptions().timeZone : 'Server',
    locale: typeof window !== 'undefined' ?
      window.navigator.language : 'Server',
    timestamp: new Date().toISOString()
  };

  if (isDebugMode) {
    logger.debug('Environment Info:', info);
  }

  return info;
};