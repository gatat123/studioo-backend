'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  Maximize2,
  Upload,
  Image as ImageIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageViewerProps {
  sceneId: string
  lineartImage?: string | null
  artImage?: string | null
}

export default function ImageViewer({ sceneId, lineartImage, artImage }: ImageViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [activeTab, setActiveTab] = useState<'lineart' | 'art'>('lineart')
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleReset = () => {
    setZoom(100)
    setRotation(0)
  }

  const handleFileUpload = async (type: 'lineart' | 'art', file: File) => {
    // TODO: 파일 업로드 API 호출
    console.log(`Uploading ${type} file:`, file.name)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))
    
    if (imageFile) {
      handleFileUpload(activeTab, imageFile)
    }
  }

  const currentImage = activeTab === 'lineart' ? lineartImage : artImage

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-background/95 backdrop-blur p-2">
        <div className="flex items-center justify-between">
          {/* Image Type Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'lineart' | 'art')}>
            <TabsList>
              <TabsTrigger value="lineart">
                <ImageIcon className="h-4 w-4 mr-2" />
                선화
              </TabsTrigger>
              <TabsTrigger value="art">
                <ImageIcon className="h-4 w-4 mr-2" />
                아트
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">
              {zoom}%
            </span>
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleRotate}>
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            {currentImage && (
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Image Display Area */}
      <div 
        ref={containerRef}
        className={cn(
          "flex-1 relative overflow-auto bg-muted/20",
          isDragging && "bg-primary/10 border-2 border-dashed border-primary"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="min-h-full flex items-center justify-center p-8">
          {currentImage ? (
            <img
              ref={imageRef}
              src={currentImage}
              alt={`${activeTab} image`}
              className="max-w-full h-auto"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s ease-in-out'
              }}
            />
          ) : (
            <Card className="p-12 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                {activeTab === 'lineart' ? '선화' : '아트'} 이미지 업로드
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                이미지를 드래그하거나 클릭하여 업로드하세요
              </p>
              <Button variant="outline" asChild>
                <label>
                  파일 선택
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(activeTab, file)
                    }}
                  />
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                지원 형식: JPEG, PNG, WebP
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
