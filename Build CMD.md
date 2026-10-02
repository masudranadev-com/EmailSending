# Production deployment

Run this command from the project directory on the server, with the project files
and `.env` present:

```powershell
npm run setup:env
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

## Validate the Compose file

```powershell
docker compose -f docker-compose.prod.yml config --quiet
```

A successful validation produces no output.

## Portainer

For a production stack, use `docker-compose.prod.yml` as the Compose file.
`Build CMD.md` contains shell commands and Markdown; do not upload it or paste
its contents into Portainer's YAML editor. When copying YAML, exclude Markdown
code fences and preserve indentation using spaces.

The production Compose file reads settings from deployment environment variables.
In Portainer, add the variables listed in `.env.example` under the stack's
Environment variables section (or use its environment-file import option).
Set `AUTH_SECRET` to a random secret and supply your database passwords and Brevo
credentials. These variables are explicitly forwarded to the app container;
Portainer does not need a physical `.env` file for the production stack.
Local Docker Compose commands can still read the project's `.env` automatically.

Before deploying in Portainer, run `npm run setup:env` in the project directory.
This creates `.env` from the template when needed, generates a private 32-byte
random `AUTH_SECRET` when it is missing, empty, or still the template placeholder,
and preserves an existing secret and all other settings. Fill in the database
passwords and Brevo credentials, then import `.env` into the stack's Environment
variables and save/redeploy. Keep this file private and do not commit it.

If pulling the stack fails with `required variable AUTH_SECRET is missing a value`,
the stack environment has not received the secret. Importing it into Portainer is
required even when `.env` exists in your local checkout or repository directory.

The production Compose file builds the application from `context: .` and uses
the `docker/mysql` directories. Uploading the Compose file alone does
not include these project files. Ensure they are available in the deployment
context, or use a Git repository deployment with the required files and
environment configuration.

If Portainer reports `All collection items must start at the same column`, check
the exact YAML submitted to Portainer: entries in the same list must have their
`-` characters aligned, and sibling mapping keys must have equal indentation.
Use the reported line number to locate the malformed block. Both project Compose
files passed `docker compose config --quiet` during this investigation.
