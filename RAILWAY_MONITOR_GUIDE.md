# Railway Deployment Monitor Guide

## 개요

Railway 배포 에러를 자동으로 감지하고 수정하는 모니터링 도구입니다. 일반적인 배포 에러를 자동으로 분석하고, 가능한 경우 자동으로 수정한 후 GitHub에 푸시합니다.

## 설치 및 준비

### 1. Railway CLI 설치 확인
```bash
railway --version
# 설치되어 있지 않다면:
# npm install -g @railway/cli
```

### 2. Railway 로그인
```bash
railway login
```

### 3. 프로젝트 연결
```bash
cd backend
railway link
# "Studio" 프로젝트 선택

cd ../frontend  
railway link
# "Studio" 프로젝트 선택
```

## 사용 방법

### Node.js 버전 (크로스 플랫폼)

#### 단일 체크 (한 번만 확인)
```bash
# 백엔드 체크
node railway-monitor.js backend

# 프론트엔드 체크
node railway-monitor.js frontend
```

#### 지속적 모니터링 (30초마다 체크)
```bash
# 백엔드 모니터링
node railway-monitor.js backend --watch

# 프론트엔드 모니터링
node railway-monitor.js frontend --watch
```

### PowerShell 버전 (Windows)

#### 단일 체크
```powershell
# 백엔드 체크
.\railway-monitor.ps1 -ServiceName backend

# 프론트엔드 체크
.\railway-monitor.ps1 -ServiceName frontend
```

#### 지속적 모니터링
```powershell
# 백엔드 모니터링
.\railway-monitor.ps1 -ServiceName backend -Watch

# 프론트엔드 모니터링
.\railway-monitor.ps1 -ServiceName frontend -Watch
```

## 자동으로 수정 가능한 에러들

### 1. Missing Module Errors
- **에러**: `Cannot find module 'xxx'`
- **자동 수정**: `npm install xxx` 실행 후 package.json 업데이트

### 2. Prisma Errors
- **Prisma Client 미생성**: 
  - railway.json의 buildCommand에 `npx prisma generate` 추가
- **마이그레이션 미적용**:
  - startCommand에 `npx prisma migrate deploy` 추가
- **데이터베이스 연결 실패**:
  - DATABASE_URL 환경변수 확인 알림

### 3. TypeScript Errors
- **컴파일 에러**: 
  - tsconfig.json의 `skipLibCheck: true` 설정
  - `strict: false` 설정

### 4. Memory Errors
- **JavaScript heap out of memory**:
  - package.json의 build 스크립트에 메모리 옵션 추가
  - `NODE_OPTIONS='--max-old-space-size=2048'`

### 5. Missing Files
- **ENOENT 에러**:
  - 누락된 파일 자동 생성

### 6. Next.js Build Errors
- **.next 폴더 관련**:
  - 빌드 명령 재실행

## 모니터링 워크플로우

1. **에러 감지**
   - Railway 로그에서 error/failed 키워드 검색
   
2. **에러 분석**
   - 에러 메시지 패턴 매칭
   - 수정 가능한 에러 타입 식별
   
3. **자동 수정**
   - 로컬 파일 수정 (package.json, railway.json, tsconfig.json 등)
   - 필요한 패키지 설치
   
4. **GitHub 푸시**
   - 변경사항 자동 커밋
   - 의미있는 커밋 메시지 생성
   - origin/main에 푸시
   
5. **Railway 재배포**
   - GitHub 변경 감지 시 Railway가 자동으로 재배포
   
6. **결과 확인**
   - 재배포 로그 모니터링
   - 성공/실패 상태 확인

## 실제 사용 예시

### 시나리오 1: Prisma Client 에러
```bash
# 에러 발생: Prisma Client가 생성되지 않음
node railway-monitor.js backend

# 자동 수정:
# 1. railway.json의 buildCommand 업데이트
# 2. package.json에 postinstall 스크립트 추가
# 3. GitHub에 푸시
# 4. Railway 자동 재배포
```

### 시나리오 2: 지속적 모니터링
```bash
# 백그라운드에서 계속 모니터링
node railway-monitor.js backend --watch

# 출력 예시:
# [10:30:00] Checking deployment...
# Deployment errors detected!
# Found 2 potential fixes:
#   • Generate Prisma Client
#   • Install missing module: @types/node
# Applying fixes...
# Fixes pushed to GitHub!
# Railway will automatically redeploy...
# 
# [10:30:30] Checking deployment...
# Deployment is healthy ✓
```

## 수동 개입이 필요한 경우

다음과 같은 경우는 자동 수정이 불가능하며 수동 개입이 필요합니다:

1. **환경변수 설정 필요**
   - Railway 대시보드에서 직접 설정
   
2. **복잡한 TypeScript 에러**
   - 코드 로직 수정 필요
   
3. **데이터베이스 스키마 충돌**
   - 수동으로 마이그레이션 해결
   
4. **빌드 타임아웃**
   - Railway 플랜 업그레이드 필요할 수 있음

## 문제 해결

### Railway CLI 연결 실패
```bash
# 재로그인
railway logout
railway login

# 프로젝트 재연결
railway unlink
railway link
```

### Git 권한 에러
```bash
# SSH 키 확인
ssh -T git@github.com

# HTTPS 사용 시 credentials 재설정
git config --global credential.helper manager
```

### 모니터 스크립트 권한 에러 (Linux/Mac)
```bash
chmod +x railway-monitor.js
```

## 주의사항

1. **자동 커밋**: 스크립트가 자동으로 커밋하고 푸시하므로, 중요한 변경사항은 미리 커밋하세요.

2. **환경변수**: DATABASE_URL, JWT_SECRET 등은 Railway 대시보드에서 직접 설정해야 합니다.

3. **빌드 시간**: 수정 후 재배포까지 몇 분이 소요될 수 있습니다.

4. **로그 확인**: 자동 수정이 실패한 경우 Railway 대시보드에서 전체 로그를 확인하세요.

## 추가 명령어

### Railway 상태 확인
```bash
cd backend
railway status
railway logs --tail 50
```

### 수동 배포
```bash
cd backend
railway up
```

### 환경변수 확인
```bash
railway variables
```