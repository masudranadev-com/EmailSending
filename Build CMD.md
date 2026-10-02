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

The production Compose file builds the application from `context: .` and uses
`.env` and the `docker/mysql` directories. Uploading the Compose file alone does
not include these project files. Ensure they are available in the deployment
context, or use a Git repository deployment with the required files and
environment configuration.

If Portainer reports `All collection items must start at the same column`, check
the exact YAML submitted to Portainer: entries in the same list must have their
`-` characters aligned, and sibling mapping keys must have equal indentation.
Use the reported line number to locate the malformed block. Both project Compose
files passed `docker compose config --quiet` during this investigation.
