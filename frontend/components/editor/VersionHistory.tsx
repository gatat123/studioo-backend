'use client'

import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  Clock, 
  RotateCcw, 
  Eye, 
  Filter, 
  ChevronDown,
  User,
  Calendar,
  ArrowUpDown,
  Loader2,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Version data type
export interface Version {
  id: string
  versionNumber: number
  name?: string
  thumbnailUrl: string
  fullImageUrl: string
  timestamp: Date
  author: {
    id: string
    name: string
    avatar?: string
  }
  type: 'lineart' | 'art'
  fileSize: number
  dimensions: {
    width: number
    height: number
  }
  changes?: string
  isCurrent?: boolean
}

interface VersionHistoryProps {
  versions: Version[]
  currentVersionId?: string
  isLoading?: boolean
  onVersionSelect?: (version: Version) => void
  onVersionCompare?: (version1: Version, version2: Version) => void
  onVersionRestore?: (version: Version) => void
}

export default function VersionHistory({
  versions,
  currentVersionId,
  isLoading = false,
  onVersionSelect,
  onVersionCompare,
  onVersionRestore
}: VersionHistoryProps) {
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'date' | 'author' | 'type'>('date')
  const [filterBy, setFilterBy] = useState<'all' | 'lineart' | 'art'>('all')
  const [isCompareMode, setIsCompareMode] = useState(false)

  // Sort and filter versions
  const processedVersions = useMemo(() => {
    let filtered = versions

    // Apply filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(v => v.type === filterBy)
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.timestamp.getTime() - a.timestamp.getTime()
        case 'author':
          return a.author.name.localeCompare(b.author.name)
        case 'type':
          return a.type.localeCompare(b.type)
        default:
          return 0
      }
    })

    return sorted
  }, [versions, sortBy, filterBy])

  // Handle version selection for comparison
  const handleVersionClick = (version: Version) => {
    if (isCompareMode) {
      if (selectedVersions.includes(version.id)) {
        setSelectedVersions(prev => prev.filter(id => id !== version.id))
      } else if (selectedVersions.length < 2) {
        setSelectedVersions(prev => [...prev, version.id])
      }

      // Auto-trigger comparison when 2 versions are selected
      if (selectedVersions.length === 1 && !selectedVersions.includes(version.id)) {
        const firstVersion = versions.find(v => v.id === selectedVersions[0])
        if (firstVersion && onVersionCompare) {
          onVersionCompare(firstVersion, version)
        }
      }
    } else {
      onVersionSelect?.(version)
    }
  }

  // Toggle compare mode
  const toggleCompareMode = () => {
    setIsCompareMode(!isCompareMode)
    setSelectedVersions([])
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB'
    else return Math.round(bytes / 1048576) + ' MB'
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full h-full p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4" />
            버전 히스토리
          </h3>
          <Badge variant="secondary" className="text-xs">
            {processedVersions.length}개 버전
          </Badge>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isCompareMode ? "default" : "outline"}
            onClick={toggleCompareMode}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-1" />
            {isCompareMode ? '비교 중' : '비교'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1">
                <Filter className="w-4 h-4 mr-1" />
                필터
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>타입별 필터</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterBy('all')}>
                {filterBy === 'all' && <Check className="w-4 h-4 mr-2" />}
                전체
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterBy('lineart')}>
                {filterBy === 'lineart' && <Check className="w-4 h-4 mr-2" />}
                선화
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterBy('art')}>
                {filterBy === 'art' && <Check className="w-4 h-4 mr-2" />}
                채색
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1">
                <ArrowUpDown className="w-4 h-4 mr-1" />
                정렬
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>정렬 기준</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('date')}>
                {sortBy === 'date' && <Check className="w-4 h-4 mr-2" />}
                날짜순
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('author')}>
                {sortBy === 'author' && <Check className="w-4 h-4 mr-2" />}
                작성자순
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('type')}>
                {sortBy === 'type' && <Check className="w-4 h-4 mr-2" />}
                타입순
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Compare mode info */}
        {isCompareMode && (
          <div className="mt-3 p-2 bg-muted rounded-md text-sm">
            비교할 버전 2개를 선택하세요 ({selectedVersions.length}/2)
          </div>
        )}
      </div>

      {/* Version List */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 py-4">
          {processedVersions.map((version) => (
            <div
              key={version.id}
              className={`
                relative p-3 rounded-lg border cursor-pointer transition-all
                hover:bg-accent/50
                ${version.id === currentVersionId ? 'border-primary bg-accent' : 'border-border'}
                ${selectedVersions.includes(version.id) ? 'ring-2 ring-primary' : ''}
              `}
              onClick={() => handleVersionClick(version)}
            >
              {/* Current version indicator */}
              {version.isCurrent && (
                <Badge className="absolute -top-2 right-2 text-xs" variant="default">
                  현재 버전
                </Badge>
              )}

              <div className="flex gap-3">
                {/* Thumbnail */}
                <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden bg-muted">
                  <img
                    src={version.thumbnailUrl}
                    alt={`Version ${version.versionNumber}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className="absolute bottom-1 left-1 text-white text-xs font-semibold">
                    v{version.versionNumber}
                  </span>
                </div>

                {/* Version Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-medium text-sm">
                        {version.name || `버전 ${version.versionNumber}`}
                      </p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {version.type === 'lineart' ? '선화' : '채색'}
                      </Badge>
                    </div>
                  </div>

                  {/* Author and time */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{version.author.name}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {format(version.timestamp, 'MM/dd HH:mm', { locale: ko })}
                      </span>
                    </div>
                  </div>

                  {/* File info */}
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatFileSize(version.fileSize)} • {version.dimensions.width}x{version.dimensions.height}
                  </div>

                  {/* Changes */}
                  {version.changes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                      {version.changes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {!isCompareMode && (
                  <div className="flex flex-col gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              onVersionRestore?.(version)
                            }}
                            disabled={version.isCurrent}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>이 버전으로 복원</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Timeline View (Optional) */}
      {processedVersions.length > 0 && (
        <div className="p-4 border-t">
          <div className="text-xs text-muted-foreground mb-2">타임라인</div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            {processedVersions.map((version, index) => {
              const position = (index / (processedVersions.length - 1 || 1)) * 100
              return (
                <div
                  key={version.id}
                  className={`
                    absolute w-2 h-2 rounded-full -translate-x-1/2
                    ${version.type === 'lineart' ? 'bg-blue-500' : 'bg-green-500'}
                    ${version.isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}
                  `}
                  style={{ left: `${100 - position}%` }}
                  title={`v${version.versionNumber} - ${format(version.timestamp, 'MM/dd HH:mm')}`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>최신</span>
            <span>과거</span>
          </div>
        </div>
      )}
    </div>
  )
}
