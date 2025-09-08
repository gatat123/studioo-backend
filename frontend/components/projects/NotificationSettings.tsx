'use client'

import { useState } from 'react'
import { Bell, Mail, MessageSquare, Upload, Users, Calendar } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'

interface NotificationSettingsProps {
  projectId: string
}

interface NotificationSetting {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  enabled: boolean
  emailEnabled: boolean
}

export default function NotificationSettings({ projectId }: NotificationSettingsProps) {
  const { toast } = useToast()

  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'new_comment',
      label: 'New Comments',
      description: 'Notify when someone comments on scenes or project',
      icon: <MessageSquare className="h-4 w-4" />,
      enabled: true,
      emailEnabled: false,
    },
    {
      id: 'image_upload',
      label: 'Image Uploads',
      description: 'Notify when new images are uploaded to scenes',
      icon: <Upload className="h-4 w-4" />,
      enabled: true,
      emailEnabled: true,
    },
    {
      id: 'member_join',
      label: 'New Members',
      description: 'Notify when new members join the project',
      icon: <Users className="h-4 w-4" />,
      enabled: true,
      emailEnabled: false,
    },
    {
      id: 'deadline_reminder',
      label: 'Deadline Reminders',
      description: 'Notify about upcoming project deadlines',
      icon: <Calendar className="h-4 w-4" />,
      enabled: true,
      emailEnabled: true,
    },
    {
      id: 'mentions',
      label: 'Mentions',
      description: 'Notify when someone mentions you in comments',
      icon: <Bell className="h-4 w-4" />,
      enabled: true,
      emailEnabled: true,
    },
  ])

  const handleToggleNotification = (settingId: string, field: 'enabled' | 'emailEnabled') => {
    setSettings(prev =>
      prev.map(setting =>
        setting.id === settingId
          ? { ...setting, [field]: !setting[field] }
          : setting
      )
    )
  }

  const handleSaveSettings = () => {
    // Here you would typically save to backend
    console.log('Saving notification settings:', settings)
    
    toast({
      title: 'Settings Saved',
      description: 'Your notification preferences have been updated.',
    })
  }

  const handleResetToDefault = () => {
    setSettings(prev =>
      prev.map(setting => ({
        ...setting,
        enabled: true,
        emailEnabled: false,
      }))
    )
    
    toast({
      title: 'Settings Reset',
      description: 'Notification settings have been reset to defaults.',
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.id} className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="mt-1">{setting.icon}</div>
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="font-medium">{setting.label}</h4>
                  <p className="text-sm text-gray-500">{setting.description}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`${setting.id}-app`}
                      checked={setting.enabled}
                      onCheckedChange={() => handleToggleNotification(setting.id, 'enabled')}
                    />
                    <Label htmlFor={`${setting.id}-app`} className="cursor-pointer">
                      In-app notifications
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`${setting.id}-email`}
                      checked={setting.emailEnabled}
                      onCheckedChange={() => handleToggleNotification(setting.id, 'emailEnabled')}
                      disabled={!setting.enabled}
                    />
                    <Label 
                      htmlFor={`${setting.id}-email`} 
                      className={`cursor-pointer ${!setting.enabled ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        Email notifications
                      </div>
                    </Label>
                  </div>
                </div>
              </div>
            </div>
            <Separator />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={handleResetToDefault}
        >
          Reset to Default
        </Button>
        <Button onClick={handleSaveSettings}>
          Save Preferences
        </Button>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Email Notification Settings</h4>
        <p className="text-sm text-gray-600">
          To receive email notifications, make sure your email address is verified in your profile settings.
          You can manage your global email preferences there.
        </p>
      </div>
    </div>
  )
}
