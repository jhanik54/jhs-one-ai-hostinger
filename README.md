# JH One AI

JH One AI is a Next.js chat application with custom server-side authentication, MySQL persistence, and a multi-provider AI gateway.

## Stack

- Next.js 16 and TypeScript
- Hostinger MySQL through Prisma
- HTTP-only database-backed sessions and bcrypt password hashes
- Server-side Google OAuth
- Gemini, Groq, and OpenRouter provider pools

## Local setup

1. Install Node.js 20+ and MySQL 8 (or create a MySQL database in Hostinger hPanel).
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `AUTH_SECRET`.
3. Apply the schema using `npx prisma migrate deploy`.
4. Set Google OAuth and provider keys as needed, then run `npm run dev`.

`prisma/migrations` contains the MySQL schema and initial plans/settings. Migrations do not connect to or change any remote database until explicitly run.

## Environment

See `.env.example`. Never use a `NEXT_PUBLIC_` prefix for credentials. Google OAuth callback should be `https://your-domain/auth/callback` and must match `GOOGLE_REDIRECT_URI` in Google Cloud Console.

Set `INITIAL_SUPERADMIN_EMAIL` to the owner email before its first Google sign-in. That verified Google account receives the initial superadmin role. Do not expose this value publicly.

## Hostinger deployment and recovery

Deploy the Next.js application on a Hostinger runtime that supports the project's Node.js version and persistent server execution; configure the MySQL database, `DATABASE_URL`, and environment variables in the hosting panel. Confirm the selected Business hosting runtime supports Next.js server routes and streaming before DNS cutover. Run `npx prisma migrate deploy` once per release after taking a Hostinger database backup. Restore through hPanel's MySQL backup/restore tooling; verify the restore on a separate database before directing production traffic to it. Keep uploads outside `public/` if persistent upload support is enabled.

## Checks

`npm run lint`, `npx tsc --noEmit`, and `npm run build`.
