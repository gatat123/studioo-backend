# Task Management API 설계

## 1. Task API Endpoints

### Task CRUD
- `GET /api/projects/:projectId/tasks` - 프로젝트의 모든 업무 조회
  - Query params: status, priority, assigneeId, dueDate, tags
- `GET /api/tasks/:taskId` - 특정 업무 상세 조회
- `POST /api/projects/:projectId/tasks` - 새 업무 생성
- `PUT /api/tasks/:taskId` - 업무 수정
- `PATCH /api/tasks/:taskId/status` - 업무 상태 변경
- `PATCH /api/tasks/:taskId/position` - 업무 위치 변경 (드래그앤드롭)
- `DELETE /api/tasks/:taskId` - 업무 삭제

### Task Assignment
- `POST /api/tasks/:taskId/assign` - 담당자 할당
- `DELETE /api/tasks/:taskId/assign/:userId` - 담당자 제거
- `GET /api/tasks/:taskId/assignees` - 담당자 목록 조회

### Subtasks
- `GET /api/tasks/:taskId/subtasks` - 하위 업무 조회
- `POST /api/tasks/:taskId/subtasks` - 하위 업무 생성
- `PUT /api/tasks/:taskId/convert-to-subtask` - 일반 업무를 하위 업무로 변환

### Dependencies
- `GET /api/tasks/:taskId/dependencies` - 의존성 조회
- `POST /api/tasks/:taskId/dependencies` - 의존성 추가
- `DELETE /api/tasks/:taskId/dependencies/:dependencyId` - 의존성 제거

## 2. Todo API Endpoints

### Personal Todos
- `GET /api/projects/:projectId/todos` - 프로젝트의 모든 Todo 조회
- `GET /api/users/me/todos` - 내 Todo 목록 조회
- `POST /api/projects/:projectId/todos` - Todo 생성
- `PUT /api/todos/:todoId` - Todo 수정
- `PATCH /api/todos/:todoId/complete` - Todo 완료 처리
- `DELETE /api/todos/:todoId` - Todo 삭제

## 3. Comments & Activities

### Task Comments
- `GET /api/tasks/:taskId/comments` - 업무 댓글 조회
- `POST /api/tasks/:taskId/comments` - 댓글 작성
- `PUT /api/comments/:commentId` - 댓글 수정
- `DELETE /api/comments/:commentId` - 댓글 삭제

### Activity Log
- `GET /api/tasks/:taskId/activities` - 업무 활동 로그
- `GET /api/projects/:projectId/activities` - 프로젝트 활동 로그

## 4. Attachments & Time Tracking

### File Attachments
- `POST /api/tasks/:taskId/attachments` - 파일 첨부
- `DELETE /api/attachments/:attachmentId` - 첨부파일 삭제
- `GET /api/attachments/:attachmentId/download` - 파일 다운로드

### Time Entries
- `GET /api/tasks/:taskId/time-entries` - 시간 기록 조회
- `POST /api/tasks/:taskId/time-entries` - 시간 기록 추가
- `PUT /api/time-entries/:entryId` - 시간 기록 수정
- `DELETE /api/time-entries/:entryId` - 시간 기록 삭제

## 5. Watchers & Notifications

### Task Watchers
- `GET /api/tasks/:taskId/watchers` - 감시자 목록
- `POST /api/tasks/:taskId/watch` - 업무 감시 시작
- `DELETE /api/tasks/:taskId/unwatch` - 업무 감시 중지

### Mentions
- `GET /api/users/me/mentions` - 내가 멘션된 항목
- `PATCH /api/mentions/:mentionId/read` - 멘션 읽음 처리

## 6. Bulk Operations

### Batch Updates
- `PATCH /api/tasks/bulk/status` - 여러 업무 상태 일괄 변경
- `PATCH /api/tasks/bulk/assign` - 여러 업무 담당자 일괄 할당
- `DELETE /api/tasks/bulk` - 여러 업무 일괄 삭제

## 7. Analytics & Reports

### Task Statistics
- `GET /api/projects/:projectId/tasks/stats` - 업무 통계
- `GET /api/projects/:projectId/tasks/burndown` - 번다운 차트 데이터
- `GET /api/users/:userId/tasks/workload` - 사용자 업무 부하

## Request/Response 예시

### Task 생성 요청
```json
POST /api/projects/:projectId/tasks
{
  "title": "UI 디자인 리뷰",
  "description": "메인 페이지 UI 디자인 검토 및 피드백",
  "priority": "high",
  "status": "todo",
  "dueDate": "2024-12-25T00:00:00Z",
  "assignees": ["userId1", "userId2"],
  "tags": ["design", "ui"],
  "estimatedHours": 4
}
```

### Task 응답
```json
{
  "id": "task_123",
  "title": "UI 디자인 리뷰",
  "description": "메인 페이지 UI 디자인 검토 및 피드백",
  "priority": "high",
  "status": "todo",
  "dueDate": "2024-12-25T00:00:00Z",
  "startDate": null,
  "completedAt": null,
  "estimatedHours": 4,
  "actualHours": 0,
  "tags": ["design", "ui"],
  "position": 0,
  "createdBy": {
    "id": "user_123",
    "nickname": "김개발",
    "profileImageUrl": "..."
  },
  "assignees": [
    {
      "id": "user_456",
      "nickname": "이디자인",
      "profileImageUrl": "...",
      "role": "assignee"
    }
  ],
  "subtasks": [],
  "dependencies": [],
  "watchers": [],
  "commentsCount": 0,
  "attachmentsCount": 0,
  "createdAt": "2024-12-20T10:00:00Z",
  "updatedAt": "2024-12-20T10:00:00Z"
}
```