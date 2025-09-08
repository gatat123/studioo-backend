'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Stage, Layer, Line, Rect, Text, Circle, Arrow } from 'react-konva'
import Konva from 'konva'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Pencil,
  Square,
  Circle as CircleIcon,
  Type,
  MousePointer,
  Trash2,
  Save,
  X,
  ArrowUpRight,
  Undo,
  Redo
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Annotation types
export interface Annotation {
  id: string
  type: 'drawing' | 'rectangle' | 'circle' | 'arrow' | 'text'
  points?: number[]
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  color: string
  strokeWidth: number
  note?: string
  author: {
    id: string
    username: string
    nickname?: string
  }
  createdAt: Date
}

interface AnnotationLayerProps {
  imageUrl: string
  imageId: string
  annotations?: Annotation[]
  onSave?: (annotations: Annotation[]) => void
  readOnly?: boolean
  currentUser?: {
    id: string
    username: string
    nickname?: string
  }
}

type Tool = 'select' | 'pen' | 'rectangle' | 'circle' | 'arrow' | 'text'

export function AnnotationLayer({
  imageUrl,
  imageId,
  annotations: initialAnnotations = [],
  onSave,
  readOnly = false,
  currentUser = { id: '1', username: 'user', nickname: 'User' }
}: AnnotationLayerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations)
  const [tool, setTool] = useState<Tool>('select')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [color, setColor] = useState('#FF0000')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [history, setHistory] = useState<Annotation[][]>([initialAnnotations])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  
  const stageRef = useRef<Konva.Stage>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load image and set stage size
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const scale = containerWidth / img.width
        setStageSize({
          width: containerWidth,
          height: img.height * scale
        })
      }
      imageRef.current = img
    }
    img.src = imageUrl
  }, [imageUrl])

  // Handle mouse/touch events
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly || tool === 'select') return

    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type: tool === 'pen' ? 'drawing' : tool,
      color,
      strokeWidth,
      author: currentUser,
      createdAt: new Date()
    }

    switch (tool) {
      case 'pen':
        newAnnotation.points = [pos.x, pos.y]
        break
      case 'rectangle':
      case 'circle':
        newAnnotation.x = pos.x
        newAnnotation.y = pos.y
        newAnnotation.width = 0
        newAnnotation.height = 0
        break
      case 'arrow':
        newAnnotation.points = [pos.x, pos.y, pos.x, pos.y]
        break
      case 'text':
        newAnnotation.x = pos.x
        newAnnotation.y = pos.y
        newAnnotation.text = 'Double click to edit'
        break
    }

    setCurrentAnnotation(newAnnotation)
    setIsDrawing(true)
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing || !currentAnnotation) return

    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return

    const updated = { ...currentAnnotation }

    switch (currentAnnotation.type) {
      case 'drawing':
        updated.points = [...(currentAnnotation.points || []), pos.x, pos.y]
        break
      case 'rectangle':
      case 'circle':
        updated.width = pos.x - (currentAnnotation.x || 0)
        updated.height = pos.y - (currentAnnotation.y || 0)
        break
      case 'arrow':
        const points = currentAnnotation.points || []
        updated.points = [points[0], points[1], pos.x, pos.y]
        break
    }

    setCurrentAnnotation(updated)
  }

  const handleMouseUp = () => {
    if (!isDrawing || !currentAnnotation) return

    const newAnnotations = [...annotations, currentAnnotation]
    setAnnotations(newAnnotations)
    addToHistory(newAnnotations)
    
    if (currentAnnotation.type !== 'text') {
      setShowNoteDialog(true)
      setSelectedId(currentAnnotation.id)
    }

    setCurrentAnnotation(null)
    setIsDrawing(false)
  }

  // History management
  const addToHistory = (newAnnotations: Annotation[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newAnnotations)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setAnnotations(history[historyIndex - 1])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setAnnotations(history[historyIndex + 1])
    }
  }

  // Delete annotation
  const deleteAnnotation = (id: string) => {
    const newAnnotations = annotations.filter(a => a.id !== id)
    setAnnotations(newAnnotations)
    addToHistory(newAnnotations)
    setSelectedId(null)
  }

  // Save note
  const saveNote = () => {
    if (selectedId) {
      const newAnnotations = annotations.map(a => 
        a.id === selectedId ? { ...a, note: noteText } : a
      )
      setAnnotations(newAnnotations)
      addToHistory(newAnnotations)
    }
    setShowNoteDialog(false)
    setNoteText('')
    setSelectedId(null)
  }

  // Save all annotations
  const handleSaveAll = () => {
    if (onSave) {
      onSave(annotations)
    }
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Toolbar */}
      {!readOnly && (
        <Card className="absolute top-4 left-4 z-10 p-2">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={tool === 'select' ? 'default' : 'ghost'}
              onClick={() => setTool('select')}
            >
              <MousePointer className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={tool === 'pen' ? 'default' : 'ghost'}
              onClick={() => setTool('pen')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={tool === 'rectangle' ? 'default' : 'ghost'}
              onClick={() => setTool('rectangle')}
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={tool === 'circle' ? 'default' : 'ghost'}
              onClick={() => setTool('circle')}
            >
              <CircleIcon className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={tool === 'arrow' ? 'default' : 'ghost'}
              onClick={() => setTool('arrow')}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={tool === 'text' ? 'default' : 'ghost'}
              onClick={() => setTool('text')}
            >
              <Type className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 border rounded cursor-pointer"
            />
            <select
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="px-2 py-1 text-sm border rounded"
            >
              <option value={1}>1px</option>
              <option value={2}>2px</option>
              <option value={3}>3px</option>
              <option value={5}>5px</option>
            </select>
            <div className="w-px h-6 bg-border mx-1" />
            <Button size="sm" variant="ghost" onClick={undo} disabled={historyIndex === 0}>
              <Undo className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={redo} disabled={historyIndex === history.length - 1}>
              <Redo className="h-4 w-4" />
            </Button>
            {selectedId && (
              <Button size="sm" variant="ghost" onClick={() => deleteAnnotation(selectedId)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <div className="w-px h-6 bg-border mx-1" />
            <Button size="sm" onClick={handleSaveAll}>
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </Card>
      )}

      {/* Canvas */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden">
        <img 
          src={imageUrl} 
          alt="Annotated" 
          className="w-full h-auto"
          style={{ display: 'block' }}
        />
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          ref={stageRef}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchmove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          className="absolute top-0 left-0"
        >
          <Layer>
            {/* Render existing annotations */}
            {annotations.map((annotation) => {
              switch (annotation.type) {
                case 'drawing':
                  return (
                    <Line
                      key={annotation.id}
                      points={annotation.points}
                      stroke={annotation.color}
                      strokeWidth={annotation.strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      onClick={() => setSelectedId(annotation.id)}
                    />
                  )
                case 'rectangle':
                  return (
                    <Rect
                      key={annotation.id}
                      x={annotation.x}
                      y={annotation.y}
                      width={annotation.width}
                      height={annotation.height}
                      stroke={annotation.color}
                      strokeWidth={annotation.strokeWidth}
                      onClick={() => setSelectedId(annotation.id)}
                    />
                  )
                case 'circle':
                  return (
                    <Circle
                      key={annotation.id}
                      x={(annotation.x || 0) + (annotation.width || 0) / 2}
                      y={(annotation.y || 0) + (annotation.height || 0) / 2}
                      radius={Math.abs(annotation.width || 0) / 2}
                      stroke={annotation.color}
                      strokeWidth={annotation.strokeWidth}
                      onClick={() => setSelectedId(annotation.id)}
                    />
                  )
                case 'arrow':
                  return (
                    <Arrow
                      key={annotation.id}
                      points={annotation.points}
                      stroke={annotation.color}
                      strokeWidth={annotation.strokeWidth}
                      onClick={() => setSelectedId(annotation.id)}
                    />
                  )
                case 'text':
                  return (
                    <Text
                      key={annotation.id}
                      x={annotation.x}
                      y={annotation.y}
                      text={annotation.text}
                      fontSize={16}
                      fill={annotation.color}
                      onClick={() => setSelectedId(annotation.id)}
                    />
                  )
                default:
                  return null
              }
            })}

            {/* Render current annotation being drawn */}
            {currentAnnotation && (
              <>
                {currentAnnotation.type === 'drawing' && (
                  <Line
                    points={currentAnnotation.points}
                    stroke={currentAnnotation.color}
                    strokeWidth={currentAnnotation.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                  />
                )}
                {currentAnnotation.type === 'rectangle' && (
                  <Rect
                    x={currentAnnotation.x}
                    y={currentAnnotation.y}
                    width={currentAnnotation.width}
                    height={currentAnnotation.height}
                    stroke={currentAnnotation.color}
                    strokeWidth={currentAnnotation.strokeWidth}
                  />
                )}
                {currentAnnotation.type === 'circle' && (
                  <Circle
                    x={(currentAnnotation.x || 0) + (currentAnnotation.width || 0) / 2}
                    y={(currentAnnotation.y || 0) + (currentAnnotation.height || 0) / 2}
                    radius={Math.abs(currentAnnotation.width || 0) / 2}
                    stroke={currentAnnotation.color}
                    strokeWidth={currentAnnotation.strokeWidth}
                  />
                )}
                {currentAnnotation.type === 'arrow' && (
                  <Arrow
                    points={currentAnnotation.points}
                    stroke={currentAnnotation.color}
                    strokeWidth={currentAnnotation.strokeWidth}
                  />
                )}
              </>
            )}
          </Layer>
        </Stage>
      </div>

      {/* Note Dialog */}
      {showNoteDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Add Note</h3>
            <Textarea
              placeholder="Add a note to explain this annotation..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="mb-4"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button onClick={saveNote}>
                <Save className="h-4 w-4 mr-1" />
                Save Note
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Annotation Notes List */}
      {annotations.filter(a => a.note).length > 0 && (
        <Card className="mt-4 p-4">
          <h3 className="font-semibold mb-2">Annotation Notes</h3>
          <div className="space-y-2">
            {annotations.filter(a => a.note).map((annotation, index) => (
              <div key={annotation.id} className="flex items-start gap-2 text-sm">
                <span className="font-medium">#{index + 1}:</span>
                <p className="flex-1">{annotation.note}</p>
                <span className="text-xs text-muted-foreground">
                  by {annotation.author.nickname || annotation.author.username}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}