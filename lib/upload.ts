import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getUploadPath } from './storage';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Multer storage 설정
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // body에서 type 가져오기 (lineart or art)
      const type = (req.body.type as 'lineart' | 'art') || 'art';
      const dir = path.join(UPLOAD_DIR, 'images', type);
      
      // 디렉토리 확인
      const fs = await import('fs');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      cb(null, dir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  
  filename: (req, file, cb) => {
    // 고유한 파일명 생성
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    const filename = `${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// 파일 필터
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 허용된 파일 타입
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP만 가능)'));
  }
};

// Multer 설정
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 기본 10MB
    files: 5 // 최대 5개 파일 동시 업로드
  },
  fileFilter: fileFilter
});

// 단일 파일 업로드
export const uploadSingle = upload.single('image');

// 다중 파일 업로드
export const uploadMultiple = upload.array('images', 5);

// 필드별 업로드
export const uploadFields = upload.fields([
  { name: 'lineart', maxCount: 1 },
  { name: 'art', maxCount: 1 }
]);
