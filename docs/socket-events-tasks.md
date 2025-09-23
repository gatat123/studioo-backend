# Socket.io 실시간 이벤트 설계

## 1. 클라이언트 → 서버 이벤트

### Room 관리
```javascript
// 프로젝트 업무 룸 참가
socket.emit('join:project-tasks', { projectId });

// 프로젝트 업무 룸 나가기
socket.emit('leave:project-tasks', { projectId });

// 특정 업무 룸 참가 (상세 뷰)
socket.emit('join:task', { taskId });

// 특정 업무 룸 나가기
socket.emit('leave:task', { taskId });
```

### Task 실시간 작업
```javascript
// 업무 생성
socket.emit('task:create', {
  projectId,
  task: { title, description, priority, dueDate, assignees }
});

// 업무 업데이트
socket.emit('task:update', {
  taskId,
  updates: { title, description, status, priority }
});

// 업무 상태 변경
socket.emit('task:status-change', {
  taskId,
  oldStatus,
  newStatus,
  position
});

// 업무 위치 변경 (드래그앤드롭)
socket.emit('task:position-change', {
  taskId,
  sourceStatus,
  targetStatus,
  sourceIndex,
  targetIndex
});

// 업무 삭제
socket.emit('task:delete', { taskId });

// 담당자 할당
socket.emit('task:assign', {
  taskId,
  userId,
  role
});

// 담당자 제거
socket.emit('task:unassign', {
  taskId,
  userId
});
```

### Todo 실시간 작업
```javascript
// Todo 생성
socket.emit('todo:create', {
  projectId,
  todo: { title, description, dueDate }
});

// Todo 완료 토글
socket.emit('todo:toggle', {
  todoId,
  isCompleted
});

// Todo 업데이트
socket.emit('todo:update', {
  todoId,
  updates: { title, description, dueDate }
});

// Todo 삭제
socket.emit('todo:delete', { todoId });
```

### 실시간 협업 상태
```javascript
// 업무 편집 시작
socket.emit('task:editing-start', {
  taskId,
  field // 'title', 'description', etc.
});

// 업무 편집 종료
socket.emit('task:editing-end', {
  taskId,
  field
});

// 커서 위치 공유 (칸반보드)
socket.emit('cursor:move', {
  projectId,
  x,
  y
});

// 타이핑 상태
socket.emit('typing:start', {
  taskId,
  commentId
});

socket.emit('typing:stop', {
  taskId,
  commentId
});
```

## 2. 서버 → 클라이언트 이벤트

### Task 브로드캐스트
```javascript
// 새 업무 생성됨
socket.on('task:created', (data) => {
  // data: { task, createdBy }
});

// 업무 업데이트됨
socket.on('task:updated', (data) => {
  // data: { taskId, updates, updatedBy }
});

// 업무 상태 변경됨
socket.on('task:status-changed', (data) => {
  // data: { taskId, oldStatus, newStatus, changedBy }
});

// 업무 위치 변경됨
socket.on('task:position-changed', (data) => {
  // data: { taskId, sourceStatus, targetStatus, sourceIndex, targetIndex }
});

// 업무 삭제됨
socket.on('task:deleted', (data) => {
  // data: { taskId, deletedBy }
});

// 담당자 할당됨
socket.on('task:assigned', (data) => {
  // data: { taskId, userId, assignedBy, user }
});

// 담당자 제거됨
socket.on('task:unassigned', (data) => {
  // data: { taskId, userId, unassignedBy }
});
```

### Todo 브로드캐스트
```javascript
// Todo 생성됨
socket.on('todo:created', (data) => {
  // data: { todo, createdBy }
});

// Todo 완료 상태 변경
socket.on('todo:toggled', (data) => {
  // data: { todoId, isCompleted, toggledBy }
});

// Todo 업데이트됨
socket.on('todo:updated', (data) => {
  // data: { todoId, updates, updatedBy }
});

// Todo 삭제됨
socket.on('todo:deleted', (data) => {
  // data: { todoId, deletedBy }
});
```

### 실시간 협업 상태
```javascript
// 다른 사용자가 편집 중
socket.on('user:editing', (data) => {
  // data: { taskId, field, user }
});

// 다른 사용자가 편집 종료
socket.on('user:stopped-editing', (data) => {
  // data: { taskId, field, user }
});

// 다른 사용자의 커서 위치
socket.on('cursor:position', (data) => {
  // data: { userId, x, y, user }
});

// 다른 사용자가 타이핑 중
socket.on('user:typing', (data) => {
  // data: { taskId, commentId, user }
});

// 온라인 사용자 목록
socket.on('users:online', (data) => {
  // data: { users: [{ id, nickname, profileImageUrl, status }] }
});

// 사용자 접속
socket.on('user:joined', (data) => {
  // data: { user }
});

// 사용자 나감
socket.on('user:left', (data) => {
  // data: { userId }
});
```

### 알림 이벤트
```javascript
// 멘션 알림
socket.on('notification:mention', (data) => {
  // data: { mentionId, taskId, commentId, mentionedBy }
});

// 업무 할당 알림
socket.on('notification:task-assigned', (data) => {
  // data: { taskId, assignedBy }
});

// 마감일 임박 알림
socket.on('notification:due-soon', (data) => {
  // data: { taskId, dueDate }
});

// 업무 완료 알림
socket.on('notification:task-completed', (data) => {
  // data: { taskId, completedBy }
});
```

### 에러 처리
```javascript
// 에러 발생
socket.on('error', (data) => {
  // data: { message, code, details }
});

// 권한 없음
socket.on('unauthorized', (data) => {
  // data: { message, requiredRole }
});
```

## 3. Socket.io Middleware

```javascript
// 인증 미들웨어
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const user = await verifyToken(token);
    socket.userId = user.id;
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

// 프로젝트 권한 검증
const checkProjectAccess = async (socket, projectId) => {
  const isParticipant = await checkUserIsProjectParticipant(
    socket.userId,
    projectId
  );
  if (!isParticipant) {
    throw new Error('Access denied');
  }
};
```

## 4. 성능 최적화 전략

### Debouncing
- 커서 이동: 50ms 디바운싱
- 타이핑 상태: 300ms 디바운싱
- 자동 저장: 1000ms 디바운싱

### Room 관리
- 프로젝트별 룸: `project:{projectId}:tasks`
- 업무별 룸: `task:{taskId}`
- 사용자별 룸: `user:{userId}`

### 데이터 압축
- 큰 페이로드는 gzip 압축
- 이미지는 base64 대신 URL 전송
- 불필요한 데이터 필드 제거