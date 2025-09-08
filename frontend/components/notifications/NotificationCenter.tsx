'use client'

import { useState, useEffect } from 'react'
import { Bell, X, Check, Eye, MessageSquare, Upload, Users, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { socketClient } from '@/lib/socket/client'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface Notification {
  id: string
  type: 'comment' | 'upload' | 'mention' | 'participant' | 'annotation' | 'scene'
  title: string
  message: string
  projectId?: string
  projectName?: string
  sceneId?: string
  imageId?: string
  read: boolean
  createdAt: Date
  actor?: {
    id: string
    username: string
    nickname?: string
    profileImageUrl?: string
  }
}

interface NotificationCenterProps {
  userId?: string
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Load notifications from localStorage (temporary solution)
    const stored = localStorage.getItem('notifications')
    if (stored) {
      const parsed = JSON.parse(stored) as Notification[]
      setNotifications(parsed.map(n => ({ ...n, createdAt: new Date(n.createdAt) })))
      setUnreadCount(parsed.filter(n => !n.read).length)
    }

    // Listen for real-time notifications
    socketClient.on('notification:new', handleNewNotification)

    return () => {
      socketClient.off('notification:new', handleNewNotification)
    }
  }, [])

  const handleNewNotification = (data: any) => {
    const notification: Notification = {
      id: Date.now().toString(),
      type: data.type,
      title: data.title,
      message: data.message,
      projectId: data.projectId,
      projectName: data.projectName,
      sceneId: data.sceneId,
      imageId: data.imageId,
      read: false,
      createdAt: new Date(),
      actor: data.actor
    }

    setNotifications(prev => {
      const updated = [notification, ...prev]
      // Save to localStorage
      localStorage.setItem('notifications', JSON.stringify(updated))
      return updated
    })
    setUnreadCount(prev => prev + 1)

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon.png'
      })
    }
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      )
      localStorage.setItem('notifications', JSON.stringify(updated))
      return updated
    })
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      localStorage.setItem('notifications', JSON.stringify(updated))
      return updated
    })
    setUnreadCount(0)
  }

  const clearAll = () => {
    setNotifications([])
    localStorage.removeItem('notifications')
    setUnreadCount(0)
  }

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id)
    
    // Navigate to relevant page
    if (notification.projectId) {
      if (notification.sceneId) {
        router.push(`/studio/projects/${notification.projectId}/scenes/${notification.sceneId}`)
      } else {
        router.push(`/studio/projects/${notification.projectId}`)
      }
    }
    
    setIsOpen(false)
  }

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="h-4 w-4" />
      case 'upload':
        return <Upload className="h-4 w-4" />
      case 'mention':
        return <span className="text-sm font-bold">@</span>
      case 'participant':
        return <Users className="h-4 w-4" />
      case 'annotation':
        return <Edit className="h-4 w-4" />
      case 'scene':
        return <Eye className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">알림</CardTitle>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    markAllAsRead()
                  }}
                >
                  <Check className="h-4 w-4 mr-1" />
                  모두 읽음
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    clearAll()
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>새로운 알림이 없습니다</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-3 cursor-pointer",
                    !notification.read && "bg-muted/50"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={cn(
                    "mt-1 p-2 rounded-full",
                    !notification.read ? "bg-primary/10" : "bg-muted"
                  )}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-none">
                          {notification.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        {notification.projectName && (
                          <Badge variant="outline" className="mt-1">
                            {notification.projectName}
                          </Badge>
                        )}
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-primary rounded-full mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(notification.createdAt, { 
                        addSuffix: true,
                        locale: ko 
                      })}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}