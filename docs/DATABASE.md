# MySQL Setup

This project now has dynamic MySQL tables for `user`, `campaign`, `templates`, and `unique_emails`.

## User Table

Columns:

- `id`
- `username`
- `password_hash`
- `created_at`
- `updated_at`

Default seeded login:

- Username: `admin`
- Password: `00000000`

Passwords are stored as `scrypt` hashes, not plain text.

## Campaign Table

Columns:

- `id`
- `name`
- `customers`
- `template_id`
- `subject`
- `from_name`
- `from_email`
- `reply_to`
- `is_schedule`
- `schedule_date`
- `send_status`
- `sent_at`
- `send_error`
- `failure_reason`
- `created_at`
- `updated_at`

`customers` is a MySQL `JSON` column. Store the customer array like this:

```json
[
  {
    "email": "mail1@gmail.com",
    "name": "Name",
    "tags": ["tag1", "tag2"]
  },
  {
    "email": "mail2@gmail.com",
    "name": "Name",
    "tags": ["tag3"]
  }
]
```

Successful new SMTP-backed sends add delivery/threading metadata to each matching
customer JSON object, including:

- `email_subject`
- `brevo_message_id`
- `rfc_message_id`
- `thread_root_message_id`
- `last_message_id`
- `references_header`
- `follow_up_count`
- `last_follow_up_at`
- `mail_error`

Existing fields such as `id`, `email`, `unique_id`, `store_link`, `headquarters`,
`business_name`, `mail_sent`, and `mail_sent_at` are preserved.

## Campaign Email Messages Table

Columns:

- `id`
- `campaign_id`
- `customer_unique_id`
- `customer_email`
- `business_name`
- `direction`
- `message_type`
- `subject`
- `body`
- `status`
- `provider`
- `provider_message_id`
- `rfc_message_id`
- `parent_message_id`
- `thread_root_message_id`
- `references_header`
- `sent_at`
- `failed_at`
- `error_message`
- `created_at`
- `updated_at`

This table stores initial campaign deliveries and every follow-up message in
chronological order. Threaded follow-ups use SMTP and store the RFC `Message-ID`,
`In-Reply-To` parent, and full `References` chain.

## Templates Table

Columns:

- `id`
- `name`
- `email_subject`
- `email_from_name`
- `email_from_email`
- `email_reply_to`
- `status`
- `template_body`
- `created_at`
- `updated_at`

`template_body` is `LONGTEXT`, so it can store the full HTML from an uploaded `index.html` file.

## Unique Emails Table

Columns:

- `id`
- `email`
- `information`
- `created_at`
- `updated_at`

`email` is unique, so the same email cannot be inserted twice.

`information` is a MySQL `JSON` column. It can store any valid JSON object or array:

```json
{
  "name": "Customer Name",
  "address": "Customer address",
  "tags": ["lead", "newsletter"]
}
```

## Local Docker Development

Run the app and MySQL together:

```bash
docker compose up --build
```

The app runs on:

```text
http://localhost:3000
```

MySQL is exposed to your host machine on:

```text
127.0.0.1:3307
```

## Running Without Docker Later

The app reads database settings from environment variables:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
```

So later, on another server, you only need to point these values to your MySQL database.

## SQL Files

Main schema file:

```text
docs/database.mysql.sql
```

Docker MySQL init file:

```text
docker/mysql/init/001_create_campaign.sql
```

Existing database migration:

```text
docker/mysql/migrations/002_create_templates.sql
```

```text
docker/mysql/migrations/003_create_unique_emails.sql
```

```text
docker/mysql/migrations/007_create_user.sql
```

```text
docker/mysql/migrations/008_create_campaign_email_messages.sql
```

The Docker init file runs automatically only the first time the MySQL volume is created.
