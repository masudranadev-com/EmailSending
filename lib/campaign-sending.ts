import type { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  normalizeContacts,
  type ContactRecord,
} from "./campaign-contacts";
import {
  insertCampaignMessage,
  readBusinessName,
  readCustomerKey,
} from "./campaign-email-messages";
import { query } from "./db";
import { readEmailDeliverySettings } from "./email-settings";
import { readContactMailStatus, readContactProgress } from "./campaign-progress";
import {
  releaseDailySendSlot,
  reserveDailySendSlot,
} from "./daily-send-limit";
import { sendInitialCampaignEmail } from "./mail-transport";

type CampaignSendStatus =
  | "pending"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

type CampaignSendRow = RowDataPacket & {
  id: number;
  name: string;
  customers: string | unknown[];
  subject: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  schedule_date: Date | null;
  send_status: CampaignSendStatus;
  template_body: string | null;
};

type SendOneEmailInput = {
  htmlBody: string;
  contact: ContactRecord;
  deliverySettings: Awaited<ReturnType<typeof readEmailDeliverySettings>>;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  subject: string;
  textBody: string;
};

type CampaignSendOptions = {
  force?: boolean;
  resetRecipientStatuses?: boolean;
};

type CampaignStatusRow = RowDataPacket & {
  send_status: CampaignSendStatus;
};

