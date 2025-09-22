# Studio 협업 시스템 - Backend

일러스트레이터와 클라이언트 간의 원활한 커뮤니케이션을 위한 실시간 협업 플랫폼의 백엔드 서버입니다.

## 🚀 주요 기능

### API 엔드포인트
- **인증 시스템:** 회원가입, 로그인, 세션 관리
- **프로젝트 관리:** CRUD 작업, 초대 시스템
- **씬 관리:** 씬 생성, 이미지 업로드, 버전 관리
- **협업 기능:** 댓글, 주석, 실시간 업데이트

### 실시간 통신
- WebSocket을 통한 실시간 협업
- 프레젠스 관리 (온라인 상태, 커서 위치)
- 실시간 알림 시스템

### 데이터 관리
- PostgreSQL 데이터베이스
- Prisma ORM
- 이미지 스토리지 관리
- 버전 히스토리 추적

## 🛠 기술 스택

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Railway)
- **ORM:** Prisma
- **WebSocket:** Socket.io
- **Authentication:** NextAuth.js + JWT
- **Validation:** Zod
- **File Upload:** Multer + Sharp

## 📦 설치 방법

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 필요한 환경 변수 설정

# Prisma 설정
npx prisma generate
npx prisma migrate dev

# 개발 서버 실행
npm run dev
```

## 🗄️ 데이터베이스 스키마

주요 테이블:
- `users` - 사용자 정보
- `studios` - 스튜디오 정보
- `projects` - 프로젝트 정보
- `scenes` - 씬 정보
- `images` - 업로드된 이미지
- `image_history` - 이미지 버전 히스토리
- `comments` - 댓글
- `annotations` - 주석
- `project_participants` - 프로젝트 참여자

## 📝 환경 변수

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Auth
NEXTAUTH_URL=https://your-app.railway.app
NEXTAUTH_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret

# Storage
STORAGE_TYPE=local
UPLOAD_DIR=/app/uploads

# WebSocket
SOCKET_PORT=3001
SOCKET_PATH=/socket.io

# Admin
ADMIN_EMAIL=admin@example.com
```

## 🚀 배포

Production 환경은 Railway를 통해 배포됩니다.

## 📄 라이선스

이 프로젝트는 개인 프로젝트입니다.

## 🤝 기여

문의사항이나 버그 리포트는 Issues 탭을 이용해 주세요.
