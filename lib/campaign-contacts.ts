import type { RowDataPacket } from "mysql2";
import { query } from "./db";

export type ContactRecord = Record<string, unknown> & {
  email: string;
};

type UniqueEmailRow = RowDataPacket & {
  email: string;
};

export class ContactValidationError extends Error {}

export function parseContactsJson(contactsJson: string) {
  if (!contactsJson.trim()) {
    throw new ContactValidationError("Contacts JSON is required.");
  }

  try {
    const parsed = JSON.parse(contactsJson) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new ContactValidationError("Contacts JSON is invalid.");
  }
}

export function normalizeContacts(rawContacts: unknown[]) {
  const seenEmails = new Set<string>();
  const contacts: ContactRecord[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const item of rawContacts) {
    if (!isPlainObject(item)) {
      invalidCount += 1;
      continue;
    }

    const email = normalizeEmail(item.email);

    if (!email) {
      invalidCount += 1;
      continue;
    }

    if (seenEmails.has(email)) {
      duplicateCount += 1;
      continue;
    }

    seenEmails.add(email);
    contacts.push({
      ...item,
      email,
    });
  }

  return {
    contacts,
    duplicateCount,
    invalidCount,
  };
}

export function parseAndNormalizeContacts(contactsJson: string) {
  return normalizeContacts(parseContactsJson(contactsJson));
}

export async function removeExistingUniqueEmailContacts(contacts: ContactRecord[]) {
  const existingEmails = await getExistingUniqueEmails(contacts.map((contact) => contact.email));
  const uniqueContacts = contacts.filter((contact) => !existingEmails.has(contact.email));

  return {
    existingCount: contacts.length - uniqueContacts.length,
    uniqueContacts,
  };
}

export async function insertUniqueContacts(contacts: ContactRecord[]) {
  if (contacts.length === 0) {
    return 0;
  }

  let insertedCount = 0;

  for (const chunk of chunkArray(contacts, 500)) {
    const placeholders = chunk.map(() => "(?, ?)").join(", ");
    const values = chunk.flatMap((contact) => [contact.email, JSON.stringify(contact)]);

    const result = await query<import("mysql2").ResultSetHeader>(
      `INSERT IGNORE INTO unique_emails (email, information) VALUES ${placeholders}`,
      values,
    );

    insertedCount += result.affectedRows;
  }

  return insertedCount;
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const email = value.trim().toLowerCase();

  if (email.length === 0 || email.length > 320) {
    return "";
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

async function getExistingUniqueEmails(emails: string[]) {
  const existingEmails = new Set<string>();
  const uniqueEmails = Array.from(new Set(emails));

  for (const chunk of chunkArray(uniqueEmails, 1000)) {
    if (chunk.length === 0) {
      continue;
    }

    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await query<UniqueEmailRow[]>(
      `SELECT LOWER(email) AS email FROM unique_emails WHERE email IN (${placeholders})`,
      chunk,
    );

    for (const row of rows) {
      existingEmails.add(row.email);
    }
  }

  return existingEmails;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
