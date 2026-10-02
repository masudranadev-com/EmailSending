import { NextResponse } from "next/server";
import { databaseError } from "../../../../lib/api-response";
import {
  ContactValidationError,
  parseAndNormalizeContacts,
  removeExistingUniqueEmailContacts,
} from "../../../../lib/campaign-contacts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const data = (await request.json()) as Record<string, unknown>;
    const contactsJson = typeof data.contactsJson === "string" ? data.contactsJson : "";
    const { contacts, duplicateCount, invalidCount } = parseAndNormalizeContacts(contactsJson);
    const { existingCount, uniqueContacts } =
      await removeExistingUniqueEmailContacts(contacts);

    return NextResponse.json({
      contacts: uniqueContacts,
      contactsJson: JSON.stringify(uniqueContacts, null, 2),
      duplicateCount,
      existingCount,
      invalidCount,
      keptCount: uniqueContacts.length,
      totalValidCount: contacts.length,
    });
  } catch (error) {
    if (error instanceof ContactValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return databaseError(error);
  }
}
