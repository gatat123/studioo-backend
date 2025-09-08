'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Line, Rect, Circle, Arrow, Text, Transformer } from 'react-konva'
import Konva from 'konva'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { 
  Pencil, 
  Square, 
  Circle as CircleIcon, 
  ArrowUpRight, 
  Type, 
  Eraser,
  Undo,
  Redo,
  Eye,
  EyeOff,
  Download,
  Trash2,
  Palette
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
type Tool = 'pen' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'eraser' | 'select'
type Shape = {
  id: string
  type: 'line' | 'rectangle' | 'circle' | 'arrow' | 'text'
  points?: number[]
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  text?: string
  fontSize?: number
  stroke: string
  strokeWidth: number
  opacity: number
  visible: boolean
}

interface AnnotationToolsProps {
  imageUrl?: string
  width: number
  height: number
  onSave?: (shapes: Shape[]) => void
  initialShapes?: Shape[]
}

export function AnnotationTools({ 
  imageUrl, 
  width, 
  height, 
  onSave,
  initialShapes = []
}: AnnotationToolsProps) {
  const [tool, setTool] = useState<Tool>('pen')
  const [shapes, setShapes] = useState<Shape[]>(initialShapes)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentShapeId, setCurrentShapeId] = useState<string | null>(null)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [strokeColor, setStrokeColor] = useState('#FF0000')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [opacity, setOpacity] = useState(1)
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [history, setHistory] = useState<Shape[][]>([initialShapes])
  const [historyIndex, setHistoryIndex] = useState(0)
  
  const stageRef = useRef<Konva.Stage>(null)
  const layerRef = useRef<Konva.Layer>(null)
  const transformerRef = useRef<Konva.Transformer>(null)

  // Save to history
  const saveToHistory = useCallback((newShapes: Shape[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newShapes)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setShapes(history[newIndex])
    }
  }, [historyIndex, history])

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setShapes(history[newIndex])
    }
  }, [historyIndex, history])

  // Start drawing
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === 'select') return

    setIsDrawing(true)
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return

    const id = `shape_${Date.now()}`
    setCurrentShapeId(id)

    let newShape: Shape | null = null

    switch (tool) {
      case 'pen':
        newShape = {
          id,
          type: 'line',
          points: [pos.x, pos.y],
          stroke: strokeColor,
          strokeWidth,
          opacity,
          visible: true
        }
        break
      case 'rectangle':
        newShape = {
          id,
          type: 'rectangle',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          stroke: strokeColor,
          strokeWidth,
          opacity,
          visible: true
        }
        break
      case 'circle':
        newShape = {
          id,
          type: 'circle',
          x: pos.x,
          y: pos.y,
          radius: 0,
          stroke: strokeColor,
          strokeWidth,
          opacity,
          visible: true
        }
        break
      case 'arrow':
        newShape = {
          id,
          type: 'arrow',
          points: [pos.x, pos.y, pos.x, pos.y],
          stroke: strokeColor,
          strokeWidth,
          opacity,
          visible: true
        }
        break
      case 'text':
        const text = prompt('Enter text:')
        if (text) {
          newShape = {
            id,
            type: 'text',
            x: pos.x,
            y: pos.y,
            text,
            fontSize: 16,
            stroke: strokeColor,
            strokeWidth: 1,
            opacity,
            visible: true
          }
        }
        setIsDrawing(false)
        break
    }

    if (newShape) {
      const newShapes = [...shapes, newShape]
      setShapes(newShapes)
      if (tool === 'text') {
        saveToHistory(newShapes)
      }
    }
  }

  // Drawing
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !currentShapeId) return

    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return

    const newShapes = shapes.map(shape => {
      if (shape.id !== currentShapeId) return shape

      switch (shape.type) {
        case 'line':
          if (tool === 'pen') {
            return {
              ...shape,
              points: [...(shape.points || []), pos.x, pos.y]
            }
          }
          break
        case 'rectangle':
          if (shape.x !== undefined && shape.y !== undefined) {
            return {
              ...shape,
              width: pos.x - shape.x,
              height: pos.y - shape.y
            }
          }
          break
        case 'circle':
          if (shape.x !== undefined && shape.y !== undefined) {
            const dx = pos.x - shape.x
            const dy = pos.y - shape.y
            return {
              ...shape,
              radius: Math.sqrt(dx * dx + dy * dy)
            }
          }
          break
        case 'arrow':
          if (shape.points && shape.points.length >= 2) {
            return {
              ...shape,
              points: [shape.points[0], shape.points[1], pos.x, pos.y]
            }
          }
          break
      }
      return shape
    })

    setShapes(newShapes)
  }

  // End drawing
  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false)
      saveToHistory(shapes)
      setCurrentShapeId(null)
    }
  }

  // Clear all
  const handleClear = () => {
    const newShapes: Shape[] = []
    setShapes(newShapes)
    saveToHistory(newShapes)
  }

  // Toggle visibility
  const toggleAnnotations = () => {
    setShowAnnotations(!showAnnotations)
  }

  // Save annotations
  const handleSaveAnnotations = () => {
    if (onSave) {
      onSave(shapes)
    }
    // Save to IndexedDB
    saveToIndexedDB(shapes)
  }

  // Save to IndexedDB
  const saveToIndexedDB = async (shapesToSave: Shape[]) => {
    try {
      const db = await openDB()
      const transaction = db.transaction(['annotations'], 'readwrite')
      const store = transaction.objectStore('annotations')
      await store.put({ id: 'current', shapes: shapesToSave, timestamp: Date.now() })
      console.log('Annotations saved to IndexedDB')
    } catch (error) {
      console.error('Error saving to IndexedDB:', error)
    }
  }

  // Open IndexedDB
  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AnnotationsDB', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('annotations')) {
          db.createObjectStore('annotations', { keyPath: 'id' })
        }
      }
    })
  }

  // Load from IndexedDB
  const loadFromIndexedDB = async () => {
    try {
      const db = await openDB()
      const transaction = db.transaction(['annotations'], 'readonly')
      const store = transaction.objectStore('annotations')
      const request = store.get('current')
      
      request.onsuccess = () => {
        if (request.result) {
          setShapes(request.result.shapes)
          saveToHistory(request.result.shapes)
        }
      }
    } catch (error) {
      console.error('Error loading from IndexedDB:', error)
    }
  }

  // Load annotations on mount
  useEffect(() => {
    loadFromIndexedDB()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) {
              handleRedo()
            } else {
              handleUndo()
            }
            break
          case 's':
            e.preventDefault()
            handleSaveAnnotations()
            break
        }
      }
      
      // Tool shortcuts
      switch (e.key) {
        case 'p':
          setTool('pen')
          break
        case 'r':
          setTool('rectangle')
          break
        case 'c':
          setTool('circle')
          break
        case 'a':
          setTool('arrow')
          break
        case 't':
          setTool('text')
          break
        case 'e':
          setTool('eraser')
          break
        case 'v':
          setTool('select')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  const tools = [
    { id: 'select', icon: <span className="text-xs">V</span>, label: 'Select (V)' },
    { id: 'pen', icon: <Pencil className="h-4 w-4" />, label: 'Pen (P)' },
    { id: 'rectangle', icon: <Square className="h-4 w-4" />, label: 'Rectangle (R)' },
    { id: 'circle', icon: <CircleIcon className="h-4 w-4" />, label: 'Circle (C)' },
    { id: 'arrow', icon: <ArrowUpRight className="h-4 w-4" />, label: 'Arrow (A)' },
    { id: 'text', icon: <Type className="h-4 w-4" />, label: 'Text (T)' },
    { id: 'eraser', icon: <Eraser className="h-4 w-4" />, label: 'Eraser (E)' },
  ]

  const colors = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
    '#FF00FF', '#00FFFF', '#000000', '#FFFFFF'
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Tools */}
          <div className="flex gap-1">
            {tools.map(({ id, icon, label }) => (
              <Button
                key={id}
                variant={tool === id ? 'default' : 'outline'}
                size="icon"
                onClick={() => setTool(id as Tool)}
                title={label}
              >
                {icon}
              </Button>
            ))}
          </div>

          <div className="h-8 w-px bg-border" />

          {/* Actions */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handleUndo}
              disabled={historyIndex === 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRedo}
              disabled={historyIndex === history.length - 1}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-8 w-px bg-border" />

          {/* Color Picker */}
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              {colors.map(color => (
                <button
                  key={color}
                  className={cn(
                    "h-6 w-6 rounded border-2",
                    strokeColor === color ? "border-primary" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setStrokeColor(color)}
                />
              ))}
            </div>
          </div>

          <div className="h-8 w-px bg-border" />

          {/* Stroke Width */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Width:</span>
            <Slider
              value={[strokeWidth]}
              onValueChange={([value]) => setStrokeWidth(value)}
              min={1}
              max={20}
              step={1}
              className="w-24"
            />
            <span className="text-sm w-8">{strokeWidth}</span>
          </div>

          {/* Opacity */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Opacity:</span>
            <Slider
              value={[opacity * 100]}
              onValueChange={([value]) => setOpacity(value / 100)}
              min={0}
              max={100}
              step={10}
              className="w-24"
            />
            <span className="text-sm w-8">{Math.round(opacity * 100)}%</span>
          </div>

          <div className="h-8 w-px bg-border" />

          {/* Visibility & Actions */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleAnnotations}
              title={showAnnotations ? "Hide Annotations" : "Show Annotations"}
            >
              {showAnnotations ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleClear}
              title="Clear All"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleSaveAnnotations}
              title="Save (Ctrl+S)"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Canvas */}
      <Card className="relative overflow-hidden">
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          style={{ cursor: tool === 'pen' ? 'crosshair' : 'default' }}
        >
          <Layer>
            {/* Background Image */}
            {imageUrl && (
              <Rect
                width={width}
                height={height}
                // fillPatternImage={image}
              />
            )}
          </Layer>
          
          {/* Annotations Layer */}
          <Layer ref={layerRef} visible={showAnnotations}>
            {shapes.map((shape) => {
              if (!shape.visible) return null

              switch (shape.type) {
                case 'line':
                  return (
                    <Line
                      key={shape.id}
                      points={shape.points || []}
                      stroke={shape.stroke}
                      strokeWidth={shape.strokeWidth}
                      opacity={shape.opacity}
                      lineCap="round"
                      lineJoin="round"
                    />
                  )
                case 'rectangle':
                  return (
                    <Rect
                      key={shape.id}
                      x={shape.x}
                      y={shape.y}
                      width={shape.width}
                      height={shape.height}
                      stroke={shape.stroke}
                      strokeWidth={shape.strokeWidth}
                      opacity={shape.opacity}
                    />
                  )
                case 'circle':
                  return (
                    <Circle
                      key={shape.id}
                      x={shape.x}
                      y={shape.y}
                      radius={shape.radius}
                      stroke={shape.stroke}
                      strokeWidth={shape.strokeWidth}
                      opacity={shape.opacity}
                    />
                  )
                case 'arrow':
                  return (
                    <Arrow
                      key={shape.id}
                      points={shape.points || []}
                      stroke={shape.stroke}
                      strokeWidth={shape.strokeWidth}
                      opacity={shape.opacity}
                      pointerLength={10}
                      pointerWidth={10}
                    />
                  )
                case 'text':
                  return (
                    <Text
                      key={shape.id}
                      x={shape.x}
                      y={shape.y}
                      text={shape.text}
                      fontSize={shape.fontSize}
                      fill={shape.stroke}
                      opacity={shape.opacity}
                    />
                  )
                default:
                  return null
              }
            })}
            
            {/* Transformer for selection */}
            <Transformer ref={transformerRef} />
          </Layer>
        </Stage>
      </Card>

      {/* Status Bar */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Tool: {tool.charAt(0).toUpperCase() + tool.slice(1)}</span>
        <span>Annotations: {shapes.length}</span>
        <span>History: {historyIndex + 1}/{history.length}</span>
      </div>
    </div>
  )
}
