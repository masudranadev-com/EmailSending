import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { normalizeEmail, type ContactRecord } from "./campaign-contacts";
import { query } from "./db";

export type TargetClientStatus = "new" | "old";

export type TargetClientRow = RowDataPacket & {
  id: number;
  email: string;
  information: string | Record<string, unknown> | null;
  status: TargetClientStatus;
  created_at: Date;
  updated_at: Date;
};

export class TargetClientValidationError extends Error {}

export function parseTargetClient(value: unknown): ContactRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TargetClientValidationError("Each target client must be an object.");
  }

  const record = value as Record<string, unknown>;
  const email = normalizeEmail(record.email);

  if (!email) {
    throw new TargetClientValidationError("Each target client needs a valid email address.");
  }

  let information: Record<string, unknown> = {};
  const rawInformation = record.information;

  if (typeof rawInformation === "string" && rawInformation.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawInformation);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new TargetClientValidationError("Information must be a JSON object.");
      }
      information = parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof TargetClientValidationError) throw error;
      throw new TargetClientValidationError("Information JSON is invalid.");
    }
  } else if (rawInformation && typeof rawInformation === "object" && !Array.isArray(rawInformation)) {
    information = rawInformation as Record<string, unknown>;
  } else if (rawInformation !== undefined && rawInformation !== null && rawInformation !== "") {
    throw new TargetClientValidationError("Information must be a JSON object.");
  } else {
    const { email: _email, information: _information, ...rest } = record;
    information = rest;
  }

  return { ...information, email };
}

export async function upsertTargetClients(
  contacts: ContactRecord[],
  status: TargetClientStatus,
) {
  let affectedCount = 0;

  for (let index = 0; index < contacts.length; index += 500) {
    const chunk = contacts.slice(index, index + 500);
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => "(?, ?, ?)").join(", ");
    const values = chunk.flatMap((contact) => [
      contact.email,
      JSON.stringify(contact),
      status,
    ]);
    const result = await query<ResultSetHeader>(
      `INSERT INTO target_clients (email, information, status)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        information = VALUES(information),
        status = VALUES(status)`,
      values,
    );
    affectedCount += result.affectedRows;
  }

  return affectedCount;
}

export function parseTargetClientInformation(value: TargetClientRow["information"]) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
