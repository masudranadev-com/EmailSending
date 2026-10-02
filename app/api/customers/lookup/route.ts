import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";
import { query, withTransaction } from "../../../../lib/db";
import { normalizeEmail } from "../../../../lib/campaign-contacts";
import { mapUniqueEmailRow, type UniqueEmailRow } from "../../../../lib/customer-records";
import {
  CUSTOMER_UPDATE_FIELDS,
  CustomerUpdateValidationError,
  parseCustomerUpdates,
} from "../../../../lib/customer-updates";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { emails?: unknown; emailsText?: unknown };
    const parsed = parseEmailInput(payload.emails ?? payload.emailsText);

    if (parsed.emails.length === 0) {
      return NextResponse.json(
        {
          message: "Enter at least one valid email address.",
          invalidCount: parsed.invalidCount,
          duplicateCount: parsed.duplicateCount,
        },
        { status: 400 },
      );
    }

    const found = new Map<string, ReturnType<typeof mapUniqueEmailRow>>();

    for (const chunk of chunkArray(parsed.emails, 1000)) {
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = await query<UniqueEmailRow[]>(
        `SELECT
          id,
          email,
          information,
          created_at,
          updated_at
        FROM unique_emails
        WHERE email IN (${placeholders})`,
        chunk,
      );

      rows.map(mapUniqueEmailRow).forEach((customer) => {
        found.set(customer.email.toLowerCase(), customer);
      });
    }

    const results = parsed.emails.map((email) => {
      const customer = found.get(email);

      return customer
        ? {
            email,
            found: true,
            customer,
          }
        : {
            email,
            found: false,
            customer: null,
          };
    });

    return NextResponse.json({
      searchedCount: parsed.emails.length,
      foundCount: results.filter((result) => result.found).length,
      missingCount: results.filter((result) => !result.found).length,
      invalidCount: parsed.invalidCount,
      duplicateCount: parsed.duplicateCount,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Mail lookup failed.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { customers?: unknown; customersJson?: unknown };
    const parsed = parseCustomerUpdates(payload.customers ?? payload.customersJson);

    if (parsed.updates.length === 0) {
      return NextResponse.json(
        {
          message:
            "No valid customer updates were found. Include an email and at least one supported field.",
          invalidCount: parsed.invalidCount,
          duplicateCount: parsed.duplicateCount,
        },
        { status: 400 },
      );
    }

    const result = await withTransaction(async (connection) => {
      const existingEmails = new Map<string, number>();

      for (const chunk of chunkArray(
        parsed.updates.map((update) => update.email),
        1000,
      )) {
        const placeholders = chunk.map(() => "?").join(", ");
        const [rows] = await connection.execute<UniqueEmailRow[]>(
          `SELECT
            id,
            email,
            information,
            created_at,
            updated_at
          FROM unique_emails
          WHERE email IN (${placeholders})`,
          chunk,
        );

        for (const row of rows) {
          existingEmails.set(row.email.toLowerCase(), row.id);
        }
      }

      const updatedEmails: string[] = [];
      const missingEmails: string[] = [];

      for (const update of parsed.updates) {
        const customerId = existingEmails.get(update.email);

        if (!customerId) {
          missingEmails.push(update.email);
          continue;
        }

        const fields = CUSTOMER_UPDATE_FIELDS.filter((field) => field in update.information);
        const jsonSetArguments = fields.map((field) => `'$.${field}', ?`).join(", ");
        const values = fields.map((field) => update.information[field] ?? "");

        // JSON paths come only from the whitelisted fields; all incoming values stay parameterized.
        await connection.execute<ResultSetHeader>(
          `UPDATE unique_emails
          SET information = JSON_SET(
            IF(JSON_TYPE(information) = 'OBJECT', information, JSON_OBJECT()),
            ${jsonSetArguments}
          )
          WHERE id = ?`,
          [...values, customerId],
        );

        updatedEmails.push(update.email);
      }

      return { missingEmails, updatedEmails };
    });

    return NextResponse.json({
      message: `${result.updatedEmails.length} customer${result.updatedEmails.length === 1 ? "" : "s"} updated successfully.`,
      submittedCount: parsed.updates.length,
      updatedCount: result.updatedEmails.length,
      missingCount: result.missingEmails.length,
      invalidCount: parsed.invalidCount,
      duplicateCount: parsed.duplicateCount,
      updatedEmails: result.updatedEmails,
      missingEmails: result.missingEmails,
    });
  } catch (error) {
    if (error instanceof CustomerUpdateValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Customer update failed.",
      },
      { status: 500 },
    );
  }
}

function parseEmailInput(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value.map((item) => String(item))
    : String(value ?? "").split(/[\s,;]+/);
  const seen = new Set<string>();
  const emails: string[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const rawValue of rawValues) {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      continue;
    }

    const email = normalizeEmail(trimmed);

    if (!email) {
      invalidCount += 1;
      continue;
    }

    if (seen.has(email)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(email);
    emails.push(email);
  }

  return { duplicateCount, emails, invalidCount };
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
