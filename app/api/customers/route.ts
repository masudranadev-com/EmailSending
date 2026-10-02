import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";
import { query } from "../../../lib/db";
import { normalizeEmail } from "../../../lib/campaign-contacts";
import { mapUniqueEmailRow, type UniqueEmailRow } from "../../../lib/customer-records";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await query<UniqueEmailRow[]>(
      `SELECT
        id,
        email,
        information,
        created_at,
        updated_at
      FROM unique_emails
      ORDER BY updated_at DESC, id DESC`,
    );

    const customers = rows.map(mapUniqueEmailRow);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    return NextResponse.json({
      customers,
      stats: {
        total: customers.length,
        withBusinessInfo: customers.filter((customer) => customer.businessName).length,
        withStoreLink: customers.filter((customer) => customer.storeLink).length,
        addedThisWeek: customers.filter((customer) => new Date(customer.createdAt) >= weekStart)
          .length,
      },
    });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: unknown;
      informationJson?: unknown;
    };
    const email = normalizeEmail(payload.email);
    const information = parseInformationPayload(payload.informationJson, email);

    if (!email) {
      return NextResponse.json({ message: "A valid email address is required." }, { status: 400 });
    }

    const existingRows = await query<UniqueEmailRow[]>(
      `SELECT
        id,
        email,
        information,
        created_at,
        updated_at
      FROM unique_emails
      WHERE email = ?
      LIMIT 1`,
      [email],
    );

    if (existingRows.length > 0) {
      return NextResponse.json(
        {
          customer: mapUniqueEmailRow(existingRows[0]),
          message: "This email already exists in unique_emails.",
        },
        { status: 409 },
      );
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO unique_emails (email, information) VALUES (?, ?)`,
      [email, information ? JSON.stringify(information) : null],
    );
    const insertedRows = await query<UniqueEmailRow[]>(
      `SELECT
        id,
        email,
        information,
        created_at,
        updated_at
      FROM unique_emails
      WHERE id = ?
      LIMIT 1`,
      [result.insertId],
    );

    return NextResponse.json(
      {
        customer: mapUniqueEmailRow(insertedRows[0]),
        message: "Customer added successfully.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return databaseError(error);
  }
}

function databaseError(error: unknown) {
  return NextResponse.json(
    {
      message: error instanceof Error ? error.message : "Customer request failed.",
    },
    { status: 500 },
  );
}

class ValidationError extends Error {}

function parseInformationPayload(value: unknown, email: string) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ValidationError("Information JSON is invalid.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError("Information JSON must be an object.");
  }

  const information = parsed as Record<string, unknown>;

  return {
    ...information,
    email: typeof information.email === "string" && information.email.trim() ? information.email : email,
  };
}
