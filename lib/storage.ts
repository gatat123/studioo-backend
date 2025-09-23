import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// 필요한 디렉토리 구조
const directories = [
  UPLOAD_DIR,
  path.join(UPLOAD_DIR, 'images'),
  path.join(UPLOAD_DIR, 'images', 'lineart'),
  path.join(UPLOAD_DIR, 'images', 'art'),
  path.join(UPLOAD_DIR, 'temp'),
  path.join(UPLOAD_DIR, 'thumbnails')
];

// 앱 시작 시 디렉토리 생성
export function initializeStorage() {
  console.log('Initializing storage directories...');
  
  directories.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } else {
        console.log(`✓ Directory exists: ${dir}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error);
    }
  });
  
  // 권한 확인
  try {
    const testFile = path.join(UPLOAD_DIR, 'test.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ Storage directory is writable');
  } catch (error) {
    console.error('❌ Storage directory is not writable:', error);
  }
}

// 파일 경로 생성 헬퍼
export function getUploadPath(type: 'lineart' | 'art', filename: string) {
  return path.join(UPLOAD_DIR, 'images', type, filename);
}

export function getThumbnailPath(filename: string) {
  return path.join(UPLOAD_DIR, 'thumbnails', filename);
}

export function getTempPath(filename: string) {
  return path.join(UPLOAD_DIR, 'temp', filename);
}
