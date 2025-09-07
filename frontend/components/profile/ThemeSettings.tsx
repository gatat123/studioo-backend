'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Sun, Moon, Monitor } from 'lucide-react'

interface ThemeSettingsProps {
  currentTheme: string
  onUpdate: (theme: string) => void
}

export function ThemeSettings({ currentTheme, onUpdate }: ThemeSettingsProps) {
  const [selectedTheme, setSelectedTheme] = useState(currentTheme)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      // TODO: 실제 API 호출로 교체
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 실제로 테마 적용
      if (selectedTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      
      onUpdate(selectedTheme)
      toast.success('테마 설정이 저장되었습니다')
    } catch (error) {
      toast.error('테마 설정 저장에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = currentTheme !== selectedTheme

  return (
    <Card>
      <CardHeader>
        <CardTitle>테마 설정</CardTitle>
        <CardDescription>
          선호하는 테마를 선택하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup 
          value={selectedTheme} 
          onValueChange={setSelectedTheme}
          className="space-y-4"
        >
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="light" id="light" className="mt-1" />
            <Label htmlFor="light" className="cursor-pointer">
              <div className="flex items-center space-x-3">
                <Sun className="h-5 w-5" />
                <div>
                  <p className="font-medium">라이트 모드</p>
                  <p className="text-sm text-muted-foreground">
                    밝은 배경의 기본 테마
                  </p>
                </div>
              </div>
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <RadioGroupItem value="dark" id="dark" className="mt-1" />
            <Label htmlFor="dark" className="cursor-pointer">
              <div className="flex items-center space-x-3">
                <Moon className="h-5 w-5" />
                <div>
                  <p className="font-medium">다크 모드</p>
                  <p className="text-sm text-muted-foreground">
                    어두운 배경으로 눈의 피로를 줄입니다
                  </p>
                </div>
              </div>
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <RadioGroupItem value="system" id="system" className="mt-1" />
            <Label htmlFor="system" className="cursor-pointer">
              <div className="flex items-center space-x-3">
                <Monitor className="h-5 w-5" />
                <div>
                  <p className="font-medium">시스템 설정</p>
                  <p className="text-sm text-muted-foreground">
                    시스템 설정에 따라 자동으로 변경됩니다
                  </p>
                </div>
              </div>
            </Label>
          </div>
        </RadioGroup>

        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">미리보기</p>
          <div className={`rounded p-4 transition-colors ${
            selectedTheme === 'dark' 
              ? 'bg-gray-900 text-white' 
              : selectedTheme === 'light'
              ? 'bg-white text-gray-900 border'
              : 'bg-gradient-to-r from-white to-gray-900 text-gray-600'
          }`}>
            <p className="font-semibold mb-2">샘플 텍스트</p>
            <p className="text-sm">
              선택한 테마가 이렇게 표시됩니다.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={loading || !hasChanges}
          >
            {loading ? '저장 중...' : '테마 적용'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
