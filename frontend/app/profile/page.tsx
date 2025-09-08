'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileInfo } from '@/components/profile/ProfileInfo'
import { ProfileEdit } from '@/components/profile/ProfileEdit'
import { PasswordChange } from '@/components/profile/PasswordChange'
import { NotificationSettings } from '@/components/profile/NotificationSettings'
import { ActivityHistory } from '@/components/profile/ActivityHistory'
import { ThemeSettings } from '@/components/profile/ThemeSettings'
import { Card } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useStores'

export default function ProfilePage() {
  const router = useRouter()
  const { user: authUser, isLoading: authLoading, requireAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    requireAuth('/auth/login')
  }, [requireAuth])

  const user = authUser ? {
    id: authUser.id,
    username: authUser.username,
    displayName: authUser.nickname || authUser.username,
    email: authUser.email,
    avatar: authUser.profileImageUrl || authUser.profileImage,
    role: authUser.isAdmin ? 'admin' : 'user',
    permissions: ['read', 'write'],
    createdAt: new Date(authUser.createdAt),
    theme: 'light',
    notifications: {
      email: true,
      push: false,
      projectUpdates: true,
      comments: true,
      mentions: true
    }
  } : null

  const handleUserUpdate = (updatedUser: any) => {
    // TODO: Update user through API
    toast.success('프로필이 업데이트되었습니다')
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <p className="text-muted-foreground">사용자 정보를 불러올 수 없습니다.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">프로필 설정</h1>
        <p className="text-muted-foreground mt-2">
          계정 정보와 설정을 관리하세요
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile">프로필</TabsTrigger>
          <TabsTrigger value="edit">정보 수정</TabsTrigger>
          <TabsTrigger value="password">비밀번호</TabsTrigger>
          <TabsTrigger value="notifications">알림</TabsTrigger>
          <TabsTrigger value="activity">활동 기록</TabsTrigger>
          <TabsTrigger value="theme">테마</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <ProfileInfo user={user} />
        </TabsContent>

        <TabsContent value="edit" className="space-y-4">
          <ProfileEdit user={user} onUpdate={handleUserUpdate} />
        </TabsContent>

        <TabsContent value="password" className="space-y-4">
          <PasswordChange userId={user.id} />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettings 
            settings={user.notifications} 
            onUpdate={(settings) => handleUserUpdate({...user, notifications: settings})}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <ActivityHistory userId={user.id} />
        </TabsContent>

        <TabsContent value="theme" className="space-y-4">
          <ThemeSettings 
            currentTheme={user.theme} 
            onUpdate={(theme) => handleUserUpdate({...user, theme})}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
