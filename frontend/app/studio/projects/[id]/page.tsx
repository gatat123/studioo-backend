'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  Settings, 
  FileText,
  Image as ImageIcon,
  Plus,
  Copy,
  Share2,
  Trash2,
  Edit,
  Check,
  X,
  Upload,
  Eye,
  EyeOff,
  History,
  MessageSquare,
  Pencil,
  Layers,
  GitCompare,
  ZoomIn,
  Bell,
  Send,
  MoreVertical,
  Download
} from 'lucide-react'
import Link from 'next/link'
import { projectsAPI, ProjectWithParticipants } from '@/lib/api/projects'
import { scenesAPI } from '@/lib/api/scenes'
import { commentsAPI } from '@/lib/api/comments'
import { useToast } from '@/hooks/use-toast'
import { Scene, Comment } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// Image type definition
interface ProjectImage {
  id: string
  sceneId: string
  projectId: string
  kind: 'line' | 'art'
  version: number
  url: string
  thumbnailUrl?: string
  createdAt: string
  uploadedBy: {
    id: string
    username: string
    nickname?: string
  }
}

// Scene with images
interface SceneWithImages extends Scene {
  images: ProjectImage[]
  lineArtImages?: ProjectImage[]
  artImages?: ProjectImage[]
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const projectId = params.id as string
  const [project, setProject] = useState<ProjectWithParticipants | null>(null)
  const [scenes, setScenes] = useState<SceneWithImages[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showInviteCode, setShowInviteCode] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  
  // New states for enhanced features
  const [selectedScene, setSelectedScene] = useState<SceneWithImages | null>(null)
  const [imageViewMode, setImageViewMode] = useState<'line' | 'art' | 'both'>('both')
  const [showHistory, setShowHistory] = useState(false)
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [compareMode, setCompareMode] = useState(false)
  const [compareImages, setCompareImages] = useState<[ProjectImage | null, ProjectImage | null]>([null, null])
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [newSceneName, setNewSceneName] = useState('')
  const [newSceneDescription, setNewSceneDescription] = useState('')
  const [isAddingScene, setIsAddingScene] = useState(false)

  useEffect(() => {
    fetchProjectDetails()
  }, [projectId])

