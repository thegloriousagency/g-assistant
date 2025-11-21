# Backend (NestJS + Prisma)

## Tech
- NestJS 11
- Prisma ORM targeting Supabase (PostgreSQL)

## Setup
1. Copy `.env.example` to `.env`.
2. TODO: Create Supabase project and obtain the `DATABASE_URL` connection string.
3. TODO: Set `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, and `FRONTEND_URL` inside `backend/.env`.
4. Install dependencies: `npm install`.
5. Run Prisma migrations (after Supabase is ready): `npx prisma migrate dev`.
6. Seed the default admin (email: `admin@local.test`, password: `Admin123!` unless overridden with `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`): `npm run seed:admin`.
7. Start the API: `npm run start:dev` (listens on `PORT`, defaults to 3001).

## Structure
- `src/prisma`: shared Prisma module/service.
- `src/auth`: Auth module with DTOs, guards (JWT + admin), strategies, controllers.
- `src/users`: Users module/services/controllers for user management.
- `src/tenants`: Tenant CRUD + tenant-facing endpoints.
- `src/scripts`: One-off scripts such as the admin seed.
