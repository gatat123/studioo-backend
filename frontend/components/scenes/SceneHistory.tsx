'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Clock, Image, Download, Eye } from 'lucide-react'

interface HistoryItem {
  id: string
  type: 'lineart' | 'art'
  action: 'upload' | 'update' | 'delete'
  fileName: string
  fileUrl?: string
  userId: string
  userName: string
  createdAt: Date
  version: number
}

interface SceneHistoryProps {
  sceneId: string
}

export default function SceneHistory({ sceneId }: SceneHistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)

  useEffect(() => {
    // TODO: API 호출로 히스토리 로드
    const mockHistory: HistoryItem[] = [
      {
        id: '1',
        type: 'lineart',
        action: 'upload',
        fileName: 'scene1_lineart_v2.png',
        fileUrl: '/mock-image.png',
        userId: 'user1',
        userName: '김디자이너',
        createdAt: new Date(Date.now() - 1000 * 60 * 30),
        version: 2
      },
      {
        id: '2',
        type: 'art',
        action: 'upload',
        fileName: 'scene1_art_v1.png',
        fileUrl: '/mock-image.png',
        userId: 'user2',
        userName: '이아티스트',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        version: 1
      },
      {
        id: '3',
        type: 'lineart',
        action: 'upload',
        fileName: 'scene1_lineart_v1.png',
        fileUrl: '/mock-image.png',
        userId: 'user1',
        userName: '김디자이너',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        version: 1
      }
    ]
    setHistory(mockHistory)
  }, [sceneId])

  const handleRestore = async (item: HistoryItem) => {
    // TODO: API 호출로 버전 복원
    console.log('Restoring version:', item)
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'upload': return '업로드'
      case 'update': return '수정'
      case 'delete': return '삭제'
      default: return action
    }
  }

  const getTypeColor = (type: string) => {
    return type === 'lineart' ? 'default' : 'secondary'
  }

  return (
    <div className="p-4 space-y-3">
      {history.map((item) => (
        <div 
          key={item.id} 
          className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              <Badge variant={getTypeColor(item.type)}>
                {item.type === 'lineart' ? '선화' : '아트'} v{item.version}
              </Badge>
              <Badge variant="outline">
                {getActionLabel(item.action)}
              </Badge>
            </div>
          </div>
          
          <div className="text-sm">
            <p className="font-medium truncate">{item.fileName}</p>
            <p className="text-muted-foreground">
              {item.userName} • {formatDistanceToNow(item.createdAt, { 
                addSuffix: true,
                locale: ko 
              })}
            </p>
          </div>

          {item.fileUrl && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">
                <Eye className="h-3 w-3 mr-1" />
                미리보기
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <Download className="h-3 w-3 mr-1" />
                다운로드
              </Button>
              <Button 
                size="sm" 
                variant="default"
                onClick={() => handleRestore(item)}
              >
                <Clock className="h-3 w-3 mr-1" />
                복원
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
