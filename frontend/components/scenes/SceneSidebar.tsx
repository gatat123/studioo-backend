'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  X, 
  MessageSquare, 
  History, 
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CommentSection } from '@/components/comments'
import SceneHistory from './SceneHistory'
import { useParams } from 'next/navigation'

interface SceneSidebarProps {
  isOpen: boolean
  onToggle: () => void
  sceneId: string
}

export default function SceneSidebar({ isOpen, onToggle, sceneId }: SceneSidebarProps) {
  const [activeTab, setActiveTab] = useState('comments')
  const params = useParams()
  const projectId = params.id as string

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute right-0 top-1/2 -translate-y-1/2 z-10",
          isOpen ? "right-80" : "right-0"
        )}
        onClick={onToggle}
      >
        {isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "w-80 border-l bg-background transition-all duration-300",
          isOpen ? "translate-x-0" : "translate-x-full hidden"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">씬 정보</h3>
            <Button variant="ghost" size="icon" onClick={onToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="comments">
                <MessageSquare className="h-4 w-4 mr-2" />
                댓글
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                히스토리
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="flex-1 mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <CommentSection 
                    projectId={projectId}
                    sceneId={sceneId}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="flex-1 mt-0">
              <ScrollArea className="h-full">
                <SceneHistory sceneId={sceneId} />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}
