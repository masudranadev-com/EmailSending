import type { RowDataPacket } from "mysql2";
import { ValidationError } from "./api-response";

export type TemplateRow = RowDataPacket & {
  id: number;
  name: string;
  email_subject: string;
  email_from_name: string;
  email_from_email: string;
  email_reply_to: string | null;
  status: "active" | "draft" | "archived";
  template_body: string;
  created_at: Date;
  updated_at: Date;
};

const allowedStatuses = new Set(["active", "draft", "archived"]);

export function mapTemplateRow(row: TemplateRow) {
  return {
    id: row.id,
    name: row.name,
    emailSubject: row.email_subject,
    emailFromName: row.email_from_name,
    emailFromEmail: row.email_from_email,
    emailReplyTo: row.email_reply_to ?? "",
    status: row.status,
    templateBody: row.template_body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateTemplatePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Template data is required.");
  }

  const data = payload as Record<string, unknown>;
  const name = readString(data.name);
  const emailSubject = readString(data.emailSubject);
  const emailFromName = readString(data.emailFromName);
  const emailFromEmail = readString(data.emailFromEmail);
  const emailReplyTo = readString(data.emailReplyTo, false);
  const status = readString(data.status) || "draft";
  const templateBody = readString(data.templateBody);

  if (!name) {
    throw new ValidationError("Template name is required.");
  }

  if (!emailSubject) {
    throw new ValidationError("Email subject is required.");
  }

  if (!emailFromName) {
    throw new ValidationError("From name is required.");
  }

  if (!emailFromEmail) {
    throw new ValidationError("From email is required.");
  }

  if (!templateBody) {
    throw new ValidationError("Template body is required.");
  }

  if (!allowedStatuses.has(status)) {
    throw new ValidationError("Template status is invalid.");
  }

  return {
    name,
    emailSubject,
    emailFromName,
    emailFromEmail,
    emailReplyTo,
    status,
    templateBody,
  };
}

function readString(value: unknown, required = true) {
  if (typeof value !== "string") {
    return required ? "" : "";
  }

  return value.trim();
}
