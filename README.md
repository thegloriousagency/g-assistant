# Glorious SaaS MVP

## Stack
- Frontend: Next.js (App Router), React, Tailwind CSS, ShadCN UI, TanStack Query
- Backend: NestJS, Prisma, Passport JWT
- Database: Supabase (PostgreSQL)

## Getting Started
1. Install dependencies:
   - `cd backend && npm install`
   - `cd frontend && npm install`
2. Environment variables:
   - Copy `backend/.env.example` to `backend/.env`.
   - Copy `frontend/.env.local.example` to `frontend/.env.local`.
   - TODO: Create the Supabase project, then set `DATABASE_URL` in `backend/.env`.
   - TODO: Set `JWT_SECRET` and `JWT_EXPIRES_IN` in `backend/.env`.
3. Prisma (after DATABASE_URL is configured):
   - `cd backend && npx prisma migrate dev`
4. Run the apps:
   - Backend: `npm run dev:backend` (port 3001 by default)
   - Frontend: `npm run dev:frontend` (port 3000 by default)

## Notes
- Backend exposes `/auth/login` with placeholder logic; hook this up once Supabase data + password hashing are ready.
- Frontend login form currently mocks the submission. Wire it to `NEXT_PUBLIC_API_URL + /auth/login` and store the JWT when backend auth is finalized.
