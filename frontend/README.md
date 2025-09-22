# Studio 협업 시스템 - Frontend

일러스트레이터와 클라이언트 간의 원활한 커뮤니케이션을 위한 실시간 협업 플랫폼입니다.

## 🎨 주요 기능

### 프로젝트 관리
- 일러스트/스토리보드 프로젝트 생성 및 관리
- 초대 코드를 통한 프로젝트 참여
- 프로젝트별 마감일 설정 및 관리
- 실시간 진행 상황 추적

### 씬 관리
- 다중 씬 생성 및 관리
- 선화/아트 구분 업로드
- 버전 히스토리 관리
- 이미지 비교 모드

### 실시간 협업 기능
- 실시간 댓글 시스템
- 이미지 주석 도구
- 수정 요청 표시
- 실시간 알림 시스템

### 사용자 관리
- 프로필 관리
- 스튜디오 대시보드
- 프로젝트 참여자 권한 관리

## 🛠 기술 스택

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **State Management:** Zustand
- **Styling:** Tailwind CSS + shadcn/ui
- **Real-time:** Socket.io-client
- **Forms:** React Hook Form + Zod
- **Image Handling:** react-zoom-pan-pinch

## 📦 설치 방법

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 필요한 환경 변수 설정

# 개발 서버 실행
npm run dev
```

## 🚀 배포

Production 환경은 Railway를 통해 배포됩니다.

## 📝 환경 변수

```env
NEXT_PUBLIC_API_URL=백엔드 API URL
NEXT_PUBLIC_SOCKET_URL=WebSocket 서버 URL
```

## 📄 라이선스

이 프로젝트는 개인 프로젝트입니다.

## 🤝 기여

문의사항이나 버그 리포트는 Issues 탭을 이용해 주세요.
