# Studio Backend Development Master Plan

## 🎯 Project Overview
- **Total Duration**: 8-10 days
- **Daily Work Hours**: 8 hours
- **Backend Location**: C:\Users\a0109\studio\backend
- **Deployment Target**: Railway

## 📊 Current Status
✅ **Completed**:
- Next.js project setup
- TypeScript configuration
- Prisma schema (11 tables)
- Basic authentication API
- Project list/create APIs
- Database connection setup

🔄 **In Progress**:
- Remaining API endpoints
- WebSocket implementation
- Testing & deployment

---

## Phase 1: Core API Development (3 days)

### Day 1: Authentication & User Management (8 hours)
**Priority: CRITICAL**

- [ ] **Task 1.1**: Complete NextAuth.js configuration (2h)
  - Setup JWT strategy
  - Configure session callbacks
  - Add role-based access control
  - File: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Task 1.2**: User profile APIs (2h)
  - GET /api/users/profile
  - PUT /api/users/profile
  - POST /api/users/profile/image
  - Files: `app/api/users/profile/route.ts`

- [ ] **Task 1.3**: Studio management APIs (2h)
  - GET /api/studios
  - GET /api/studios/[id]
  - PUT /api/studios/[id]
  - Files: `app/api/studios/route.ts`

- [ ] **Task 1.4**: Authentication middleware enhancement (2h)
  - Add JWT verification
  - Implement role checking
  - Error handling
  - File: `lib/middleware/auth.ts`

### Day 2: Project & Collaboration APIs (8 hours)
**Priority: HIGH**

- [ ] **Task 2.1**: Complete project management APIs (3h)
  - PUT /api/projects/[id]
  - DELETE /api/projects/[id]
  - POST /api/projects/[id]/invite
  - POST /api/projects/join
  - Files: `app/api/projects/[id]/route.ts`

- [ ] **Task 2.2**: Project participants APIs (2h)
  - GET /api/projects/[id]/participants
  - DELETE /api/projects/[id]/participants/[userId]
  - Files: `app/api/projects/[id]/participants/route.ts`

- [ ] **Task 2.3**: Notification system setup (3h)
  - Create notification service
  - Database triggers for notifications
  - GET /api/notifications
  - Files: `lib/services/notification.ts`

### Day 3: Scene & Image Management (8 hours)
**Priority: HIGH**

- [ ] **Task 3.1**: Scene management APIs (3h)
  - GET /api/projects/[projectId]/scenes
  - POST /api/projects/[projectId]/scenes
  - GET/PUT/DELETE /api/projects/[projectId]/scenes/[id]
  - Files: `app/api/projects/[projectId]/scenes/route.ts`

- [ ] **Task 3.2**: Image upload system (3h)
  - Setup multer for file uploads
  - Implement Sharp for image optimization
  - POST /api/scenes/[sceneId]/images
  - Files: `lib/services/upload.ts`

- [ ] **Task 3.3**: Image history & versioning (2h)
  - GET /api/scenes/[sceneId]/images/[id]/history
  - POST /api/scenes/[sceneId]/images/[id]/restore
  - Files: `lib/services/imageHistory.ts`

---

## Phase 2: Collaboration Features (2 days)

### Day 4: Comments & Annotations (8 hours)
**Priority: HIGH**

- [ ] **Task 4.1**: Comment system APIs (3h)
  - GET/POST /api/projects/[projectId]/comments
  - GET/POST /api/scenes/[sceneId]/comments
  - PUT/DELETE /api/comments/[id]
  - Files: `app/api/comments/route.ts`

- [ ] **Task 4.2**: Annotation system APIs (3h)
  - GET/POST /api/images/[imageId]/annotations
  - PUT/DELETE /api/annotations/[id]
  - Files: `app/api/annotations/route.ts`

- [ ] **Task 4.3**: Collaboration logs setup (2h)
  - Create logging service
  - Activity tracking implementation
  - Files: `lib/services/collaboration.ts`

### Day 5: Admin System (8 hours)
**Priority: MEDIUM**

- [ ] **Task 5.1**: Admin authentication (2h)
  - Admin role verification
  - Admin middleware
  - Files: `lib/middleware/admin.ts`

- [ ] **Task 5.2**: Admin management APIs (4h)
  - GET /api/admin/users
  - GET /api/admin/projects
  - DELETE /api/admin/projects/[id]
  - GET /api/admin/stats
  - Files: `app/api/admin/route.ts`

- [ ] **Task 5.3**: System monitoring setup (2h)
  - Create metrics collection
  - Storage usage tracking
  - Files: `lib/services/monitoring.ts`

---

## Phase 3: WebSocket Implementation (2 days)

