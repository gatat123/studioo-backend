'use client';

import React from 'react';
import ImageUploader from '@/components/editor/ImageUploader';
import { Toaster } from 'sonner';

export default function ImageUploadTestPage() {
  const handleUploadComplete = (image: any) => {
    console.log('Image uploaded:', image);
  };

  return (
    <div className="container mx-auto py-8">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">이미지 업로더 테스트</h1>
          <p className="text-muted-foreground">
            Scene ID: test-scene-001
          </p>
        </div>

        <ImageUploader 
          sceneId="test-scene-001"
          onUploadComplete={handleUploadComplete}
        />
      </div>
    </div>
  );
}