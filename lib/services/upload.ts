import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import sharp from 'sharp';

export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  filename?: string;
  fileSize?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  error?: string;
}

export interface UploadOptions {
  maxFileSize?: number; // bytes
  allowedTypes?: string[];
  resizeOptions?: {
    width?: number;
    height?: number;
    quality?: number;
  };
  generateThumbnail?: boolean;
}

/**
 * 기본 업로드 설정
 */
const DEFAULT_OPTIONS: UploadOptions = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  resizeOptions: {
    quality: 80
  },
  generateThumbnail: false
};

/**
 * 파일 업로드 서비스 클래스
 */
export class UploadService {
  private baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.join(process.cwd(), 'public', 'uploads');
  }

  /**
   * 업로드 디렉토리 생성
   */
  private async ensureUploadDir(subDir?: string): Promise<string> {
    const uploadDir = subDir 
      ? path.join(this.baseUploadDir, subDir)
      : this.baseUploadDir;

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    return uploadDir;
  }

  /**
   * 파일명 생성 (UUID + timestamp 기반)
   */
  private generateFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(originalName).toLowerCase();
    
    return `${timestamp}-${randomString}${extension}`;
  }

  /**
   * 파일 유효성 검사
   */
  private validateFile(
    file: File, 
    options: UploadOptions = DEFAULT_OPTIONS
  ): { valid: boolean; error?: string } {
    // 파일 크기 검사
    if (options.maxFileSize && file.size > options.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum limit of ${options.maxFileSize / (1024 * 1024)}MB`
      };
    }

    // 파일 타입 검사
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed. Allowed types: ${options.allowedTypes.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * 이미지 리사이즈 및 최적화
   */
  private async processImage(
    buffer: Buffer,
    options?: UploadOptions['resizeOptions']
  ): Promise<{ buffer: Buffer; dimensions: { width: number; height: number } }> {
    let sharpInstance = sharp(buffer);

    // 이미지 정보 가져오기
    const metadata = await sharpInstance.metadata();
    
    // 리사이즈 적용
    if (options?.width || options?.height) {
      sharpInstance = sharpInstance.resize({
        width: options.width,
        height: options.height,
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // 품질 설정
    if (options?.quality) {
      sharpInstance = sharpInstance.jpeg({ quality: options.quality });
    }

    const processedBuffer = await sharpInstance.toBuffer();
    const { width, height } = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      dimensions: {
        width: width || 0,
        height: height || 0
      }
    };
  }

  /**
   * 썸네일 생성
   */
  private async generateThumbnail(
    buffer: Buffer,
    filename: string,
    uploadDir: string
  ): Promise<string> {
    const thumbnailBuffer = await sharp(buffer)
      .resize(300, 300, {
        fit: 'cover',
        position: 'centre'
      })
      .jpeg({ quality: 70 })
      .toBuffer();

    const thumbnailFilename = `thumb_${filename}`;
    const thumbnailPath = path.join(uploadDir, thumbnailFilename);
    
    await writeFile(thumbnailPath, thumbnailBuffer);
    
    return thumbnailFilename;
  }

  /**
   * 프로필 이미지 업로드
   */
  async uploadProfileImage(
    request: NextRequest,
    userId: string
  ): Promise<UploadResult> {
    try {
      const formData = await request.formData();
      const file = formData.get('image') as File;

      if (!file) {
        return {
          success: false,
          error: 'No file provided'
        };
      }

      // 프로필 이미지 특별 설정
      const options: UploadOptions = {
        ...DEFAULT_OPTIONS,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        resizeOptions: {
          width: 500,
          height: 500,
          quality: 85
        },
        generateThumbnail: true
      };

      // 파일 유효성 검사
      const validation = this.validateFile(file, options);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // 업로드 디렉토리 생성
      const uploadDir = await this.ensureUploadDir(`profiles/${userId}`);

      // 파일 처리
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const filename = this.generateFilename(file.name);
      
      // 이미지 처리
      const { buffer: processedBuffer, dimensions } = await this.processImage(
        fileBuffer,
        options.resizeOptions
      );

      // 파일 저장
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, processedBuffer);

      // 썸네일 생성
      let thumbnailFilename;
      if (options.generateThumbnail) {
        thumbnailFilename = await this.generateThumbnail(
          processedBuffer,
          filename,
          uploadDir
        );
      }

      // URL 생성
      const fileUrl = `/uploads/profiles/${userId}/${filename}`;

      return {
        success: true,
        fileUrl,
        filename,
        fileSize: processedBuffer.length,
        dimensions
      };

    } catch (error) {
      console.error('Profile image upload error:', error);
      return {
        success: false,
        error: 'Failed to upload profile image'
      };
    }
  }

  /**
   * 프로젝트 이미지 업로드
   */
  async uploadProjectImage(
    request: NextRequest,
    projectId: string,
    sceneId: string,
    imageType: 'reference' | 'concept' | 'final'
  ): Promise<UploadResult> {
    try {
      const formData = await request.formData();
      const file = formData.get('image') as File;

      if (!file) {
        return {
          success: false,
          error: 'No file provided'
        };
      }

      // 프로젝트 이미지 설정
      const options: UploadOptions = {
        ...DEFAULT_OPTIONS,
        maxFileSize: 50 * 1024 * 1024, // 50MB for project images
        resizeOptions: {
          quality: 90 // 높은 품질 유지
        }
      };

      // 파일 유효성 검사
      const validation = this.validateFile(file, options);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // 업로드 디렉토리 생성
      const uploadDir = await this.ensureUploadDir(`projects/${projectId}/${sceneId}/${imageType}`);

      // 파일 처리
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const filename = this.generateFilename(file.name);
      
      // 이미지 처리 (원본 크기 유지, 품질 최적화만)
      const { buffer: processedBuffer, dimensions } = await this.processImage(
        fileBuffer,
        options.resizeOptions
      );

      // 파일 저장
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, processedBuffer);

      // URL 생성
      const fileUrl = `/uploads/projects/${projectId}/${sceneId}/${imageType}/${filename}`;

      return {
        success: true,
        fileUrl,
        filename,
        fileSize: processedBuffer.length,
        dimensions
      };

    } catch (error) {
      console.error('Project image upload error:', error);
      return {
        success: false,
        error: 'Failed to upload project image'
      };
    }
  }

  /**
   * 일반 파일 업로드
   */
  async uploadFile(
    request: NextRequest,
    subDir: string = 'general',
    options: UploadOptions = DEFAULT_OPTIONS
  ): Promise<UploadResult> {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return {
          success: false,
          error: 'No file provided'
        };
      }

      // 파일 유효성 검사
      const validation = this.validateFile(file, options);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // 업로드 디렉토리 생성
      const uploadDir = await this.ensureUploadDir(subDir);

      // 파일 처리
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const filename = this.generateFilename(file.name);

      let processedBuffer = fileBuffer;
      let dimensions;

      // 이미지 파일인 경우 처리
      if (file.type.startsWith('image/')) {
        const result = await this.processImage(fileBuffer, options.resizeOptions);
        processedBuffer = result.buffer;
        dimensions = result.dimensions;
      }

      // 파일 저장
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, processedBuffer);

      // URL 생성
      const fileUrl = `/uploads/${subDir}/${filename}`;

      return {
        success: true,
        fileUrl,
        filename,
        fileSize: processedBuffer.length,
        dimensions
      };

    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: 'Failed to upload file'
      };
    }
  }
}

/**
 * 업로드 서비스 인스턴스
 */
export const uploadService = new UploadService();