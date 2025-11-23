# Backend (NestJS + Prisma)

## Tech
- NestJS 11
- Prisma ORM targeting Supabase (PostgreSQL)

## Setup
1. Copy `.env.example` to `.env`.
2. TODO: Create Supabase project and obtain the `DATABASE_URL` connection string.
3. TODO: Set `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `FRONTEND_URL`, and `GOOGLE_APPLICATION_CREDENTIALS` inside `backend/.env`. Point `GOOGLE_APPLICATION_CREDENTIALS` to your local GA4 service-account JSON (for example, `keys/ga4-service-account.json`).
4. Place the Google Cloud service-account key file inside `backend/keys/` (this folder is gitignored so secrets never enter the repo).
5. Install dependencies: `npm install`.
6. Run Prisma migrations (after Supabase is ready): `npx prisma migrate dev`.
7. Seed the default admin (email: `max@theglorious.agency`, password: `Admin123!` unless overridden with `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`): `npm run seed:admin`.
8. Start the API: `npm run start:dev` (listens on `PORT`, defaults to 3001).

## Structure
- `src/prisma`: shared Prisma module/service.
- `src/auth`: Auth module with DTOs, guards (JWT + admin), strategies, controllers.
- `src/users`: Users module/services/controllers for user management.
- `src/tenants`: Tenant CRUD + tenant-facing endpoints.
- `src/scripts`: One-off scripts such as the admin seed.
