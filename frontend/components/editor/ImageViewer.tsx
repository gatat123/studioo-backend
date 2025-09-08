'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Grid,
  Move,
  X,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ImageViewerProps {
  primaryImage: string;
  compareImage?: string;
  alt?: string;
  className?: string;
  showControls?: boolean;
  showInfo?: boolean;
  imageInfo?: {
    filename?: string;
    size?: string;
    dimensions?: string;
    uploadedBy?: string;
    uploadedAt?: string;
  };
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  primaryImage,
  compareImage,
  alt = 'Image',
  className,
  showControls = true,
  showInfo = false,
  imageInfo,
}) => {
  const transformComponentRef = useRef<ReactZoomPanPinchRef | null>(null);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (!transformComponentRef.current) return;

      const { zoomIn, zoomOut, resetTransform } = transformComponentRef.current;

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            resetTransform();
          }
          break;
        case 'f':
        case 'F':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
        case 'c':
        case 'C':
          if (compareImage) {
            e.preventDefault();
            setCompareMode(!compareMode);
          }
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          setShowGrid(!showGrid);
          break;
        case 'Escape':
          if (isFullscreen) {
            exitFullscreen();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [compareMode, isFullscreen, showGrid, compareImage]);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }, [isFullscreen]);

  const enterFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Preset zoom levels
  const setZoomLevel = (level: number) => {
    if (transformComponentRef.current) {
      const { setTransform } = transformComponentRef.current;
      setTransform(0, 0, level);
    }
  };

  const renderControls = () => {
    if (!showControls) return null;

    return (
      <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-2">
        <TooltipProvider>
          <div className="flex items-center gap-1">
            {/* Zoom controls */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => transformComponentRef.current?.zoomIn()}
                  className="h-8 w-8"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In (+)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => transformComponentRef.current?.zoomOut()}
                  className="h-8 w-8"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out (-)</TooltipContent>
            </Tooltip>

            <div className="px-2 min-w-[80px] text-xs text-center">
              {Math.round(scale * 100)}%
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Preset zoom levels */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoomLevel(1)}
                  className="h-8 px-2 text-xs"
                >
                  100%
                </Button>
              </TooltipTrigger>
              <TooltipContent>Actual Size</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => transformComponentRef.current?.centerView()}
                  className="h-8 px-2 text-xs"
                >
                  Fit
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit to Screen</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            {/* Reset */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => transformComponentRef.current?.resetTransform()}
                  className="h-8 w-8"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset View (Ctrl+0)</TooltipContent>
            </Tooltip>

            {/* Grid toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={showGrid}
                  onPressedChange={setShowGrid}
                  size="sm"
                  className="h-8 w-8"
                >
                  <Grid className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>Toggle Grid (G)</TooltipContent>
            </Tooltip>

            {/* Compare mode toggle */}
            {compareImage && (
              <>
                <Separator orientation="vertical" className="h-6" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      pressed={compareMode}
                      onPressedChange={setCompareMode}
                      size="sm"
                      className="h-8 px-2 text-xs"
                    >
                      Compare
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Compare Mode (C)</TooltipContent>
                </Tooltip>
              </>
            )}

            <Separator orientation="vertical" className="h-6" />

            {/* Fullscreen */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="h-8 w-8"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen (Ctrl+F)'}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    );
  };

  const renderImageInfo = () => {
    if (!showInfo || !imageInfo) return null;

    return (
      <div className="absolute bottom-4 left-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-sm">
        {imageInfo.filename && (
          <div className="font-medium">{imageInfo.filename}</div>
        )}
        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
          {imageInfo.dimensions && <span>{imageInfo.dimensions}</span>}
          {imageInfo.size && <span>{imageInfo.size}</span>}
        </div>
        {(imageInfo.uploadedBy || imageInfo.uploadedAt) && (
          <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
            {imageInfo.uploadedBy && <span>by {imageInfo.uploadedBy}</span>}
            {imageInfo.uploadedAt && <span>{imageInfo.uploadedAt}</span>}
          </div>
        )}
      </div>
    );
  };

  const renderGrid = () => {
    if (!showGrid) return null;

    return (
      <div className="absolute inset-0 pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <pattern
              id="grid"
              width="100"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 100 0 L 0 0 0 100"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {/* Center crosshair */}
          <line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
        </svg>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full bg-gray-900 overflow-hidden',
        className
      )}
    >
      {renderControls()}
      {renderImageInfo()}

      {compareMode && compareImage ? (
        <div className="w-full h-full">
          <ReactCompareSlider
            itemOne={
              <ReactCompareSliderImage src={primaryImage} alt={alt} />
            }
            itemTwo={
              <ReactCompareSliderImage src={compareImage} alt={`${alt} comparison`} />
            }
            className="w-full h-full"
          />
        </div>
      ) : (
        <TransformWrapper
          ref={transformComponentRef}
          initialScale={1}
          minScale={0.1}
          maxScale={5}
          centerOnInit
          onTransformed={(_, { scale }) => setScale(scale)}
          onPanning={() => setIsPanning(true)}
          onPanningStop={() => setIsPanning(false)}
          wheel={{
            step: 0.1,
            smoothStep: 0.006,
          }}
          doubleClick={{
            disabled: false,
            step: 0.5,
          }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <TransformComponent
              wrapperStyle={{
                width: '100%',
                height: '100%',
                cursor: isPanning ? 'grabbing' : 'grab',
              }}
            >
              <div className="relative">
                <img
                  src={primaryImage}
                  alt={alt}
                  className="max-w-none"
                  draggable={false}
                />
                {renderGrid()}
              </div>
            </TransformComponent>
          )}
        </TransformWrapper>
      )}
    </div>
  );
};

export default ImageViewer;
