# Socket.io Troubleshooting Guide

## 문제 해결 완료 사항

### 1. IPv6/IPv4 연결 문제
- **문제**: localhost가 ::1 (IPv6)로 해석되어 ECONNREFUSED 에러 발생
- **해결**: 명시적으로 127.0.0.1 (IPv4) 사용

### 2. Railway 배포 환경에서 Socket.io 인스턴스 접근 불가
- **문제**: Next.js API 라우트가 별도 프로세스에서 실행되어 Socket.io 인스턴스에 접근 불가
- **해결**: 글로벌 인스턴스 관리 시스템 구현 (`global-socket.ts`)

### 3. HTTP Fallback 메커니즘
- **구현**: Socket.io 인스턴스를 직접 접근할 수 없을 때 HTTP API를 통한 이벤트 전송

## 주요 변경 사항

### 1. `lib/socket/global-socket.ts` (신규)
- 글로벌 Socket.io 인스턴스 관리
- Next.js API 라우트에서 접근 가능한 전역 변수 사용

### 2. `lib/socket/server.ts`
- 글로벌 인스턴스 등록 기능 추가
- `initializeSocketServer`: 서버 시작 시 글로벌 인스턴스 등록
- `getSocketInstance`: 글로벌 인스턴스 우선 확인

### 3. `lib/socket/emit-helper.ts`
- IPv4 명시적 사용 (127.0.0.1)
- 프로덕션/개발 환경별 URL 분기
- 글로벌 인스턴스 확인 추가

### 4. `app/api/socket/emit/route.ts`
- IPv4 명시적 사용
- 환경별 URL 설정 개선

### 5. `app/api/socket/status/route.ts` (신규)
- Socket.io 상태 확인 엔드포인트
- 디버깅 정보 제공
- 테스트 이벤트 발송 기능

### 6. `app/api/health/route.ts`
- 향상된 헬스 체크
- 데이터베이스 연결 및 지연시간 측정
- 메모리 사용량 모니터링

## Railway 배포 시 필요한 환경 변수

```env
# 필수 환경 변수
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-railway-domain.up.railway.app
NEXTAUTH_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret

# Socket.io 관련 (중요)
INTERNAL_API_URL=https://studioo-backend-production-eb03.up.railway.app
SOCKET_SERVER_URL=https://studioo-backend-production-eb03.up.railway.app
INTERNAL_API_KEY=your-secure-internal-key

# CORS
CORS_ORIGIN=https://studioo-production-eb03.up.railway.app

# 서버 설정
NODE_ENV=production
PORT=3001
HOSTNAME=0.0.0.0
```

## 디버깅 방법

### 1. Socket.io 상태 확인
```bash
# 개발 환경
curl http://localhost:3001/api/socket/status

# 프로덕션 환경
curl https://studioo-backend-production-eb03.up.railway.app/api/socket/status
```

### 2. 헬스 체크
```bash
# 개발 환경
curl http://localhost:3001/api/health

# 프로덕션 환경
curl https://studioo-backend-production-eb03.up.railway.app/api/health
```

### 3. Socket.io 테스트 이벤트 발송
```bash
# POST 요청으로 테스트 이벤트 발송
curl -X POST http://localhost:3001/api/socket/status \
  -H "Content-Type: application/json" \
  -d '{"testRoom": "test:room", "testEvent": "test:ping", "testData": {"message": "test"}}'
```

## 로그 확인 위치

### 개발 환경
- `[Socket Helper]`: emit-helper.ts의 이벤트 발송 로그
- `[Socket Emit API]`: API 라우트의 이벤트 처리 로그
- `[Global Socket]`: 글로벌 인스턴스 관리 로그
- `[Health Check]`: 헬스 체크 관련 로그

### Railway 배포 환경
- Railway 대시보드의 Logs 섹션에서 실시간 로그 확인
- 특히 다음 키워드로 필터링:
  - "Socket.io server initialized"
  - "Using HTTP fallback"
  - "Direct emit"
  - "Global instance"

## 일반적인 문제와 해결 방법

### 1. "Socket.io not available" 에러
- 글로벌 인스턴스가 등록되지 않음
- 서버 재시작 필요
- 환경 변수 확인

### 2. "ECONNREFUSED ::1:3001" 에러
- IPv6 연결 시도
- 이미 수정됨 (127.0.0.1 사용)

### 3. Railway에서 실시간 업데이트 안 됨
- CORS 설정 확인
- WebSocket 연결 확인
- 환경 변수 INTERNAL_API_URL 확인

## 성능 최적화 팁

1. **직접 emit 우선**: HTTP fallback보다 직접 emit이 훨씬 빠름
2. **글로벌 인스턴스 활용**: API 라우트에서도 가능한 직접 접근
3. **연결 풀링**: Socket.io 연결 재사용
4. **이벤트 배칭**: 여러 이벤트를 한 번에 전송

## 모니터링 권장사항

1. `/api/socket/status` 엔드포인트를 정기적으로 확인
2. 연결된 클라이언트 수 모니터링
3. HTTP fallback 사용 빈도 추적
4. 이벤트 발송 지연시간 측정

## 추가 개선 가능 사항

1. Redis를 사용한 Socket.io 어댑터 구현 (수평 확장)
2. 이벤트 큐잉 시스템 구현
3. 자동 재연결 로직 강화
4. 상세한 메트릭 수집 시스템