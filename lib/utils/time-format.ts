/**
 * 시간 경과를 한국어로 표시하는 유틸리티 함수들
 */

/**
 * 초 단위 시간을 한국어 경과 시간으로 변환
 * @param seconds 경과된 시간 (초)
 * @returns 한국어 경과 시간 문자열
 */
export function formatTimeAgo(seconds: number): string {
  if (seconds < 60) {
    return '방금 전'
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}분 전`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}시간 전`
  }

  const days = Math.floor(hours / 24)
  if (days < 30) {
    return `${days}일 전`
  }

  const months = Math.floor(days / 30)
  if (months < 12) {
    return `${months}개월 전`
  }

  const years = Math.floor(months / 12)
  return `${years}년 전`
}

/**
 * Date 객체로부터 경과 시간을 계산하여 한국어로 표시
 * @param date Date 객체 또는 ISO 문자열
 * @returns 한국어 경과 시간 문자열
 */
export function formatDistanceToNow(date: Date | string): string {
  const targetDate = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000)

  return formatTimeAgo(diffInSeconds)
}

/**
 * 날짜를 한국어 형식으로 포맷
 * @param date Date 객체 또는 ISO 문자열
 * @param includeTime 시간 포함 여부
 * @returns 한국어 날짜 문자열
 */
export function formatKoreanDate(date: Date | string, includeTime: boolean = false): string {
  const targetDate = typeof date === 'string' ? new Date(date) : date

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  return targetDate.toLocaleDateString('ko-KR', options)
}

/**
 * 마지막 수정일을 계산하는 함수
 * @param createdAt 생성일
 * @param updatedAt 수정일
 * @param commentDates 댓글 날짜들
 * @returns 가장 최근 날짜
 */
export function calculateLastModified(
  createdAt: string,
  updatedAt: string,
  commentDates: string[] = []
): Date {
  const dates = [
    new Date(createdAt),
    new Date(updatedAt),
    ...commentDates.map(date => new Date(date))
  ]

  return dates.reduce((latest, current) => {
    return current > latest ? current : latest
  })
}