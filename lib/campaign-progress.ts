import type { ContactRecord } from "./campaign-contacts";

export type ContactProgress = {
  failed: number;
  pending: number;
  sending: number;
  success: number;
  total: number;
};

export function readContactProgress(contacts: ContactRecord[] | unknown[]): ContactProgress {
  return contacts.reduce<ContactProgress>(
    (progress, contact) => {
      if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
        return progress;
      }

      progress.total += 1;

      const status = readContactMailStatus(contact as Record<string, unknown>);

      if (status === "success") {
        progress.success += 1;
      } else if (status === "failed" || status === "faild") {
        progress.failed += 1;
      } else if (status === "sending") {
        progress.sending += 1;
        progress.pending += 1;
      } else {
        progress.pending += 1;
      }

      return progress;
    },
    {
      failed: 0,
      pending: 0,
      sending: 0,
      success: 0,
      total: 0,
    },
  );
}

export function readContactMailStatus(contact: Record<string, unknown>) {
  const value = contact.mail_sent;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
