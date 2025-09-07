'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Mail, User, Shield } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface ProfileInfoProps {
  user: {
    id: string
    username: string
    displayName: string
    email: string
    avatar: string | null
    role: string
    permissions: string[]
    createdAt: Date
  }
}

export function ProfileInfo({ user }: ProfileInfoProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>프로필 정보</CardTitle>
        <CardDescription>
          계정의 기본 정보를 확인하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.avatar || undefined} alt={user.displayName} />
            <AvatarFallback className="text-lg">
              {getInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h3 className="text-2xl font-semibold">{user.displayName}</h3>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">사용자명</p>
              <p className="text-sm text-muted-foreground">{user.username}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">이메일</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">역할</p>
              <Badge variant="outline" className="mt-1">
                {user.role === 'admin' ? '관리자' : '사용자'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">가입일</p>
              <p className="text-sm text-muted-foreground">
                {format(user.createdAt, 'yyyy년 MM월 dd일', { locale: ko })}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">권한</p>
          <div className="flex flex-wrap gap-2">
            {user.permissions.map((permission) => (
              <Badge key={permission} variant="secondary">
                {permission === 'read' && '읽기'}
                {permission === 'write' && '쓰기'}
                {permission === 'delete' && '삭제'}
                {permission === 'admin' && '관리'}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
