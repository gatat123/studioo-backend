# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

협업 시스템 (Collaboration Platform) - A real-time creative collaboration platform for illustration and storyboard projects with WebSocket support, image versioning, and annotation features.

**Tech Stack:**
- Backend: Next.js 14+ (App Router), TypeScript, Prisma ORM, PostgreSQL, Socket.io
- Frontend: Next.js 14+, React 18, TypeScript, Zustand, Tailwind CSS, shadcn/ui
- Deployment: Railway

**GitHub Repositories:**
- Backend: https://github.com/gatat123/studioo-backend
- Frontend: https://github.com/gatat123/Studioo

## Common Development Commands

### Backend (Port 3001)
```bash
cd backend

# Development server with Socket.io
npm run dev           # Start with tsx watch (includes Socket.io)

# Database operations
npx prisma generate   # Generate Prisma client
npx prisma migrate dev --name <migration_name>  # Create new migration
npx prisma migrate deploy  # Deploy migrations
npx prisma studio     # Open Prisma Studio GUI

# Build and production
npm run build         # Build Next.js app
npm run start         # Start production server

# Testing API endpoints
curl http://localhost:3001/api/socket  # Check Socket.io status
```

### Frontend (Port 3000)
```bash
cd frontend

# Development
npm run dev           # Start development server
npm run lint          # Run ESLint
npm run typecheck     # Run TypeScript type checking

# Build and production
npm run build         # Build for production
npm run start         # Start production server
```

## Architecture Overview

### Database Schema (PostgreSQL via Prisma)
The system uses a relational database with the following core entities:
- **Users**: Authentication and profile management
- **Studios**: User workspaces (1:1 with users)
- **Projects**: Collaborative projects with invite codes
- **Scenes**: Individual scenes within projects
- **Images**: Uploaded images with version history
- **Comments**: Threaded comments on projects/scenes
- **Annotations**: Drawing/text annotations on images
- **UserPresence**: Real-time presence tracking

### API Structure
Backend API endpoints follow RESTful conventions:
- `/api/auth/*` - Authentication (register, login, logout)
- `/api/projects/*` - Project CRUD and participant management
- `/api/scenes/*` - Scene management within projects
- `/api/images/*` - Image upload and version control
- `/api/comments/*` - Comment system
- `/api/annotations/*` - Image annotations
- `/api/admin/*` - Admin panel endpoints

### WebSocket Events (Socket.io)
Real-time features use Socket.io with the following event patterns:
- **Connection**: `auth`, `join:project`, `join:scene`
- **Presence**: `cursor:move`, `typing:start/stop`, `presence:update`
- **Collaboration**: `comment:create/update/delete`, `annotation:create/update`, `image:upload`
- **Broadcasts**: Server broadcasts changes to all room participants

### State Management
- **Frontend**: Zustand for global state management
- **Backend**: Prisma for database operations, in-memory cache for presence data
- **Real-time**: Socket.io rooms for project/scene-based broadcasting

## Key Development Patterns

### Hybrid API + WebSocket Pattern
Most operations follow this pattern:
1. API call for data persistence (database)
2. WebSocket emit for real-time broadcast
3. Optimistic UI updates with rollback on failure

### Image Handling
- Supports JPEG, PNG, WebP formats
- Version history maintained for all uploads
- Sharp library for image optimization
- Separate lineart/art image types per scene

### Authentication Flow
- JWT-based authentication with NextAuth.js
- Session management for API requests
- WebSocket authentication via handshake
- Role-based access control (owner, editor, viewer, member)

## Environment Variables Required
```env
DATABASE_URL=postgresql://...  # PostgreSQL connection string
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=...
JWT_SECRET=...
```

## Important Considerations

1. **Socket.io Integration**: The backend runs on port 3001 with integrated Socket.io server. Always use `npm run dev` (not `npm run dev:next`) to ensure Socket.io is initialized.

2. **Database Migrations**: Always generate Prisma client after schema changes and before running the application.

3. **Real-time Features**: WebSocket connections require proper room management. Users must join appropriate project/scene rooms for real-time updates.

4. **Image Storage**: Currently configured for local storage. Production deployment may require cloud storage integration (AWS S3).

5. **Admin Features**: Admin panel available for users with `isAdmin=true` flag in database.

## MCP (Model Context Protocol) Tools

When developing this project with Claude Code, the following MCP servers are recommended:

### Core Planning & Analysis
- **Sequential Thinking**: For systematic task analysis and planning (always use first for complex tasks)
- **Task Master AI**: For breaking down complex features and managing development workflows

### Essential MCP Servers
- **GitHub MCP**: For repository management, PR creation, and version control with the repositories above
- **PostgreSQL/Database MCP**: For direct database queries and schema management
- **Filesystem MCP**: For efficient file operations during development
- **Desktop Commander**: For system-level operations and process management

### Development Enhancement MCPs
- **ESLint MCP**: For JavaScript/TypeScript code quality and formatting
- **NPM MCP Server**: For package management and dependency updates
- **Context7**: For accessing latest framework documentation (Next.js, React, Prisma)
- **Lighthouse MCP**: For performance testing of the web application

### Collaboration MCPs
- **Brave Search**: For researching Socket.io patterns and real-time collaboration best practices
- **Screenshot MCP**: For capturing UI states during development
- **Claude-memory**: For preserving important project decisions and patterns across sessions

### Deployment MCPs
- **Railway MCP**: For deploying to Railway platform, managing environment variables, and monitoring services
- **Windows CLI**: For running deployment scripts and SSH operations