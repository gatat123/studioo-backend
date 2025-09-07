// Mock data for version history
import { Version } from '@/components/editor/VersionHistory'

export const generateMockVersions = (count: number = 10): Version[] => {
  const authors = [
    { id: '1', name: '김철수', avatar: '/avatars/user1.jpg' },
    { id: '2', name: '이영희', avatar: '/avatars/user2.jpg' },
    { id: '3', name: '박민수', avatar: '/avatars/user3.jpg' },
    { id: '4', name: '정지원', avatar: '/avatars/user4.jpg' },
  ]

  const changes = [
    '배경 색상 조정',
    '캐릭터 표정 수정',
    '라인 굵기 변경',
    '그림자 효과 추가',
    '색상 보정 적용',
    '디테일 추가',
    '구도 수정',
    '최종 확인',
  ]

  const versions: Version[] = []
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const isLineart = i % 3 === 0
    const timestamp = new Date(now.getTime() - i * 3600000 * 4) // 4 hours apart
    
    versions.push({
      id: `version-${i + 1}`,
      versionNumber: count - i,
      name: i === 0 ? '최종 버전' : i === 1 ? '검토 버전' : undefined,
      thumbnailUrl: `/api/placeholder/150/150?text=v${count - i}`,
      fullImageUrl: `/api/placeholder/1920/1080?text=Version${count - i}`,
      timestamp,
      author: authors[i % authors.length],
      type: isLineart ? 'lineart' : 'art',
      fileSize: Math.floor(Math.random() * 5000000) + 500000, // 0.5MB ~ 5.5MB
      dimensions: {
        width: 1920,
        height: 1080,
      },
      changes: changes[i % changes.length],
      isCurrent: i === 0,
    })
  }

  return versions
}

// Helper function to get version by ID
export const getVersionById = (versions: Version[], id: string): Version | undefined => {
  return versions.find(v => v.id === id)
}

// Helper function to get versions by type
export const getVersionsByType = (versions: Version[], type: 'lineart' | 'art'): Version[] => {
  return versions.filter(v => v.type === type)
}

// Helper function to get versions by author
export const getVersionsByAuthor = (versions: Version[], authorId: string): Version[] => {
  return versions.filter(v => v.author.id === authorId)
}

// Helper function to get versions within date range
export const getVersionsByDateRange = (
  versions: Version[],
  startDate: Date,
  endDate: Date
): Version[] => {
  return versions.filter(v => {
    const timestamp = v.timestamp.getTime()
    return timestamp >= startDate.getTime() && timestamp <= endDate.getTime()
  })
}
