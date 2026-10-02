import { normalizeEmail } from "./campaign-contacts";

export const CUSTOMER_UPDATE_FIELDS = [
  "headquarters",
  "mobile_number",
  "store_link",
  "business_name",
  "seller_name",
] as const;

export type CustomerUpdateField = (typeof CUSTOMER_UPDATE_FIELDS)[number];

export type CustomerUpdate = {
  email: string;
  information: Partial<Record<CustomerUpdateField, string>>;
};

export type ParsedCustomerUpdates = {
  updates: CustomerUpdate[];
  invalidCount: number;
  duplicateCount: number;
};

export class CustomerUpdateValidationError extends Error {}

export function parseCustomerUpdates(value: unknown): ParsedCustomerUpdates {
  let parsed = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new CustomerUpdateValidationError("Customer update JSON is invalid.");
    }
  }

  if (!Array.isArray(parsed)) {
    throw new CustomerUpdateValidationError("Customer update JSON must be an array.");
  }

  const updates = new Map<string, CustomerUpdate>();
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      invalidCount += 1;
      continue;
    }

    const record = item as Record<string, unknown>;
    const email = normalizeEmail(record.email);
    const information: CustomerUpdate["information"] = {};

    for (const field of CUSTOMER_UPDATE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(record, field)) {
        continue;
      }

      const fieldValue = record[field];

      if (fieldValue === null || fieldValue === undefined) {
        information[field] = "";
      } else if (["string", "number", "boolean"].includes(typeof fieldValue)) {
        information[field] = String(fieldValue).trim();
      }
    }

    if (!email || Object.keys(information).length === 0) {
      invalidCount += 1;
      continue;
    }

    if (updates.has(email)) {
      duplicateCount += 1;
    }

    updates.set(email, { email, information });
  }

  return {
    updates: Array.from(updates.values()),
    invalidCount,
    duplicateCount,
  };
}
