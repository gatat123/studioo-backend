'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  FileEdit, 
  MessageSquare, 
  Upload, 
  UserPlus, 
  Settings,
  Image,
  FolderPlus
} from 'lucide-react'

interface Activity {
  id: string
  type: 'project_created' | 'project_joined' | 'comment' | 'upload' | 'settings_changed' | 'scene_created'
  title: string
  description: string
  timestamp: Date
  metadata?: any
}

interface ActivityHistoryProps {
  userId: string
}

export function ActivityHistory({ userId }: ActivityHistoryProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: 실제 API 호출로 교체
    const mockActivities: Activity[] = [
      {
        id: '1',
        type: 'project_created',
        title: '새 프로젝트 생성',
        description: '일러스트 프로젝트 "캐릭터 디자인"을 생성했습니다',
        timestamp: new Date('2024-12-20T10:00:00'),
        metadata: { projectName: '캐릭터 디자인' }
      },
      {
        id: '2',
        type: 'upload',
        title: '이미지 업로드',
        description: 'Scene 1에 새로운 아트워크를 업로드했습니다',
        timestamp: new Date('2024-12-19T15:30:00'),
        metadata: { sceneName: 'Scene 1', fileType: 'art' }
      },
      {
        id: '3',
        type: 'comment',
        title: '댓글 작성',
        description: '프로젝트 "스토리보드 작업"에 댓글을 남겼습니다',
        timestamp: new Date('2024-12-19T14:00:00'),
        metadata: { projectName: '스토리보드 작업' }
      },
      {
        id: '4',
        type: 'project_joined',
        title: '프로젝트 참여',
        description: '초대 코드로 "협업 프로젝트"에 참여했습니다',
        timestamp: new Date('2024-12-18T09:00:00'),
        metadata: { projectName: '협업 프로젝트' }
      },
      {
        id: '5',
        type: 'settings_changed',
        title: '설정 변경',
        description: '프로필 정보를 업데이트했습니다',
        timestamp: new Date('2024-12-17T16:45:00')
      },
      {
        id: '6',
        type: 'scene_created',
        title: '씬 추가',
        description: '"캐릭터 디자인" 프로젝트에 새 씬을 추가했습니다',
        timestamp: new Date('2024-12-17T11:20:00'),
        metadata: { projectName: '캐릭터 디자인', sceneNumber: 3 }
      }
    ]

    setTimeout(() => {
      setActivities(mockActivities)
      setLoading(false)
    }, 500)
  }, [userId])

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'project_created':
        return <FolderPlus className="h-4 w-4" />
      case 'project_joined':
        return <UserPlus className="h-4 w-4" />
      case 'comment':
        return <MessageSquare className="h-4 w-4" />
      case 'upload':
        return <Upload className="h-4 w-4" />
      case 'settings_changed':
        return <Settings className="h-4 w-4" />
      case 'scene_created':
        return <Image className="h-4 w-4" />
      default:
        return <FileEdit className="h-4 w-4" />
    }
  }

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'project_created':
        return 'bg-blue-500'
      case 'project_joined':
        return 'bg-green-500'
      case 'comment':
        return 'bg-yellow-500'
      case 'upload':
        return 'bg-purple-500'
      case 'settings_changed':
        return 'bg-gray-500'
      case 'scene_created':
        return 'bg-pink-500'
      default:
        return 'bg-gray-400'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>활동 기록</CardTitle>
          <CardDescription>최근 활동 내역을 확인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>활동 기록</CardTitle>
        <CardDescription>최근 활동 내역을 확인하세요</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex space-x-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <Badge variant="outline" className="text-xs">
                      {format(activity.timestamp, 'MM월 dd일', { locale: ko })}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(activity.timestamp, 'HH:mm', { locale: ko })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
