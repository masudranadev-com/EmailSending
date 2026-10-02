# Production deployment

Run this command from the project directory on the server, with the project files
and `.env` present:

```powershell
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
