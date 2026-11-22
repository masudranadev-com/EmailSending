# Email Sending Project

Next.js email campaign manager with MySQL-backed campaigns, templates, unique customer emails, Brevo sending, scheduling, and dashboard reporting.

## Local Development

The Compose files start only the app. They expect the existing MySQL and Adminer
containers to be attached to an external Docker network named `shared_services`.
The MySQL container must be reachable on that network as `mysql` (or set
`DB_SERVICE_HOST` in `.env` to its network alias). Create the network once if
needed with `docker network create shared_services`.

```bash
cp .env.example .env
docker compose up -d --build
```

Open:

- App: `http://localhost:3000`
- Adminer: use the address already configured for your existing Adminer container

## Scripts

```bash
npm run dev
npm run build
npm run start
```

## Production

See `DEPLOYMENT.md`.
