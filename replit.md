# AdoraPOS - Restaurant Point of Sale System

## Overview
A full-stack restaurant POS (Point of Sale) application with staff management, order processing, menu management, and a customer-facing ordering portal.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite, TailwindCSS, Radix UI, shadcn/ui components
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon-backed on Replit) with Drizzle ORM
- **Routing**: wouter (client-side), Express (server-side)
- **State Management**: TanStack React Query
- **Authentication**: Passport.js with session-based auth (PostgreSQL session store)

## Project Structure
```
client/           - React frontend (Vite)
  src/
    components/   - UI components (shadcn/ui based)
    contexts/     - React contexts (Auth, etc.)
    hooks/        - Custom React hooks
    lib/          - Utility libraries
    pages/        - Page components
server/           - Express backend
  index.ts        - Server entry point
  routes.ts       - API routes
  storage.ts      - Database storage layer
  db.ts           - Database connection
  vite.ts         - Vite dev server integration
shared/           - Shared types and schemas
  schema.ts       - Drizzle schema definitions
migrations/       - Database migrations
```

## Running the App
- **Development**: `npm run dev` (serves both frontend and backend on port 5000)
- **Build**: `npm run build` (builds Vite frontend + esbuild server)
- **Production**: `npm run start` (serves built app)
- **Database Push**: `npm run db:push` (push schema changes)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured on Replit)
- `PORT` - Server port (defaults to 5000)
- `SESSION_SECRET` - Session encryption key
- `NODE_ENV` - development/production

## Recent Changes
- Fixed duplicate `Settings` identifier in `app-sidebar.tsx` (renamed schema import to `SettingsType`)
- Added `allowedHosts: true` to vite.config.ts for Replit proxy compatibility
