'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Scene {
  id: string
  number: number
  name: string
  hasUpdates?: boolean
}

interface SceneNavigationProps {
  projectId: string
  currentSceneId: string
}

export default function SceneNavigation({ projectId, currentSceneId }: SceneNavigationProps) {
  const router = useRouter()
  const [scenes, setScenes] = useState<Scene[]>([])
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    // TODO: API 호출로 실제 씬 목록 로드
    const mockScenes: Scene[] = [
      { id: '1', number: 1, name: 'Scene 1' },
      { id: '2', number: 2, name: 'Scene 2', hasUpdates: true },
      { id: '3', number: 3, name: 'Scene 3' },
      { id: '4', number: 4, name: 'Scene 4' },
      { id: '5', number: 5, name: 'Scene 5' },
    ]
    setScenes(mockScenes)
  }, [projectId])

  const handleSceneClick = (sceneId: string) => {
    router.push(`/studio/projects/${projectId}/scenes/${sceneId}`)
  }

  const handleAddScene = async () => {
    // TODO: API 호출로 새 씬 생성
    const newSceneId = (scenes.length + 1).toString()
    router.push(`/studio/projects/${projectId}/scenes/${newSceneId}`)
  }

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center px-4 py-2">
        {/* Scroll Left Button */}
        {canScrollLeft && (
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={() => {/* Scroll logic */}}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Scene Tabs */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <TooltipProvider>
            {scenes.map((scene) => (
              <Tooltip key={scene.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentSceneId === scene.id ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'min-w-[100px] relative',
                      currentSceneId === scene.id && 'shadow-sm'
                    )}
                    onClick={() => handleSceneClick(scene.id)}
                  >
                    <span className="truncate">{scene.name}</span>
                    {scene.hasUpdates && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{scene.name}</p>
                  {scene.hasUpdates && <p className="text-xs text-muted-foreground">Has updates</p>}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>

          {/* Add Scene Button */}
          <Button
            variant="outline"
            size="sm"
            className="min-w-[40px]"
            onClick={handleAddScene}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Scroll Right Button */}
        {canScrollRight && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-2"
            onClick={() => {/* Scroll logic */}}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
