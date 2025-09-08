'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Image, X, FileImage, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { imageDB, ImageData } from '@/lib/indexedDB';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface ImageUploaderProps {
  sceneId: string;
  onUploadComplete?: (image: ImageData) => void;
  className?: string;
}

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_DIMENSION = 4096; // Max width or height
interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function ImageUploader({ 
  sceneId, 
  onUploadComplete, 
  className 
}: ImageUploaderProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  });
  
  const [preview, setPreview] = useState<{
    lineart: string | null;
    art: string | null;
  }>({
    lineart: null,
    art: null,
  });

  const [dragActive, setDragActive] = useState<{
    lineart: boolean;
    art: boolean;
  }>({
    lineart: false,
    art: false,
  });

  const lineartInputRef = useRef<HTMLInputElement>(null);
  const artInputRef = useRef<HTMLInputElement>(null);
  // 파일 검증 함수
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return `파일 형식이 올바르지 않습니다. (JPEG, PNG, WebP만 가능)`;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `파일 크기가 너무 큽니다. (최대 10MB)`;
    }
    
    return null;
  };

  // 이미지 치수 확인 함수
  const validateImageDimensions = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new (globalThis as any).Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        const isValid = img.width <= MAX_IMAGE_DIMENSION && 
                       img.height <= MAX_IMAGE_DIMENSION;
        if (!isValid) {
          toast.error(`이미지 크기는 ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}px 이하여야 합니다.`);
        }
        resolve(isValid);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      
      img.src = url;
    });
  };
  // 이미지 업로드 처리 함수
  const handleUpload = async (file: File, type: 'lineart' | 'art') => {
    // 파일 검증
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    // 치수 검증
    const isValidDimensions = await validateImageDimensions(file);
    if (!isValidDimensions) {
      return;
    }

    setUploadState({ isUploading: true, progress: 0, error: null });

    try {
      // 이미지 치수 가져오기
      const img = new (globalThis as any).Image();
      const url = URL.createObjectURL(file);
      
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = url;
      });

      const dimensions = {
        width: img.width,
        height: img.height,
      };
      URL.revokeObjectURL(url);

      // 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setUploadState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }));
      }, 100);
      // IndexedDB에 저장
      const imageData: ImageData = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        sceneId,
        type,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        data: file,
        uploadedAt: new Date(),
        dimensions,
      };

      await imageDB.saveImage(imageData);
      clearInterval(progressInterval);
      
      // 완료 상태
      setUploadState({ isUploading: false, progress: 100, error: null });
      
      // 미리보기 설정
      const previewUrl = URL.createObjectURL(file);
      setPreview((prev) => ({
        ...prev,
        [type]: previewUrl,
      }));

      toast.success(`${type === 'lineart' ? '선화' : '아트'} 업로드 완료!`);
      
      if (onUploadComplete) {
        onUploadComplete(imageData);
      }

      // 진행률 리셋
      setTimeout(() => {
        setUploadState({ isUploading: false, progress: 0, error: null });
      }, 1000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadState({
        isUploading: false,
        progress: 0,
        error: '업로드 중 오류가 발생했습니다.',
      });
      toast.error('업로드에 실패했습니다.');
    }
  };
  // 드래그 앤 드롭 핸들러
  const handleDrag = useCallback((e: React.DragEvent, type: 'lineart' | 'art') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive((prev) => ({ ...prev, [type]: true }));
    } else if (e.type === 'dragleave') {
      setDragActive((prev) => ({ ...prev, [type]: false }));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, type: 'lineart' | 'art') => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive((prev) => ({ ...prev, [type]: false }));

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0], type);
    }
  }, [sceneId]);

  // 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'lineart' | 'art') => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0], type);
    }
  };

  // 미리보기 제거
  const removePreview = (type: 'lineart' | 'art') => {
    setPreview((prev) => ({
      ...prev,
      [type]: null,
    }));
  };
  const renderUploadZone = (type: 'lineart' | 'art') => {
    const isLineart = type === 'lineart';
    const inputRef = isLineart ? lineartInputRef : artInputRef;
    const isDragActive = isLineart ? dragActive.lineart : dragActive.art;
    const previewUrl = isLineart ? preview.lineart : preview.art;

    return (
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            {isLineart ? '선화 (Line Art)' : '채색 (Colored Art)'}
          </CardTitle>
          <CardDescription>
            JPEG, PNG, WebP 형식 (최대 10MB)
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div
            className={cn(
              "relative border-2 border-dashed rounded-lg transition-all duration-200",
              "min-h-[200px] flex items-center justify-center",
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50",
              previewUrl && "border-solid border-primary"
            )}
            onDragEnter={(e) => handleDrag(e, type)}
            onDragLeave={(e) => handleDrag(e, type)}
            onDragOver={(e) => handleDrag(e, type)}
            onDrop={(e) => handleDrop(e, type)}
          >            {previewUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={previewUrl}
                  alt={`${type} preview`}
                  className="w-full h-full object-contain max-h-[300px]"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removePreview(type)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="absolute bottom-2 left-2 bg-black/75 text-white px-2 py-1 rounded text-sm">
                  <Check className="inline h-3 w-3 mr-1" />
                  업로드 완료
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  이미지를 드래그하여 놓거나
                </p>
                <Button
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploadState.isUploading}
                >
                  파일 선택
                </Button>
              </div>
            )}            
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_FILE_TYPES.join(',')}
              onChange={(e) => handleFileChange(e, type)}
              disabled={uploadState.isUploading}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 에러 메시지 */}
      {uploadState.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>업로드 오류</AlertTitle>
          <AlertDescription>{uploadState.error}</AlertDescription>
        </Alert>
      )}

      {/* 업로드 진행률 */}
      {uploadState.isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>업로드 중...</span>
                <span>{uploadState.progress}%</span>
              </div>
              <Progress value={uploadState.progress} />
            </div>
          </CardContent>
        </Card>
      )}
      {/* 업로드 영역 */}
      <div className="grid md:grid-cols-2 gap-4">
        {renderUploadZone('lineart')}
        {renderUploadZone('art')}
      </div>

      {/* 도움말 */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• 지원 형식: JPEG, PNG, WebP</p>
            <p>• 최대 파일 크기: 10MB</p>
            <p>• 최대 이미지 크기: 4096x4096px</p>
            <p>• 드래그 앤 드롭 또는 클릭하여 업로드</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ImageUploader;