  const fetchProjectDetails = async () => {
    try {
      const [projectData, scenesData, commentsData] = await Promise.all([
        projectsAPI.getProject(projectId),
        scenesAPI.getScenes(projectId),
        commentsAPI.getProjectComments(projectId)
      ])
      
      // Process scenes to separate line art and art images
      const processedScenes = scenesData.map((scene: any) => ({
        ...scene,
        lineArtImages: scene.images?.filter((img: ProjectImage) => img.kind === 'line') || [],
        artImages: scene.images?.filter((img: ProjectImage) => img.kind === 'art') || []
      }))
      
      setProject(projectData)
      setScenes(processedScenes)
      setComments(commentsData)
      
      // Select first scene by default
      if (processedScenes.length > 0) {
        setSelectedScene(processedScenes[0])
      }
    } catch (error) {
      console.error('프로젝트 정보 로드 실패:', error)
      toast({
        title: '오류',
        description: '프로젝트 정보를 불러올 수 없습니다.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, kind: 'line' | 'art') => {
    if (!event.target.files || !selectedScene) return
    
    const file = event.target.files[0]
    if (!file) return
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast({
        title: '오류',
        description: 'JPEG, PNG, WebP 파일만 업로드 가능합니다.',
        variant: 'destructive'
      })
      return
    }
    
    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('kind', kind)
      formData.append('sceneId', selectedScene.id)
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)
      
      const response = await fetch(`/api/projects/${projectId}/scenes/${selectedScene.id}/images`, {
        method: 'POST',
        body: formData
      })
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      if (!response.ok) throw new Error('Upload failed')
      
      const newImage = await response.json()
      
      // Update scenes with new image
      setScenes(prevScenes => 
        prevScenes.map(scene => {
          if (scene.id === selectedScene.id) {
            const updatedScene = { ...scene }
            if (kind === 'line') {
              updatedScene.lineArtImages = [...(scene.lineArtImages || []), newImage]
            } else {
              updatedScene.artImages = [...(scene.artImages || []), newImage]
            }
            setSelectedScene(updatedScene)
            return updatedScene
          }
          return scene
        })
      )
      
      toast({
        title: '업로드 완료',
        description: `${kind === 'line' ? '선화' : '아트'} 이미지가 업로드되었습니다.`
      })
    } catch (error) {
      toast({
        title: '업로드 실패',
        description: '이미지 업로드에 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleAddScene = async () => {
    if (!newSceneName.trim()) return
    
    setIsAddingScene(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSceneName,
          description: newSceneDescription,
          index: scenes.length
        })
      })
      
      if (!response.ok) throw new Error('Failed to add scene')
      
      const newScene = await response.json()
      const processedScene = {
        ...newScene,
        lineArtImages: [],
        artImages: []
      }
      
      setScenes([...scenes, processedScene])
      setSelectedScene(processedScene)
      setNewSceneName('')
      setNewSceneDescription('')
      
      toast({
        title: '씬 추가',
        description: '새로운 씬이 추가되었습니다.'
      })
    } catch (error) {
      toast({
        title: '오류',
        description: '씬 추가에 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setIsAddingScene(false)
    }
  }

  const handleDeleteScene = async (sceneId: string) => {
    if (!confirm('이 씬을 삭제하시겠습니까?')) return
    
    try {
      const response = await fetch(`/api/projects/${projectId}/scenes/${sceneId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete scene')
      
      setScenes(scenes.filter(s => s.id !== sceneId))
      if (selectedScene?.id === sceneId) {
        setSelectedScene(scenes[0] || null)
      }
      
      toast({
        title: '씬 삭제',
        description: '씬이 삭제되었습니다.'
      })
    } catch (error) {
      toast({
        title: '오류',
        description: '씬 삭제에 실패했습니다.',
        variant: 'destructive'
      })
    }
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return
    
    setIsSubmittingComment(true)
    try {
      const comment = await commentsAPI.createComment({
        projectId,
        content: newComment,
        targetType: 'project',
        targetId: projectId
      })
      setComments([comment, ...comments])
      setNewComment('')
      toast({
        title: '댓글 작성',
        description: '댓글이 작성되었습니다.'
      })
    } catch (error) {
      toast({
        title: '오류',
        description: '댓글 작성에 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const startCompareMode = (image: ProjectImage) => {
    setCompareMode(true)
    setCompareImages([image, null])
  }

  const addToCompare = (image: ProjectImage) => {
    if (compareImages[0] && !compareImages[1]) {
      setCompareImages([compareImages[0], image])
    }
  }

  const exitCompareMode = () => {
    setCompareMode(false)
    setCompareImages([null, null])
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">프로젝트를 찾을 수 없습니다.</p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => router.push('/studio')}>
                스튜디오로 돌아가기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/studio')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <Badge variant={project.tag === 'illustration' ? 'default' : 'secondary'}>
                {project.tag === 'illustration' ? '일러스트' : '스토리보드'}
              </Badge>
              {project.hasUpdates && (
                <Badge variant="destructive">New</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{project.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCompareMode(!compareMode)}
            className={cn(compareMode && "bg-primary text-primary-foreground")}
          >
            <GitCompare className="h-4 w-4" />
          </Button>
          <Link href={`/studio/projects/${projectId}/settings`}>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 비교 모드 UI */}
      {compareMode && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>비교 모드</span>
              <Button size="sm" variant="ghost" onClick={exitCompareMode}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              비교할 이미지를 선택하세요 (히스토리에서 드래그&드롭 가능)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-dashed rounded-lg p-4 min-h-[200px] flex items-center justify-center">
                {compareImages[0] ? (
                  <img src={compareImages[0].url} alt="Compare 1" className="max-w-full h-auto" />
                ) : (
                  <p className="text-muted-foreground">첫 번째 이미지 선택</p>
                )}
              </div>
              <div className="border-2 border-dashed rounded-lg p-4 min-h-[200px] flex items-center justify-center">
                {compareImages[1] ? (
                  <img src={compareImages[1].url} alt="Compare 2" className="max-w-full h-auto" />
                ) : (
                  <p className="text-muted-foreground">두 번째 이미지 선택</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 메인 콘텐츠 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="scenes">씬 관리</TabsTrigger>
          <TabsTrigger value="history">히스토리</TabsTrigger>
          <TabsTrigger value="comments">댓글</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  마감일
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {project.deadline ? new Date(project.deadline).toLocaleDateString() : '미정'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  참여자
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{project._count.participants}명</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">상태</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                  {project.status === 'active' ? '진행중' : 
                   project.status === 'completed' ? '완료' : '보관'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* 빠른 작업 영역 */}
          {selectedScene && (
            <Card>
              <CardHeader>
                <CardTitle>현재 씬: {selectedScene.title}</CardTitle>
                <CardDescription>{selectedScene.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 이미지 뷰어 토글 */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={imageViewMode === 'line' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setImageViewMode('line')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      선화
                    </Button>
                    <Button
                      variant={imageViewMode === 'art' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setImageViewMode('art')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      아트
                    </Button>
                    <Button
                      variant={imageViewMode === 'both' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setImageViewMode('both')}
                    >
                      <Layers className="h-4 w-4 mr-2" />
                      모두
                    </Button>
                  </div>

                  {/* 이미지 업로드 영역 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(imageViewMode === 'line' || imageViewMode === 'both') && (
                      <div>
                        <h4 className="font-medium mb-2">선화</h4>
                        <div className="border-2 border-dashed rounded-lg p-4">
                          {selectedScene.lineArtImages && selectedScene.lineArtImages.length > 0 ? (
                            <div className="space-y-2">
                              {selectedScene.lineArtImages.map((img) => (
                                <div key={img.id} className="flex items-center justify-between">
                                  <span className="text-sm">버전 {img.version}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedImage(img)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center text-muted-foreground">선화 없음</p>
                          )}
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => handleImageUpload(e, 'line')}
                            className="mt-2"
                            disabled={isUploading}
                          />
                        </div>
                      </div>
                    )}

                    {(imageViewMode === 'art' || imageViewMode === 'both') && (
                      <div>
                        <h4 className="font-medium mb-2">아트</h4>
                        <div className="border-2 border-dashed rounded-lg p-4">
                          {selectedScene.artImages && selectedScene.artImages.length > 0 ? (
                            <div className="space-y-2">
                              {selectedScene.artImages.map((img) => (
                                <div key={img.id} className="flex items-center justify-between">
                                  <span className="text-sm">버전 {img.version}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedImage(img)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center text-muted-foreground">아트 없음</p>
                          )}
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => handleImageUpload(e, 'art')}
                            className="mt-2"
                            disabled={isUploading}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 업로드 진행률 */}
                  {isUploading && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scenes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>씬 목록</CardTitle>
              <CardDescription>프로젝트의 씬을 관리합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 씬 추가 폼 */}
                <div className="flex gap-2">
                  <Input
                    placeholder="새 씬 이름"
                    value={newSceneName}
                    onChange={(e) => setNewSceneName(e.target.value)}
                  />
                  <Input
                    placeholder="설명 (선택사항)"
                    value={newSceneDescription}
                    onChange={(e) => setNewSceneDescription(e.target.value)}
                  />
                  <Button 
                    onClick={handleAddScene}
                    disabled={isAddingScene || !newSceneName.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    추가
                  </Button>
                </div>

                {/* 씬 목록 */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {scenes.map((scene, index) => (
                      <Card key={scene.id} className={cn(
                        "cursor-pointer transition-colors",
                        selectedScene?.id === scene.id && "border-primary"
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div 
                              className="flex-1"
                              onClick={() => setSelectedScene(scene)}
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">씬 {index + 1}</Badge>
                                <h4 className="font-medium">{scene.title}</h4>
                              </div>
                              {scene.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {scene.description}
                                </p>
                              )}
                              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                                <span>선화: {scene.lineArtImages?.length || 0}</span>
                                <span>아트: {scene.artImages?.length || 0}</span>
                              </div>
                            </div>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  편집
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteScene(scene.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  삭제
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>버전 히스토리</CardTitle>
              <CardDescription>모든 업로드된 이미지의 버전을 확인합니다</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedScene ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">선화 히스토리</h4>
                    <ScrollArea className="h-[300px] border rounded-lg p-2">
                      {selectedScene.lineArtImages && selectedScene.lineArtImages.length > 0 ? (
                        <div className="space-y-2">
                          {selectedScene.lineArtImages.map((img) => (
                            <Card 
                              key={img.id} 
                              className="cursor-pointer hover:border-primary"
                              onClick={() => compareMode ? addToCompare(img) : setSelectedImage(img)}
                            >
                              <CardContent className="p-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">버전 {img.version}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(img.createdAt).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      업로드: {img.uploadedBy.nickname || img.uploadedBy.username}
                                    </p>
                                  </div>
                                  <Button size="sm" variant="ghost">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground">히스토리 없음</p>
                      )}
                    </ScrollArea>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">아트 히스토리</h4>
                    <ScrollArea className="h-[300px] border rounded-lg p-2">
                      {selectedScene.artImages && selectedScene.artImages.length > 0 ? (
                        <div className="space-y-2">
                          {selectedScene.artImages.map((img) => (
                            <Card 
                              key={img.id} 
                              className="cursor-pointer hover:border-primary"
                              onClick={() => compareMode ? addToCompare(img) : setSelectedImage(img)}
                            >
                              <CardContent className="p-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">버전 {img.version}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(img.createdAt).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      업로드: {img.uploadedBy.nickname || img.uploadedBy.username}
                                    </p>
                                  </div>
                                  <Button size="sm" variant="ghost">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground">히스토리 없음</p>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">씬을 선택하세요</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>프로젝트 댓글</CardTitle>
              <CardDescription>프로젝트 전체에 대한 댓글입니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 댓글 입력 */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="댓글을 입력하세요... (@로 멘션 가능)"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button 
                    onClick={handleSubmitComment}
                    disabled={isSubmittingComment || !newComment.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {/* 댓글 목록 */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {comments.length > 0 ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {comment.author?.username?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {comment.author?.nickname || comment.author?.username || 'Unknown'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-sm mt-1">{comment.content}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p>아직 댓글이 없습니다.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 이미지 뷰어 모달 */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img 
              src={selectedImage.url} 
              alt="Image viewer"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  // Implement zoom functionality
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAnnotations(!showAnnotations)
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  // Implement download
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="absolute bottom-4 left-4 bg-background/90 p-2 rounded">
              <p className="text-sm font-medium">
                {selectedImage.kind === 'line' ? '선화' : '아트'} - 버전 {selectedImage.version}
              </p>
              <p className="text-xs text-muted-foreground">
                업로드: {selectedImage.uploadedBy.nickname || selectedImage.uploadedBy.username}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}