### Day 6: Socket.io Setup & Core Events (8 hours)
**Priority: CRITICAL**

- [ ] **Task 6.1**: Socket.io server initialization (2h)
  - Setup Socket.io with Next.js
  - Configure CORS and namespaces
  - Files: `lib/socket/server.ts`

- [ ] **Task 6.2**: Authentication & connection management (2h)
  - JWT verification for sockets
  - User presence tracking
  - Files: `lib/socket/auth.ts`

- [ ] **Task 6.3**: Room management (2h)
  - Project room joining/leaving
  - Scene room management
  - Files: `lib/socket/rooms.ts`

- [ ] **Task 6.4**: Presence system (2h)
  - Cursor tracking
  - Typing indicators
  - Online status
  - Files: `lib/socket/presence.ts`

### Day 7: Real-time Collaboration Events (8 hours)
**Priority: HIGH**

- [ ] **Task 7.1**: Comment real-time events (2h)
  - comment:create/update/delete
  - Broadcasting to rooms
  - Files: `lib/socket/events/comments.ts`

- [ ] **Task 7.2**: Annotation real-time events (2h)
  - annotation:create/update/delete
  - Drawing data sync
  - Files: `lib/socket/events/annotations.ts`

- [ ] **Task 7.3**: Image upload events (2h)
  - Upload progress tracking
  - image:uploaded broadcasting
  - Files: `lib/socket/events/images.ts`

- [ ] **Task 7.4**: Scene update events (2h)
  - scene:update broadcasting
  - Conflict resolution
  - Files: `lib/socket/events/scenes.ts`

---

## Phase 4: Testing & Integration (1 day)

### Day 8: Testing & Optimization (8 hours)
**Priority: HIGH**

- [ ] **Task 8.1**: API endpoint testing (3h)
  - Unit tests for services
  - Integration tests for APIs
  - Files: `__tests__/api/`

- [ ] **Task 8.2**: WebSocket testing (2h)
  - Socket event testing
  - Connection handling tests
  - Files: `__tests__/socket/`

- [ ] **Task 8.3**: Performance optimization (2h)
  - Database query optimization
  - Caching implementation
  - Files: `lib/cache/`

- [ ] **Task 8.4**: Error handling & logging (1h)
  - Global error handlers
  - Winston logger setup
  - Files: `lib/logger/`

---

## Phase 5: Railway Deployment (1 day)

### Day 9: Deployment Setup (8 hours)
**Priority: CRITICAL**

- [ ] **Task 9.1**: Environment configuration (2h)
  - Setup production env vars
  - Configure DATABASE_URL
  - Setup secrets
  - Files: `.env.production`

- [ ] **Task 9.2**: Database migration (2h)
  - Run Prisma migrations
  - Seed initial data
  - Verify schema
  - Commands: `npx prisma migrate deploy`

- [ ] **Task 9.3**: Railway configuration (2h)
  - Install Railway MCP server
  - Configure build settings
  - Setup health checks
  - Files: `railway.json`

- [ ] **Task 9.4**: Deploy & verify (2h)
  - Push to Railway
  - Test production endpoints
  - Monitor logs
  - Setup monitoring

---

## 📈 Risk Management

### High Risk Areas:
1. **WebSocket + Next.js Integration**: Complex setup, may need custom server
2. **Image Upload**: Large file handling, storage management
3. **Real-time Conflict Resolution**: Concurrent editing scenarios

### Mitigation Strategies:
- Use Socket.io adapter for scaling
- Implement optimistic UI updates
- Add retry mechanisms for failed operations
- Use database transactions for critical operations

---

## 🔄 Parallel Work Opportunities

**Can be done simultaneously:**
- Day 2 & 3: Different developers can work on Project APIs vs Scene APIs
- Day 4: Comments and Annotations can be developed in parallel
- Day 6 & 7: Socket setup and event handlers can be split

---

## 📝 Daily Checklist

**End of each day:**
- [ ] Commit all changes to Git
- [ ] Update progress in task tracker
- [ ] Test completed endpoints
- [ ] Document any blockers
- [ ] Plan next day's priorities

---

## 🚀 Success Metrics

- All 40+ API endpoints functional
- WebSocket events working with <100ms latency
- Zero critical security vulnerabilities
- Successfully deployed to Railway
- All tests passing (>80% coverage)

---

## 📅 Buffer Time

**Day 10 (Optional)**: Buffer for unexpected issues
- Bug fixes
- Performance tuning
- Documentation updates
- Final deployment adjustments

---

## Next Steps

1. Start with Phase 1, Day 1 tasks
2. Use provided file paths for consistency
3. Test each API endpoint as completed
4. Commit frequently to track progress
5. Update this plan with actual completion times