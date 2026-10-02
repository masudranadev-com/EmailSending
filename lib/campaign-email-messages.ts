import { randomUUID } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { ContactRecord } from "./campaign-contacts";
import { normalizeEmail } from "./campaign-contacts";
import { query, withTransaction } from "./db";
import { readContactProgress } from "./campaign-progress";

export type CampaignEmailStatus = "sent" | "failed" | "not_sent" | "sending";

export type CampaignCustomerEmail = {
  businessName: string;
  canSendFollowUp: boolean;
  customerId: string;
  disabledReason: string;
  email: string;
  emailSubject: string;
  followUpCount: number;
  lastFollowUpAt: string | null;
  mailError: string;
  originalMessageId: string;
  requiresThreadingHeaders: boolean;
  sentAt: string | null;
  status: CampaignEmailStatus;
  statusLabel: "Sent" | "Failed" | "Not Sent" | "Sending";
};

export type CampaignEmailList = {
  campaign: {
    id: number;
    name: string;
    subject: string;
  };
  emails: CampaignCustomerEmail[];
  pagination: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
  search: string;
};

export type CampaignMessage = {
  body: string;
  businessName: string;
  createdAt: string;
  direction: "outbound";
  errorMessage: string | null;
  failedAt: string | null;
  id: number | null;
  messageType: "initial" | "follow_up";
  parentMessageId: string | null;
  provider: "brevo_api" | "brevo_smtp" | "legacy";
  providerMessageId: string | null;
  referencesHeader: string | null;
  rfcMessageId: string | null;
  sentAt: string | null;
  status: "pending" | "sent" | "failed";
  subject: string;
  threadRootMessageId: string | null;
};

export type CampaignMessageInsert = {
  body: string;
  businessName: string;
  campaignId: number;
  customerEmail: string;
  customerUniqueId: string;
  direction?: "outbound";
  errorMessage?: string | null;
  failedAt?: Date | null;
  messageType: "initial" | "follow_up";
  parentMessageId?: string | null;
  provider: "brevo_api" | "brevo_smtp";
  providerMessageId?: string | null;
  referencesHeader?: string | null;
  rfcMessageId?: string | null;
  sentAt?: Date | null;
  status: "pending" | "sent" | "failed";
  subject: string;
  threadRootMessageId?: string | null;
};

type CampaignRow = RowDataPacket & {
  id: number;
  name: string;
  customers: string | unknown[];
  subject: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
};

type MessageRow = RowDataPacket & {
  id: number;
  campaign_id: number;
  customer_unique_id: string;
  customer_email: string;
  business_name: string | null;
  direction: "outbound";
  message_type: "initial" | "follow_up";
  subject: string;
  body: string | null;
  status: "pending" | "sent" | "failed";
  provider: "brevo_api" | "brevo_smtp";
  provider_message_id: string | null;
  rfc_message_id: string | null;
  parent_message_id: string | null;
  thread_root_message_id: string | null;
  references_header: string | null;
  sent_at: Date | null;
  failed_at: Date | null;
  error_message: string | null;
  created_at: Date;
};

export type LoadedCampaignCustomer = {
  campaign: CampaignRow;
  contact: ContactRecord;
  contactIndex: number;
  contactKey: string;
  contacts: ContactRecord[];
};

export async function readCampaignEmailList(
  campaignId: number,
  options: { limit?: number; page?: number; search?: string; status?: string },
): Promise<CampaignEmailList | null> {
  const campaign = await readCampaign(campaignId);

  if (!campaign) {
    return null;
  }

  const search = normalizeSearch(options.search);
  const statusFilter = normalizeStatusFilter(options.status);
  const page = Math.max(1, Math.floor(options.page || 1));
  const limit = Math.min(50, Math.max(1, Math.floor(options.limit || 50)));
  const contacts = parseCustomers(campaign.customers);
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch = search ? contact.email.toLowerCase().includes(search) : true;
    const matchesStatus = statusFilter
      ? normalizeMailStatus(contact.mail_sent) === statusFilter
      : true;

    return matchesSearch && matchesStatus;
  });
  const total = filteredContacts.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * limit;

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
    },
    emails: filteredContacts
      .slice(startIndex, startIndex + limit)
      .map((contact) => mapCustomerEmail(contact, campaign.subject)),
    pagination: {
      limit,
      page: safePage,
      total,
      totalPages,
    },
    search,
  };
}