export function startCampaignSend(
  campaignId: number,
  options: CampaignSendOptions = {},
) {
  void sendCampaignById(campaignId, options).catch((error) => {
    console.error(
      `Campaign ${campaignId} failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  });
}

export async function sendCampaignById(
  campaignId: number,
  options: CampaignSendOptions = {},
) {
  const startedAt = new Date();
  const campaigns = await query<CampaignSendRow[]>(
    `SELECT
      c.id,
      c.name,
      c.customers,
      c.subject,
      c.from_name,
      c.from_email,
      c.reply_to,
      c.schedule_date,
      c.send_status,
      t.template_body
    FROM campaign c
    LEFT JOIN templates t ON t.id = c.template_id
    WHERE c.id = ?
    LIMIT 1`,
    [campaignId],
  );
  const campaign = campaigns[0];

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (
    campaign.send_status === "sending" ||
    (!options.force &&
      (campaign.send_status === "sent" || campaign.send_status === "cancelled"))
  ) {
    return {
      failed: 0,
      sent: 0,
      skipped: 0,
      status: campaign.send_status,
    };
  }

  await query<ResultSetHeader>(
    `UPDATE campaign
    SET send_status = 'sending', send_error = NULL, failure_reason = NULL
    WHERE id = ?`,
    [campaignId],
  );

  try {
    const deliverySettings = await readEmailDeliverySettings();
    const rawContacts =
      typeof campaign.customers === "string"
        ? (JSON.parse(campaign.customers) as unknown[])
        : campaign.customers;
    const { contacts } = normalizeContacts(Array.isArray(rawContacts) ? rawContacts : []);
    const trackedContacts = options.resetRecipientStatuses
      ? contacts.map(clearContactMailStatus)
      : contacts.map(resetStaleSendingContact);
    const templateBody = campaign.template_body || "";
    const failureReasons: string[] = [];
    let blockedReason: string | null = null;
    let dailyLimitReached = false;
    const pendingIndexes = readPendingContactIndexes(trackedContacts);
    const contactsToSend =
      deliverySettings.dailySendingLimit > 0
        ? pendingIndexes.slice(0, deliverySettings.dailySendingLimit)
        : pendingIndexes;

    await saveCampaignContacts(campaignId, trackedContacts);

    for (let index = 0; index < contactsToSend.length; index += 1) {
      const contactIndex = contactsToSend[index];
      const contact = trackedContacts[contactIndex];

      if (await isCampaignCancelled(campaignId)) {
        break;
      }

      const dailySlot = await reserveDailySendSlot(
        deliverySettings.dailySendingLimit,
        deliverySettings.dailySendingTimeZone,
      );

      if (!dailySlot.allowed) {
        dailyLimitReached = true;
        blockedReason = dailySlot.reason;
        break;
      }

      trackedContacts[contactIndex] = {
        ...contact,
        mail_sent: "sending",
      };
      await saveCampaignContacts(campaignId, trackedContacts);

      const subject = renderTemplateVariables(campaign.subject, contact, { escape: false });
      const body = renderEmailBody(templateBody, contact);
      let result: Awaited<ReturnType<typeof sendOneEmail>>;

      try {
        result = await sendOneEmail({
          contact,
          deliverySettings,
          fromEmail: campaign.from_email,
          htmlBody: body.html,
          fromName: campaign.from_name,
          replyTo: campaign.reply_to,
          subject,
          textBody: body.text,
        });
      } catch (error) {
        await releaseDailySendSlot(dailySlot.reservation);
        throw error;
      }

      const sentAt = new Date();

      if (result.status === "sent") {
        trackedContacts[contactIndex] = {
          ...contact,
          brevo_message_id: result.providerMessageId,
          email_subject: subject,
          follow_up_count: Number(contact.follow_up_count) || 0,
          last_follow_up_at:
            typeof contact.last_follow_up_at === "string"
              ? contact.last_follow_up_at
              : null,
          last_message_id: result.rfcMessageId,
          mail_error: null,
          mail_sent: "success",
          mail_sent_at: sentAt.toISOString(),
          rfc_message_id: result.rfcMessageId,
          thread_root_message_id: result.rfcMessageId,
        };
      } else if (result.status === "skipped") {
        await releaseDailySendSlot(dailySlot.reservation);
        blockedReason = result.reason;
        failureReasons.push(result.reason);
        trackedContacts[contactIndex] = {
          ...contact,
          mail_error: result.reason,
        };
        await saveCampaignContacts(campaignId, trackedContacts);
        break;
      } else {
        await releaseDailySendSlot(dailySlot.reservation);
        failureReasons.push(result.reason);
        trackedContacts[contactIndex] = {
          ...contact,
          email_subject: subject,
          mail_error: result.reason,
          mail_sent: "failed",
          mail_sent_at: sentAt.toISOString(),
        };
      }

      await recordInitialCampaignMessage({
        body: body.html,
        campaignId,
        contact,
        errorMessage: result.reason || null,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        rfcMessageId: result.rfcMessageId,
        sentAt,
        status: result.status === "sent" ? "sent" : "failed",
        subject,
      });
      await saveCampaignContacts(campaignId, trackedContacts);

      if (index < contactsToSend.length - 1) {
        await waitForRateLimit(deliverySettings.speedLimitPerMinute);
      }
    }

    const wasCancelled = await isCampaignCancelled(campaignId);
    const progress = readContactProgress(trackedContacts);
    const sent = progress.success;
    const failed = progress.failed;
    const skipped = 0;
    const nextBatchAt =
      !wasCancelled && (dailyLimitReached || (!blockedReason && progress.pending > 0))
        ? readNextBatchDate(campaign.schedule_date, startedAt)
        : null;
    const finalStatus = wasCancelled
      ? "cancelled"
      : dailyLimitReached
        ? "scheduled"
      : blockedReason
        ? "failed"
      : nextBatchAt
        ? "scheduled"
        : failed > 0
          ? "failed"
          : "sent";
    const errorMessage =
      finalStatus === "cancelled"
        ? "Campaign stopped by user."
        : dailyLimitReached
          ? null
        : blockedReason
          ? `Campaign stopped before sending more emails: ${blockedReason}`
        : finalStatus === "scheduled"
          ? null
        : finalStatus === "failed"
        ? `Sent ${sent}, failed ${failed}, pending ${progress.pending}.`
        : null;
    const failureReason =
      finalStatus === "cancelled"
        ? "Campaign was stopped manually before sending completed."
        : dailyLimitReached
          ? blockedReason
        : blockedReason
          ? blockedReason
        : finalStatus === "scheduled"
          ? null
        : finalStatus === "failed"
        ? formatFailureReason(
            [...failureReasons, ...readContactFailureReasons(trackedContacts)],
            contacts.length,
          )
        : null;

    await query<ResultSetHeader>(
      `UPDATE campaign
      SET
        customers = ?,
        recipient_count = ?,
        sent_count = ?,
        failed_count = ?,
        sending_count = ?,
        pending_count = ?,
        is_schedule = ?,
        schedule_date = ?,
        send_status = ?,
        sent_at = ?,
        send_error = ?,
        failure_reason = ?
      WHERE id = ?`,
      [
        JSON.stringify(trackedContacts),
        progress.total,
        progress.success,
        progress.failed,
        progress.sending,
        progress.pending,
        Boolean(nextBatchAt),
        nextBatchAt,
        finalStatus,
        finalStatus === "sent" ? new Date() : null,
        errorMessage,
        failureReason,
        campaignId,
      ],
    );

    return {
      failed,
      sent,
      skipped,
      status: finalStatus,
      nextBatchAt,
      pending: progress.pending,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign sending failed.";

    await query<ResultSetHeader>(
      `UPDATE campaign
      SET send_status = 'failed', send_error = ?, failure_reason = ?
      WHERE id = ?`,
      [message, message, campaignId],
    );

    throw error;
  }
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

function readPendingContactIndexes(contacts: ContactRecord[]) {
  const indexes: number[] = [];

  contacts.forEach((contact, index) => {
    if (!isContactDeliveryFinished(contact)) {
      indexes.push(index);
    }
  });

  return indexes;
}

function readContactFailureReasons(contacts: ContactRecord[]) {
  return contacts
    .map((contact) => contact.mail_error)
    .filter(
      (reason): reason is string =>
        typeof reason === "string" && reason.trim().length > 0,
    )
    .map((reason) => reason.trim());
}

function isContactDeliveryFinished(contact: ContactRecord) {
  const status = readContactMailStatus(contact);
  return status === "success" || status === "failed" || status === "faild";
}

function clearContactMailStatus(contact: ContactRecord) {
  const { mail_error, mail_sent, mail_sent_at, ...rest } = contact;
  void mail_error;
  void mail_sent;
  void mail_sent_at;

  return rest as ContactRecord;
}

function resetStaleSendingContact(contact: ContactRecord) {
  return readContactMailStatus(contact) === "sending"
    ? {
        ...contact,
        mail_sent: undefined,
      }
    : contact;
}

function readNextBatchDate(scheduleDate: Date | null, startedAt: Date) {
  const anchor =
    scheduleDate && scheduleDate.getTime() <= Date.now() ? scheduleDate : startedAt;
  const nextDate = new Date(anchor.getTime());

  do {
    nextDate.setDate(nextDate.getDate() + 1);
  } while (nextDate.getTime() <= Date.now());

  return nextDate;
}

export function renderTemplateVariables(
  template: string,
  contact: ContactRecord,
  options: { escape?: boolean } = {},
) {
  const shouldEscape = options.escape ?? true;

  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = readContactValue(contact, key);
    const textValue = value == null ? "" : String(value);
    return shouldEscape ? escapeHtml(textValue) : textValue.replace(/[\r\n]+/g, " ");
  });
}

function renderEmailBody(template: string, contact: ContactRecord) {
  if (looksLikeHtml(template)) {
    const html = renderTemplateVariables(template, contact);

    return {
      html,
      text: htmlToText(html),
    };
  }

  const text = renderTemplateVariables(template, contact, { escape: false });

  return {
    html: plainTextToHtml(text),
    text,
  };
}

async function sendOneEmail(input: SendOneEmailInput) {
  const result = await sendInitialCampaignEmail(
    {
      displayName: readDisplayName(input.contact),
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      htmlBody: input.htmlBody,
      replyTo: input.replyTo,
      subject: input.subject,
      textBody: input.textBody,
      toEmail: input.contact.email,
    },
    input.deliverySettings,
  );

  if (result.status !== "sent") {
    console.error(`Email not sent to ${input.contact.email}: ${result.reason}`);
  }

  return result;
}

async function recordInitialCampaignMessage(input: {
  body: string;
  campaignId: number;
  contact: ContactRecord;
  errorMessage: string | null;
  provider: "brevo_api" | "brevo_smtp";
  providerMessageId: string | null;
  rfcMessageId: string | null;
  sentAt: Date;
  status: "sent" | "failed";
  subject: string;
}) {
  try {
    await insertCampaignMessage({
      body: input.body,
      businessName: readBusinessName(input.contact),
      campaignId: input.campaignId,
      customerEmail: input.contact.email,
      customerUniqueId: readCustomerKey(input.contact),
      errorMessage: input.errorMessage,
      failedAt: input.status === "failed" ? input.sentAt : null,
      messageType: "initial",
      provider: input.provider,
      providerMessageId: input.providerMessageId,
      rfcMessageId: input.rfcMessageId,
      sentAt: input.status === "sent" ? input.sentAt : null,
      status: input.status,
      subject: input.subject,
      threadRootMessageId: input.rfcMessageId,
    });
  } catch (error) {
    console.error(
      `Initial campaign message record could not be saved: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

async function waitForRateLimit(speedLimitPerMinute: number) {
  if (speedLimitPerMinute < 1) {
    return;
  }

  const delayMs = Math.ceil(60_000 / speedLimitPerMinute);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function formatFailureReason(reasons: string[], totalContacts: number) {
  const uniqueReasons = Array.from(new Set(reasons.filter(Boolean)));

  if (uniqueReasons.length === 0) {
    return `Campaign failed before any email was sent. Total valid recipients: ${totalContacts}.`;
  }

  return uniqueReasons.slice(0, 20).join("\n");
}

function plainTextToHtml(value: string) {
  const escapedText = escapeHtml(value).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>',
  );

  return `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${escapedText.replace(
    /\r\n|\r|\n/g,
    "<br />",
  )}</div>`;
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function summarizeProviderError(details: string) {
  if (!details.trim()) {
    return "The email provider returned an error without details.";
  }

  try {
    const parsed = JSON.parse(details) as unknown;

    if (parsed && typeof parsed === "object") {
      const data = parsed as Record<string, unknown>;
      const message = data.message || data.error || data.code;

      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    }
  } catch {
    // Plain text provider responses are handled below.
  }

  return details.trim().slice(0, 1000);
}

async function isCampaignCancelled(campaignId: number) {
  const rows = await query<CampaignStatusRow[]>(
    "SELECT send_status FROM campaign WHERE id = ? LIMIT 1",
    [campaignId],
  );

  return rows[0]?.send_status === "cancelled";
}

function readContactValue(contact: ContactRecord, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, contact);
}

function readDisplayName(contact: ContactRecord) {
  const value = contact.name || contact.business_name;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
