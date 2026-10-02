import type { RowDataPacket } from "mysql2";

export type UniqueEmailRow = RowDataPacket & {
  id: number;
  email: string;
  information: string | Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

export type CustomerRecord = {
  id: number;
  email: string;
  information: Record<string, unknown>;
  businessName: string;
  headquarters: string;
  storeLink: string;
  uniqueId: string;
  sourceId: string;
  hasExtraInformation: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function mapUniqueEmailRow(row: UniqueEmailRow): CustomerRecord {
  const information = parseInformation(row.information);

  return {
    id: row.id,
    email: row.email,
    information,
    businessName: readInfoString(information, "business_name") || readInfoString(information, "name"),
    headquarters: readInfoString(information, "headquarters"),
    storeLink: readInfoString(information, "store_link"),
    uniqueId: readInfoString(information, "unique_id"),
    sourceId: readInfoString(information, "id"),
    hasExtraInformation: hasUsefulInformation(information),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseInformation(value: UniqueEmailRow["information"]): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readInfoString(information: Record<string, unknown>, key: string) {
  const value = information[key];

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function hasUsefulInformation(information: Record<string, unknown>) {
  return Object.entries(information).some(([key, value]) => {
    if (key === "email" || value === null || value === undefined) {
      return false;
    }

    return String(value).trim().length > 0;
  });
}
