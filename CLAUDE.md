# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TsFullStack is a TypeScript full-stack framework that enables rapid MVP development by allowing direct database operations from the frontend without writing backend API code. The project consists of multiple applications in a monorepo structure:

- **Backend** (`apps/backend/`) - Core API server with database and authentication
- **Website Frontend** (`apps/website-frontend/`) - Admin panel and user-facing web application  
- **Browser Extension** (`apps/InfoFlow/`) - Web extension for monitoring web page changes

## Architecture Overview

### Core Technologies
- **Backend**: TypeScript + Prisma + ZenStack + Effect + Fastify
- **Frontend**: TypeScript + Vue 3 + Tailwind CSS + PrimeVue
- **Browser Extension**: WXT + Vue 3 + Tailwind CSS + PrimeVue
- **Database**: SQLite (development) with Prisma ORM and ZenStack for access control
- **Build Tools**: tsup, Vite, pnpm workspace

### Key Architectural Patterns

1. **ZenStack Enhanced Prisma**: Database models with declarative access control and Row Level Security
2. **Effect-based Architecture**: Functional programming patterns for error handling and dependency management
3. **RPC System**: Custom remote procedure call system allowing frontend to directly call backend APIs with full TypeScript type safety
4. **Context-based Dependency Injection**: Services are injected through Effect Context for testability and modularity
5. **Job Queue System**: Prisma-based task queue with scheduling capabilities

### Development Workflow

#### Backend Development
```bash
# Navigate to backend directory
cd apps/backend

# Install dependencies
pnpm install

# Generate Prisma client from ZenStack schema
pnpm zenstack generate

# Run database migrations
pnpm prisma migrate dev

# Build library package for frontend consumption
pnpm build:lib

# Start development server with watch mode
pnpm dev
```

#### Frontend Development
```bash
# Navigate to frontend directory
cd apps/website-frontend

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

#### Browser Extension Development
```bash
# Navigate to extension directory
cd apps/InfoFlow

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build extension
pnpm build
```

### Database Schema Management

The project uses ZenStack (`schema.zmodel`) which enhances Prisma with:
- **Declarative Access Control**: `@@allow` and `@@deny` rules for row-level security
- **Abstract Models**: `BaseAuth`, `BaseTime`, `BaseId` for common fields and policies
- **Enhanced Types**: Better TypeScript types with access control constraints

**Important**: Always modify `schema.zmodel` instead of `prisma/schema.prisma` as the latter is auto-generated.

### Authentication System

The backend supports multiple authentication methods:
- **Email/Password**: Traditional authentication with bcrypt password hashing
- **GitHub OAuth**: Third-party authentication integration
- **Session-based**: Token-based session management with expiration

### RPC System

The custom RPC system enables type-safe API calls between frontend and backend:
- **SuperJSON Serialization**: Handles complex objects (Date, Map, Set, RegExp)
- **Full TypeScript Types**: Complete type safety from database to frontend
- **No Middleware Code**: Frontend can directly call backend API functions

### Key Backend Services

- **PrismaService**: Database access with ZenStack enhancements
- **AppConfigService**: Configuration management with c12
- **FileAccessService**: Secure file upload and storage handling
- **Auth**: Authentication and authorization logic
- **QueueScheduler**: Background job processing and scheduling

### Frontend Features

- **AutoTable Component**: Automatic CRUD table generation (similar to Prisma Studio)
- **Internationalization**: Vue i18n with dynamic language switching
- **Theme System**: Light/dark mode with Tailwind CSS integration
- **Admin Panel**: Database management interface with role-based access

### File Storage

Files are stored locally with metadata tracking in the database:
- **Storage Types**: LOCAL (default) and S3 support
- **File Status**: public, private, protected, deleted
- **Access Control**: User-based file ownership and permissions

### Development Notes

- **Type Safety**: The project emphasizes strict TypeScript typing - avoid using `any`
- **Database Migrations**: Always run `pnpm zenstack generate` after schema changes
- **Library Building**: Backend must be built as a library (`pnpm build:lib`) for frontend to import types
- **Memory Monitoring**: Backend includes memory usage logging for development
- **Configuration**: Uses c12 for configuration with environment variable support

### Common Commands

```bash
# Root level
pnpm install                    # Install all workspace dependencies
pnpm translate-md              # Translate Chinese README to English

# Backend
pnpm zenstack generate         # Generate Prisma client from schema
pnpm prisma migrate dev        # Run database migrations
pnpm build:lib                 # Build backend library package
pnpm dev                       # Start backend in development mode
pnpm tsc                       # Type check only

# Frontend
pnpm dev                       # Start frontend development server
pnpm build                     # Build for production
pnpm tsc                       # Type check Vue components

# Browser Extension
pnpm dev                       # Start extension development
pnpm build                     # Build extension
```

### Testing

Currently no formal test suite is implemented. The project focuses on type safety through TypeScript and manual testing through the development interface.