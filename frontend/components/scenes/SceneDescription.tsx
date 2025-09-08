'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { 
  ChevronUp, 
  ChevronDown, 
  Save,
  Edit2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

interface SceneDescriptionProps {
  sceneId: string
  initialDescription?: string
}

export default function SceneDescription({ sceneId, initialDescription = '' }: SceneDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [description, setDescription] = useState(initialDescription)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const debouncedDescription = useDebounce(description, 1000)

  // 자동 저장
  useEffect(() => {
    if (debouncedDescription !== initialDescription && debouncedDescription !== '') {
      handleSave()
    }
  }, [debouncedDescription])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // TODO: API 호출로 설명 저장
      await new Promise(resolve => setTimeout(resolve, 500))
      console.log('Saved description:', description)
    } catch (error) {
      console.error('Failed to save description:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }

  return (
    <Card className={cn(
      "border-t rounded-none transition-all duration-300",
      isExpanded ? "h-64" : "h-12"
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">씬 설명</h4>
            {isSaving && (
              <span className="text-xs text-muted-foreground">저장 중...</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="flex-1 p-4">
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="씬에 대한 설명을 입력하세요..."
                className="h-full resize-none"
              />
            ) : (
              <div className="h-full overflow-auto">
                <p className="text-sm whitespace-pre-wrap">
                  {description || '씬 설명이 없습니다.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
