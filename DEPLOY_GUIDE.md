# Hostinger deployment

1. Create a MySQL database and user in Hostinger hPanel. Grant the user access to that database.
2. Configure the Next.js Node.js application using Node.js 20.16 or newer in the runtime supported by your Hostinger Business plan. This project requires server routes, secure cookies, and streaming responses.
3. Configure the variables in `.env.example` in the Hostinger application environment, including `DATABASE_URL` in the **build-time environment** used when Hostinger runs `npm run build` and in the runtime environment. The build connects to this MySQL database to apply committed Prisma migrations, so both environments must point to the intended database. Use a long random `AUTH_SECRET`; keep all values server-side.
4. Configure the Google OAuth web client with an authorized redirect URI of `https://YOUR_DOMAIN/auth/callback`; set the same URI in `GOOGLE_REDIRECT_URI`.
5. Back up the database before deployment. `npm run build` runs `prisma generate`, then `prisma migrate deploy`, then `next build --webpack`. Keep `prisma/schema.prisma` and the complete `prisma/migrations` directory in the source checkout available to the build; do not build from an artifact that omits them. The runtime artifact may omit the Prisma source after the build has completed.
6. Set `INITIAL_SUPERADMIN_EMAIL` before the owner signs in through Google. Only a verified Google email matching this value receives the initial superadmin role.
7. Configure Gemini/Groq/OpenRouter keys using indexed environment names. Any index can be used, for example `GEMINI_KEY_0`, `GEMINI_KEY_12`.
8. Set the WhatsApp business number in the admin settings after initial deployment.

## Private user uploads

Set `PRIVATE_UPLOAD_DIR` to an application-writable persistent directory outside the site's document root (for example, a private directory beside the deployed application, not inside `public_html`). The application creates it with mode `0700` and writes files with mode `0600`; verify that the Hostinger Node process owns this directory. Hostinger deployments that do not preserve files across releases must point this setting to persistent account storage. Allow up to 11 MB for a single multipart upload at the reverse proxy/runtime layer. Application limits are 10 MB per PDF, 8 MB per image, and 11 MB per request.

Back up this private upload directory together with the MySQL database. Restore the private files before restoring or serving their `uploaded_files` metadata. Do not expose this directory through the web server or configure it as a static asset directory.

The committed migrations create the database schema, including the `uploaded_files` metadata table. `npm run db:migrate` remains available to apply committed migrations explicitly when needed. `npm run test:uploads` runs the isolated MIME, extension, signature, size, and filename validation tests without external credentials.

Take a Hostinger MySQL backup before each build that can apply migrations. To recover, restore that backup through hPanel to a separate database, validate the restored application there, then switch `DATABASE_URL`. The build uses `prisma migrate deploy` and preserves the existing migration history; it does not use `prisma db push` or `prisma migrate reset`.

Do not commit `.env.local`. The `.gitignore` excludes `.env*` files.
