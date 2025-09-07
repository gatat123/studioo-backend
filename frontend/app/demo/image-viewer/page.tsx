'use client';

import React, { useState } from 'react';
import ImageViewer from '@/components/editor/ImageViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ImageViewerDemo = () => {
  const [showInfo, setShowInfo] = useState(true);
  
  // 데모용 이미지 URL (실제 프로젝트에서는 업로드된 이미지 URL 사용)
  const primaryImage = '/demo-image-1.svg';
  const compareImage = '/demo-image-2.svg';
  
  const imageInfo = {
    filename: 'scene_01_lineart.jpg',
    size: '2.4 MB',
    dimensions: '1920 x 1080',
    uploadedBy: 'John Doe',
    uploadedAt: '2024-01-01 10:30',
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Image Viewer Component Demo</h1>
      
      <div className="space-y-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Demo Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant={showInfo ? 'default' : 'outline'}
                onClick={() => setShowInfo(!showInfo)}
              >
                {showInfo ? 'Hide' : 'Show'} Image Info
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Image Viewer */}
        <Card>
          <CardHeader>
            <CardTitle>Image Viewer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[600px] bg-gray-100 rounded-lg overflow-hidden">
              <ImageViewer
                primaryImage={primaryImage}
                compareImage={compareImage}
                alt="Demo Image"
                showInfo={showInfo}
                imageInfo={imageInfo}
              />
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle>Keyboard Shortcuts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">+</span> - Zoom In
              </div>
              <div>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">-</span> - Zoom Out
              </div>
              <div>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">Ctrl+0</span> - Reset View
              </div>
              <div>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">Ctrl+F</span> - Fullscreen
              </div>
              <div>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">C</span> - Compare Mode
              </div>
              <div>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">G</span> - Toggle Grid
              </div>
              <div>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">Esc</span> - Exit Fullscreen
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2">
              <li>✅ Zoom and Pan with mouse wheel and drag</li>
              <li>✅ Touch gestures support for mobile devices</li>
              <li>✅ Keyboard shortcuts for all major actions</li>
              <li>✅ Compare mode with image slider</li>
              <li>✅ Fullscreen mode</li>
              <li>✅ Grid overlay for alignment</li>
              <li>✅ Preset zoom levels (100%, Fit)</li>
              <li>✅ Image information display</li>
              <li>✅ Smooth animations and transitions</li>
              <li>✅ Performance optimized for large images</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImageViewerDemo;