export async function loadCampaignCustomer(
  campaignId: number,
  customerId: string,
): Promise<LoadedCampaignCustomer | null> {
  const campaign = await readCampaign(campaignId);

  if (!campaign) {
    return null;
  }

  const contacts = parseCustomers(campaign.customers);
  const requestedId = customerId.trim().toLowerCase();
  const contactIndex = contacts.findIndex((contact) => {
    const keys = [
      readContactString(contact, "id"),
      readContactString(contact, "unique_id"),
      readContactString(contact, "email").toLowerCase(),
    ].filter(Boolean);

    return keys.some((key) => key.toLowerCase() === requestedId);
  });

  if (contactIndex === -1) {
    return null;
  }

  const contact = contacts[contactIndex];

  return {
    campaign,
    contact,
    contactIndex,
    contactKey: readCustomerKey(contact),
    contacts,
  };
}

export async function insertCampaignMessage(message: CampaignMessageInsert) {
  const result = await query<ResultSetHeader>(
    `INSERT INTO campaign_email_messages (
      campaign_id,
      customer_unique_id,
      customer_email,
      business_name,
      direction,
      message_type,
      subject,
      body,
      status,
      provider,
      provider_message_id,
      rfc_message_id,
      parent_message_id,
      thread_root_message_id,
      references_header,
      sent_at,
      failed_at,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.campaignId,
      message.customerUniqueId,
      message.customerEmail,
      message.businessName,
      message.direction || "outbound",
      message.messageType,
      message.subject,
      message.body,
      message.status,
      message.provider,
      message.providerMessageId || null,
      message.rfcMessageId || null,
      message.parentMessageId || null,
      message.threadRootMessageId || null,
      message.referencesHeader || null,
      message.sentAt || null,
      message.failedAt || null,
      message.errorMessage || null,
    ],
  );

  return result.insertId;
}

export async function updateCampaignMessage(
  messageId: number,
  values: Partial<
    Pick<
      CampaignMessageInsert,
      | "errorMessage"
      | "failedAt"
      | "providerMessageId"
      | "rfcMessageId"
      | "sentAt"
      | "status"
    >
  >,
) {
  const updates: string[] = [];
  const params: Array<string | number | Date | null> = [];

  if (values.errorMessage !== undefined) {
    updates.push("error_message = ?");
    params.push(values.errorMessage);
  }

  if (values.failedAt !== undefined) {
    updates.push("failed_at = ?");
    params.push(values.failedAt);
  }

  if (values.providerMessageId !== undefined) {
    updates.push("provider_message_id = ?");
    params.push(values.providerMessageId);
  }

  if (values.rfcMessageId !== undefined) {
    updates.push("rfc_message_id = ?");
    params.push(values.rfcMessageId);
  }

  if (values.sentAt !== undefined) {
    updates.push("sent_at = ?");
    params.push(values.sentAt);
  }

  if (values.status !== undefined) {
    updates.push("status = ?");
    params.push(values.status);
  }

  if (updates.length === 0) {
    return;
  }

  params.push(messageId);
  await query<ResultSetHeader>(
    `UPDATE campaign_email_messages SET ${updates.join(", ")} WHERE id = ?`,
    params,
  );
}

export async function readCampaignCustomerMessages(
  campaignId: number,
  customerId: string,
) {
  const loaded = await loadCampaignCustomer(campaignId, customerId);

  if (!loaded) {
    return null;
  }

  const rows = await query<MessageRow[]>(
    `SELECT *
    FROM campaign_email_messages
    WHERE campaign_id = ?
      AND (
        customer_unique_id = ?
        OR LOWER(customer_email) = LOWER(?)
      )
    ORDER BY COALESCE(sent_at, failed_at, created_at) ASC, id ASC`,
    [campaignId, loaded.contactKey, loaded.contact.email],
  );
  const messages = rows.map(mapMessageRow);

  if (messages.length === 0) {
    messages.push(readLegacyInitialMessage(loaded.contact, loaded.campaign.subject));
  }

  return {
    businessName: readBusinessName(loaded.contact),
    customerEmail: loaded.contact.email,
    customerId: loaded.contactKey,
    messages,
  };
}

export async function updateCustomerAfterInitialSend(
  campaignId: number,
  contactIndex: number,
  contacts: ContactRecord[],
  values: {
    brevoMessageId?: string | null;
    emailSubject: string;
    errorMessage?: string | null;
    provider?: "brevo_api" | "brevo_smtp";
    rfcMessageId?: string | null;
    sentAt: Date;
    status: "success" | "failed";
  },
) {
  const contact = contacts[contactIndex];
  const nextContact =
    values.status === "success"
      ? {
          ...contact,
          brevo_message_id: values.brevoMessageId || null,
          email_subject: values.emailSubject,
          follow_up_count: readFollowUpCount(contact),
          last_follow_up_at: readNullableString(contact, "last_follow_up_at"),
          last_message_id: values.rfcMessageId || null,
          mail_error: null,
          mail_sent: "success",
          mail_sent_at: values.sentAt.toISOString(),
          rfc_message_id: values.rfcMessageId || null,
          thread_root_message_id: values.rfcMessageId || null,
        }
      : {
          ...contact,
          email_subject: values.emailSubject,
          mail_error: values.errorMessage || "Email sending failed.",
          mail_sent: "failed",
          mail_sent_at: values.sentAt.toISOString(),
        };

  contacts[contactIndex] = nextContact;
  await saveCampaignContacts(campaignId, contacts);
}

export async function updateCustomerAfterFollowUp(
  campaignId: number,
  customerId: string,
  values: {
    lastFollowUpAt: Date;
    lastMessageId?: string | null;
    referencesHeader?: string | null;
  },
) {
  await withTransaction(async (connection) => {
    const loaded = await loadCampaignCustomerForUpdate(connection, campaignId, customerId);

    if (!loaded) {
      throw new Error("Campaign customer could not be updated after sending.");
    }

    const nextContact = {
      ...loaded.contact,
      follow_up_count: readFollowUpCount(loaded.contact) + 1,
      last_follow_up_at: values.lastFollowUpAt.toISOString(),
      ...(values.lastMessageId ? { last_message_id: values.lastMessageId } : {}),
      ...(values.referencesHeader ? { references_header: values.referencesHeader } : {}),
    };

    loaded.contacts[loaded.contactIndex] = nextContact;
    await connection.execute<ResultSetHeader>(
      "UPDATE campaign SET customers = ? WHERE id = ?",
      [JSON.stringify(loaded.contacts), campaignId],
    );
  });
}

export function mapCustomerEmail(
  contact: ContactRecord,
  campaignSubject: string,
): CampaignCustomerEmail {
  const status = normalizeMailStatus(contact.mail_sent);
  const originalMessageId =
    readNullableString(contact, "thread_root_message_id") ||
    readNullableString(contact, "rfc_message_id") ||
    readValidBrevoMessageId(contact) ||
    "";
  const emailSubject = readNullableString(contact, "email_subject") || campaignSubject;
  const canSendFollowUp = status === "sent" && Boolean(emailSubject);

  return {
    businessName: readBusinessName(contact),
    canSendFollowUp,
    customerId: readCustomerKey(contact),
    disabledReason: readFollowUpDisabledReason(status, emailSubject),
    email: contact.email,
    emailSubject,
    followUpCount: readFollowUpCount(contact),
    lastFollowUpAt: readNullableString(contact, "last_follow_up_at"),
    mailError: readNullableString(contact, "mail_error") || "",
    originalMessageId,
    requiresThreadingHeaders: Boolean(originalMessageId),
    sentAt: readNullableString(contact, "mail_sent_at"),
    status,
    statusLabel: readStatusLabel(status),
  };
}

export function normalizeMailStatus(value: unknown): CampaignEmailStatus {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (status === "success") {
    return "sent";
  }

  if (status === "failed" || status === "faild") {
    return "failed";
  }

  if (status === "sending") {
    return "sending";
  }

  return "not_sent";
}

export function readCustomerKey(contact: ContactRecord) {
  return (
    readContactString(contact, "unique_id") ||
    readContactString(contact, "id") ||
    contact.email
  );
}

export function readBusinessName(contact: ContactRecord) {
  return (
    readContactString(contact, "business_name") ||
    readContactString(contact, "name") ||
    "Not provided"
  );
}

export function readReferencesHeader(contact: ContactRecord) {
  return (
    readNullableString(contact, "references_header") ||
    readNullableString(contact, "thread_root_message_id") ||
    readNullableString(contact, "rfc_message_id") ||
    readValidBrevoMessageId(contact) ||
    ""
  );
}

export function readParentMessageId(contact: ContactRecord) {
  return (
    readNullableString(contact, "last_message_id") ||
    readNullableString(contact, "thread_root_message_id") ||
    readNullableString(contact, "rfc_message_id") ||
    readValidBrevoMessageId(contact) ||
    ""
  );
}

export function readThreadRootMessageId(contact: ContactRecord) {
  return (
    readNullableString(contact, "thread_root_message_id") ||
    readNullableString(contact, "rfc_message_id") ||
    readValidBrevoMessageId(contact) ||
    ""
  );
}

export function ensureReSubject(subject: string) {
  const trimmedSubject = subject.trim();
  return /^re:/i.test(trimmedSubject) ? trimmedSubject : `Re: ${trimmedSubject}`;
}

export function appendReference(referencesHeader: string, messageId: string) {
  const existing = referencesHeader
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (!existing.includes(messageId)) {
    existing.push(messageId);
  }

  return existing.join(" ");
}

export function createRfcMessageId(fromEmail: string) {
  const configuredDomain = process.env.MESSAGE_ID_DOMAIN?.trim();
  const senderDomain = fromEmail.includes("@") ? fromEmail.split("@").pop() : "";
  const domain = sanitizeMessageIdDomain(configuredDomain || senderDomain || "localhost");
  const randomPart = randomUUID().replaceAll("-", "");

  return `<${Date.now()}.${randomPart}@${domain}>`;
}

export function validateRfcMessageId(value: string) {
  return /^<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(value.trim());
}

export function sanitizePlainTextMessage(value: string) {
  return value.replace(/\u0000/g, "").trim();
}

function readCampaign(campaignId: number) {
  return query<CampaignRow[]>(
    `SELECT id, name, customers, subject, from_name, from_email, reply_to
    FROM campaign
    WHERE id = ?
    LIMIT 1`,
    [campaignId],
  ).then((rows) => rows[0] || null);
}

async function loadCampaignCustomerForUpdate(
  connection: PoolConnection,
  campaignId: number,
  customerId: string,
): Promise<LoadedCampaignCustomer | null> {
  const [rows] = await connection.execute<CampaignRow[]>(
    `SELECT id, name, customers, subject, from_name, from_email, reply_to
    FROM campaign
    WHERE id = ?
    LIMIT 1
    FOR UPDATE`,
    [campaignId],
  );
  const campaign = rows[0];

  if (!campaign) {
    return null;
  }

  const contacts = parseCustomers(campaign.customers);
  const requestedId = customerId.trim().toLowerCase();
  const contactIndex = contacts.findIndex((contact) => {
    const keys = [
      readContactString(contact, "id"),
      readContactString(contact, "unique_id"),
      readContactString(contact, "email").toLowerCase(),
    ].filter(Boolean);

    return keys.some((key) => key.toLowerCase() === requestedId);
  });

  if (contactIndex === -1) {
    return null;
  }

  return {
    campaign,
    contact: contacts[contactIndex],
    contactIndex,
    contactKey: readCustomerKey(contacts[contactIndex]),
    contacts,
  };
}

async function saveCampaignContacts(campaignId: number, contacts: ContactRecord[]) {
  const progress = readContactProgress(contacts);

  await query<ResultSetHeader>(
    `UPDATE campaign
    SET
      customers = ?,
      recipient_count = ?,
      sent_count = ?,
      failed_count = ?,
      sending_count = ?,
      pending_count = ?
    WHERE id = ?`,
    [
      JSON.stringify(contacts),
      progress.total,
      progress.success,
      progress.failed,
      progress.sending,
      progress.pending,
      campaignId,
    ],
  );
}

function parseCustomers(value: CampaignRow["customers"]): ContactRecord[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? parseJsonArray(value)
      : [];

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    )
    .map((item) => ({
      ...item,
      email: normalizeEmail(item.email),
    }))
    .filter((item) => item.email);
}

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapMessageRow(row: MessageRow): CampaignMessage {
  return {
    body: row.body || "",
    businessName: row.business_name || "Not provided",
    createdAt: row.created_at.toISOString(),
    direction: row.direction,
    errorMessage: row.error_message,
    failedAt: row.failed_at ? row.failed_at.toISOString() : null,
    id: row.id,
    messageType: row.message_type,
    parentMessageId: row.parent_message_id,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    referencesHeader: row.references_header,
    rfcMessageId: row.rfc_message_id,
    sentAt: row.sent_at ? row.sent_at.toISOString() : null,
    status: row.status,
    subject: row.subject,
    threadRootMessageId: row.thread_root_message_id,
  };
}

function readLegacyInitialMessage(
  contact: ContactRecord,
  campaignSubject: string,
): CampaignMessage {
  const status = normalizeMailStatus(contact.mail_sent);
  const failed = status === "failed";
  const sentAt = readNullableString(contact, "mail_sent_at");

  return {
    body: "Original message body was not stored for this legacy record.",
    businessName: readBusinessName(contact),
    createdAt: sentAt || new Date(0).toISOString(),
    direction: "outbound",
    errorMessage: readNullableString(contact, "mail_error"),
    failedAt: failed ? sentAt : null,
    id: null,
    messageType: "initial",
    parentMessageId: null,
    provider: "legacy",
    providerMessageId: readNullableString(contact, "brevo_message_id"),
    referencesHeader: readReferencesHeader(contact) || null,
    rfcMessageId: readNullableString(contact, "rfc_message_id"),
    sentAt: failed ? null : sentAt,
    status: failed ? "failed" : status === "sent" ? "sent" : "pending",
    subject: readNullableString(contact, "email_subject") || campaignSubject,
    threadRootMessageId: readThreadRootMessageId(contact) || null,
  };
}

function normalizeSearch(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeStatusFilter(value: unknown): CampaignEmailStatus | "" {
  if (typeof value !== "string") {
    return "";
  }

  const status = value.trim().toLowerCase();

  if (
    status === "sent" ||
    status === "failed" ||
    status === "not_sent" ||
    status === "sending"
  ) {
    return status;
  }

  return "";
}

function readContactString(contact: ContactRecord, key: string) {
  const value = contact[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function readNullableString(contact: ContactRecord, key: string) {
  const value = readContactString(contact, key);
  return value || null;
}

function readValidBrevoMessageId(contact: ContactRecord) {
  const value = readContactString(contact, "brevo_message_id");
  return value && validateRfcMessageId(value) ? value : null;
}

function readFollowUpCount(contact: ContactRecord) {
  const value = Number(contact.follow_up_count);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function readStatusLabel(status: CampaignEmailStatus): CampaignCustomerEmail["statusLabel"] {
  if (status === "sent") {
    return "Sent";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "sending") {
    return "Sending";
  }

  return "Not Sent";
}

function readFollowUpDisabledReason(status: CampaignEmailStatus, subject: string) {
  if (status !== "sent") {
    return "Follow-up is available only after the original email was sent successfully.";
  }

  if (!subject) {
    return "Original email subject is missing.";
  }

  return "";
}

function sanitizeMessageIdDomain(value: string) {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9.-]/g, "");
  return sanitized.includes(".") ? sanitized : `${sanitized || "localhost"}.local`;
}
