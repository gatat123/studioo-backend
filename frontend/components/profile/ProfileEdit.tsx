'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Upload, X } from 'lucide-react'
import { toast } from 'sonner'

const profileSchema = z.object({
  username: z.string().min(3, '사용자명은 최소 3자 이상이어야 합니다'),
  displayName: z.string().min(2, '표시 이름은 최소 2자 이상이어야 합니다'),
  email: z.string().email('올바른 이메일 주소를 입력하세요'),
  bio: z.string().max(500, '자기소개는 500자 이내로 작성하세요').optional()
})

type ProfileFormValues = z.infer<typeof profileSchema>

interface ProfileEditProps {
  user: any
  onUpdate: (user: any) => void
}

export function ProfileEdit({ user, onUpdate }: ProfileEditProps) {
  const [loading, setLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      bio: user.bio || ''
    }
  })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('파일 크기는 5MB 이하여야 합니다')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeAvatar = () => {
    setAvatarPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const onSubmit = async (data: ProfileFormValues) => {
    setLoading(true)
    try {
      // TODO: 실제 API 호출로 교체
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const updatedUser = {
        ...user,
        ...data,
        avatar: avatarPreview
      }
      
      onUpdate(updatedUser)
      toast.success('프로필이 성공적으로 업데이트되었습니다')
    } catch (error) {
      toast.error('프로필 업데이트에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

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
        <CardTitle>프로필 수정</CardTitle>
        <CardDescription>
          프로필 정보를 수정하고 업데이트하세요
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview || undefined} alt={user.displayName} />
                <AvatarFallback className="text-xl">
                  {getInitials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  사진 업로드
                </Button>
                {avatarPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeAvatar}
                  >
                    <X className="h-4 w-4 mr-2" />
                    제거
                  </Button>
                )}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>사용자명</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      다른 사용자에게 표시되는 고유 ID입니다
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>표시 이름</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      프로필에 표시될 이름입니다
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormDescription>
                    알림을 받을 이메일 주소입니다
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>자기소개</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field}
                      rows={4}
                      placeholder="간단한 자기소개를 작성해주세요..."
                    />
                  </FormControl>
                  <FormDescription>
                    최대 500자까지 작성할 수 있습니다
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? '저장 중...' : '변경사항 저장'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
