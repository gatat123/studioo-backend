'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Pencil, 
  Type, 
  ArrowUpLeft,
  Square,
  Circle,
  Eraser,
  Palette,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SceneToolbarProps {
  isOpen: boolean
  onToggle: () => void
}

export default function SceneToolbar({ isOpen, onToggle }: SceneToolbarProps) {
  const tools = [
    { icon: Pencil, name: '그리기', shortcut: 'P' },
    { icon: Type, name: '텍스트', shortcut: 'T' },
    { icon: ArrowUpLeft, name: '화살표', shortcut: 'A' },
    { icon: Square, name: '사각형', shortcut: 'R' },
    { icon: Circle, name: '원', shortcut: 'C' },
    { icon: Eraser, name: '지우개', shortcut: 'E' },
    { icon: Palette, name: '색상', shortcut: 'K' },
  ]

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 z-10",
          isOpen ? "left-16" : "left-0"
        )}
        onClick={onToggle}
      >
        {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {/* Toolbar */}
      <div
        className={cn(
          "w-16 border-r bg-background transition-all duration-300 flex flex-col",
          !isOpen && "-translate-x-full hidden"
        )}
      >
        <div className="p-2 space-y-2">
          <TooltipProvider>
            {tools.map((tool, index) => (
              <div key={tool.name}>
                {index === 6 && <Separator className="my-2" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-full"
                    >
                      <tool.icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{tool.name}</p>
                    <p className="text-xs text-muted-foreground">
                      단축키: {tool.shortcut}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </TooltipProvider>
        </div>
      </div>
    </>
  )
}
