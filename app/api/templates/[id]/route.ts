import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";
import { databaseError, ValidationError } from "../../../../lib/api-response";
import { query } from "../../../../lib/db";
import {
  mapTemplateRow,
  type TemplateRow,
  validateTemplatePayload,
} from "../../../../lib/template-records";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = await readTemplateId(context);
    const rows = await query<TemplateRow[]>(
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
      WHERE id = ?
      LIMIT 1`,
      [id],
    );

    if (!rows[0]) {
      return NextResponse.json({ message: "Template not found." }, { status: 404 });
    }

    return NextResponse.json({ template: mapTemplateRow(rows[0]) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return databaseError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const id = await readTemplateId(context);
    const payload = validateTemplatePayload(await request.json());

    const result = await query<ResultSetHeader>(
      `UPDATE templates
      SET
        name = ?,
        email_subject = ?,
        email_from_name = ?,
        email_from_email = ?,
        email_reply_to = ?,
        status = ?,
        template_body = ?
      WHERE id = ?`,
      [
        payload.name,
        payload.emailSubject,
        payload.emailFromName,
        payload.emailFromEmail,
        payload.emailReplyTo || null,
        payload.status,
        payload.templateBody,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Template not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Template updated successfully." });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return databaseError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const id = await readTemplateId(context);
    const result = await query<ResultSetHeader>("DELETE FROM templates WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Template not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Template deleted successfully." });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return databaseError(error);
  }
}

async function readTemplateId(context: RouteContext) {
  const { id } = await context.params;
  const templateId = Number(id);

  if (!Number.isInteger(templateId) || templateId <= 0) {
    throw new ValidationError("Template id is invalid.");
  }

  return templateId;
}
