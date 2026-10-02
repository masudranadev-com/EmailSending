import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";
import { databaseError, ValidationError } from "../../../lib/api-response";
import { query } from "../../../lib/db";
import {
  mapTemplateRow,
  type TemplateRow,
  validateTemplatePayload,
} from "../../../lib/template-records";

export const runtime = "nodejs";

export async function GET() {
  try {
    const templates = await query<TemplateRow[]>(
      `SELECT
        id,
        name,
        email_subject,
        email_from_name,
        email_from_email,
        email_reply_to,
        status,
        template_body,
        created_at,
        updated_at
      FROM templates
      ORDER BY updated_at DESC, id DESC`,
    );

    return NextResponse.json({ templates: templates.map(mapTemplateRow) });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = validateTemplatePayload(await request.json());

    const result = await query<ResultSetHeader>(
      `INSERT INTO templates (
        name,
        email_subject,
        email_from_name,
        email_from_email,
        email_reply_to,
        status,
        template_body
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.name,
        payload.emailSubject,
        payload.emailFromName,
        payload.emailFromEmail,
        payload.emailReplyTo || null,
        payload.status,
        payload.templateBody,
      ],
    );

    return NextResponse.json(
      {
        id: result.insertId,
        message: "Template created successfully.",
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
