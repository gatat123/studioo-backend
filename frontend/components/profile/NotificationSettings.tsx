'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Bell, Mail, MessageSquare, AtSign, FileEdit } from 'lucide-react'

interface NotificationSettingsProps {
  settings: {
    email: boolean
    push: boolean
    projectUpdates: boolean
    comments: boolean
    mentions: boolean
  }
  onUpdate: (settings: any) => void
}

export function NotificationSettings({ settings, onUpdate }: NotificationSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings)
  const [loading, setLoading] = useState(false)

  const handleToggle = (key: keyof typeof settings) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // TODO: 실제 API 호출로 교체
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      onUpdate(localSettings)
      toast.success('알림 설정이 저장되었습니다')
    } catch (error) {
      toast.error('설정 저장에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(localSettings)

  return (
    <Card>
      <CardHeader>
        <CardTitle>알림 설정</CardTitle>
        <CardDescription>
          어떤 알림을 받을지 선택하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="email">이메일 알림</Label>
                <p className="text-sm text-muted-foreground">
                  중요한 업데이트를 이메일로 받습니다
                </p>
              </div>
            </div>
            <Switch
              id="email"
              checked={localSettings.email}
              onCheckedChange={() => handleToggle('email')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="push">푸시 알림</Label>
                <p className="text-sm text-muted-foreground">
                  브라우저 푸시 알림을 받습니다
                </p>
              </div>
            </div>
            <Switch
              id="push"
              checked={localSettings.push}
              onCheckedChange={() => handleToggle('push')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileEdit className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="projectUpdates">프로젝트 업데이트</Label>
                <p className="text-sm text-muted-foreground">
                  참여중인 프로젝트의 변경사항을 알립니다
                </p>
              </div>
            </div>
            <Switch
              id="projectUpdates"
              checked={localSettings.projectUpdates}
              onCheckedChange={() => handleToggle('projectUpdates')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="comments">댓글 알림</Label>
                <p className="text-sm text-muted-foreground">
                  새로운 댓글이 달리면 알립니다
                </p>
              </div>
            </div>
            <Switch
              id="comments"
              checked={localSettings.comments}
              onCheckedChange={() => handleToggle('comments')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AtSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="mentions">멘션 알림</Label>
                <p className="text-sm text-muted-foreground">
                  누군가 나를 멘션하면 알립니다
                </p>
              </div>
            </div>
            <Switch
              id="mentions"
              checked={localSettings.mentions}
              onCheckedChange={() => handleToggle('mentions')}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={loading || !hasChanges}
          >
            {loading ? '저장 중...' : '설정 저장'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
