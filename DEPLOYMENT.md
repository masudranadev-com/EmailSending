# Production Deployment

This project is ready to deploy from GitHub to a shared server.

## 1. Required Server Software

- Node.js 22 or newer
- npm
- MySQL 8 or compatible
- Git
- PM2 if using a Node shared server

## 2. Environment Variables

Copy `.env.example` to `.env` on the server and fill in real values.

Required production keys:

```env
NEXT_PUBLIC_APP_NAME=Email Sending Project
NODE_ENV=production
AUTH_SECRET=change_me_auth_secret
APP_PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=email_sending_project
DB_USER=email_app
DB_PASSWORD=change_me_database_password

BREVO_API_KEY=change_me_brevo_api_key
SPEED_LIMIT_PER_MINUTE=5
DAILY_SENDING_LIMIT=200
```

Do not commit `.env` to GitHub.

## 3. Database Setup

Create the MySQL database and import the schema:

```bash
mysql -u DB_USER -p DB_NAME < docs/database.mysql.sql
```

If the database already exists, apply any files in `docker/mysql/migrations` that have not been applied yet.

## 4. Deploy With Git And PM2

Clone the GitHub repo on the server:

```bash
git clone https://github.com/masudranadev-com/EmailSendingProject.git
cd EmailSendingProject
cp .env.example .env
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

For later updates:

```bash
git pull origin main
npm ci
npm run build
pm2 restart email-sending-project
```

## 5. Scheduled Campaign Cron

## 5. Deploy On cPanel Node.js

Use these cPanel Node.js app values:

```text
Application mode: Production
Application root: mail.masudranadev.com
Application URL: mail.masudranadev.com
Application startup file: server.js
```

Then open the app terminal and run:

```bash
npm install
npm run build
```

Important cPanel notes:

- Keep `NODE_ENV` exactly `production`.
- If the build fails with `spawn ... EAGAIN` or `SIGABRT`, the server is hitting a shared-hosting process or memory limit. This project caps Next.js build workers in `next.config.mjs`.
- Pages are forced to dynamic rendering in `app/layout.tsx` to reduce shared-hosting prerender work during build.
- The build script uses `next build --webpack` because cPanel creates `node_modules` as a symlink and Next.js 16 Turbopack can fail on that.
- Do not upload `node_modules` from your computer.
- Restart the Node.js app after build.

## 6. Scheduled Campaign Cron

Scheduled campaigns need a cron request every 5 minutes:

```bash
*/5 * * * * curl -fsS https://your-domain.com/api/campaigns/send-due >/dev/null 2>&1
```

Replace `https://your-domain.com` with the production domain.

## 7. Deploy With Docker

If the server supports Docker:

```bash
npm run setup:env
docker compose -f docker-compose.prod.yml up -d --build
```

`setup:env` generates a private `AUTH_SECRET` and preserves existing values.
Fill in the remaining credentials in `.env` before deployment. For Portainer,
import `.env` under the stack's Environment variables before deploying; a local
`.env` file alone does not supply Portainer's Compose interpolation variables.

For updates:

```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

## 8. Security Notes

- Rotate any API key that was ever committed to GitHub history.
- Keep `.env` only on the server.
- Do not expose Adminer in production.
- Use HTTPS on the production domain.
