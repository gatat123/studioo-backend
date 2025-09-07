'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import SceneNavigation from '@/components/scenes/SceneNavigation'
import ImageViewer from '@/components/scenes/ImageViewer'
import SceneSidebar from '@/components/scenes/SceneSidebar'
import SceneToolbar from '@/components/scenes/SceneToolbar'
import SceneDescription from '@/components/scenes/SceneDescription'
import { AnnotationTools } from '@/components/editor/AnnotationTools'
import { useProjectStore } from '@/store/projectStore'
import { Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SceneEditorPage() {
  const params = useParams()
  const projectId = params.id as string
  const sceneId = params.sceneId as string
  
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [currentScene, setCurrentScene] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('view')
  const [annotationMode, setAnnotationMode] = useState(false)
  
  const { getProject } = useProjectStore()
  const project = getProject(projectId)

  useEffect(() => {
    // 씬 데이터 로드 시뮬레이션
    const loadSceneData = async () => {
      setIsLoading(true)
      try {
        // TODO: API 호출로 실제 씬 데이터 로드
        await new Promise(resolve => setTimeout(resolve, 1000))
        setCurrentScene({
          id: sceneId,
          name: `Scene ${sceneId}`,
          description: 'Scene description here',
          images: {
            lineart: null,
            art: null
          }
        })
      } catch (error) {
        console.error('Failed to load scene:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSceneData()
  }, [sceneId])

  // 키보드 단축키 핸들러
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + 1: 왼쪽 사이드바 토글
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault()
        setIsLeftSidebarOpen(prev => !prev)
      }
      // Ctrl/Cmd + 2: 오른쪽 사이드바 토글
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault()
        setIsRightSidebarOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Scene Navigation Tabs */}
      <SceneNavigation 
        projectId={projectId} 
        currentSceneId={sceneId}
      />
      
      {/* Main Editor Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Tools (Collapsible) */}
        <SceneToolbar 
          isOpen={isLeftSidebarOpen}
          onToggle={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        />
        
        {/* Central Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b">
              <TabsTrigger value="view">뷰어</TabsTrigger>
              <TabsTrigger value="annotate">주석</TabsTrigger>
            </TabsList>
            
            {/* View Tab */}
            <TabsContent value="view" className="flex-1 flex flex-col mt-0">
              <div className="flex-1 relative bg-muted/30">
                <ImageViewer 
                  sceneId={sceneId}
                  lineartImage={currentScene?.images?.lineart}
                  artImage={currentScene?.images?.art}
                />
              </div>
            </TabsContent>
            
            {/* Annotation Tab */}
            <TabsContent value="annotate" className="flex-1 flex flex-col mt-0 p-4">
              <AnnotationTools
                imageUrl={currentScene?.images?.art || currentScene?.images?.lineart}
                width={800}
                height={600}
                onSave={(shapes) => {
                  console.log('Annotations saved:', shapes)
                  // TODO: Save annotations to backend
                }}
              />
            </TabsContent>
          </Tabs>
          
          {/* Bottom Panel - Scene Description */}
          <SceneDescription 
            sceneId={sceneId}
            initialDescription={currentScene?.description}
          />
        </div>
        
        {/* Right Sidebar - Comments/History */}
        <SceneSidebar 
          isOpen={isRightSidebarOpen}
          onToggle={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          sceneId={sceneId}
        />
      </div>
    </div>
  )
}
