import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  ContactValidationError,
  insertUniqueContacts,
  parseAndNormalizeContacts,
} from "../../../lib/campaign-contacts";
import { databaseError, ValidationError } from "../../../lib/api-response";
import { scheduleCampaignSend } from "../../../lib/campaign-scheduler";
import { startCampaignSend } from "../../../lib/campaign-sending";
import { query } from "../../../lib/db";
import { readEmailDeliverySettings } from "../../../lib/email-settings";

export const runtime = "nodejs";

type CampaignSendStatus =
  | "pending"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

type CampaignRow = RowDataPacket & {
  id: number;
  name: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  sending_count: number;
  pending_count: number;
  template_id: number | null;
  template_name: string | null;
  subject: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  is_schedule: 0 | 1 | boolean;
  schedule_date: Date | null;
  send_status: CampaignSendStatus;
  sent_at: Date | null;
  send_error: string | null;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

type TemplateExistsRow = RowDataPacket & {
  id: number;
};

type CampaignPayload = {
  campaignName: string;
  contactsJson: string;
  emailSubject: string;
  fromEmail: string;
  fromName: string;
  isUnique: boolean;
  replyTo: string;
  scheduleAt: string;
  sendMode: "now" | "scheduled";
  templateId: number;
};

export async function GET() {
  try {
    const campaigns = await query<CampaignRow[]>(
      `SELECT
        c.id,
        c.name,
        c.recipient_count,
        c.sent_count,
        c.failed_count,
        c.sending_count,
        c.pending_count,
        c.template_id,
        t.name AS template_name,
        c.subject,
        c.from_name,
        c.from_email,
        c.reply_to,
        c.is_schedule,
        c.schedule_date,
        c.send_status,
        c.sent_at,
        c.send_error,
        c.failure_reason,
        c.created_at,
        c.updated_at
      FROM campaign c
      LEFT JOIN templates t ON t.id = c.template_id
      ORDER BY c.created_at DESC, c.id DESC`,
    );
    const deliverySettings = await readEmailDeliverySettings();
    const mappedCampaigns = campaigns.map((campaign) =>
      mapCampaignRow(campaign, deliverySettings.dailySendingLimit),
    );
    const stats = {
      audienceContacts: mappedCampaigns.reduce(
        (sum, campaign) => sum + campaign.recipientCount,
        0,
      ),
      cancelled: mappedCampaigns.filter((campaign) => campaign.status === "cancelled")
        .length,
      running: mappedCampaigns.filter((campaign) => campaign.status === "running").length,
      scheduled: mappedCampaigns.filter((campaign) => campaign.status === "scheduled")
        .length,
      total: mappedCampaigns.length,
    };

    return NextResponse.json({
      campaigns: mappedCampaigns,
      stats,
    });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = validateCampaignPayload(await request.json());
    const { contacts, duplicateCount, invalidCount } = parseAndNormalizeContacts(
      payload.contactsJson,
    );

    await assertTemplateExists(payload.templateId);

    const isScheduled = payload.sendMode === "scheduled";
    const scheduleDate = isScheduled ? readScheduleDate(payload.scheduleAt) : null;
    const result = await query<ResultSetHeader>(
      `INSERT INTO campaign (
        name,
        customers,
        recipient_count,
        sent_count,
        failed_count,
        sending_count,
        pending_count,
        template_id,
        subject,
        from_name,
        from_email,
        reply_to,
        is_schedule,
        schedule_date,
        send_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.campaignName,
        JSON.stringify(contacts),
        contacts.length,
        0,
        0,
        0,
        contacts.length,
        payload.templateId,
        payload.emailSubject,
        payload.fromName,
        payload.fromEmail,
        payload.replyTo || null,
        isScheduled,
        scheduleDate,
        isScheduled ? "scheduled" : "pending",
      ],
    );
    const campaignId = result.insertId;
    const uniqueInsertedCount = payload.isUnique ? await insertUniqueContacts(contacts) : 0;
    let scheduledInProcess = false;

    if (isScheduled && scheduleDate) {
      scheduledInProcess = scheduleCampaignSend(campaignId, scheduleDate);
    } else {
      startCampaignSend(campaignId);
    }

    return NextResponse.json(
      {
        campaignId,
        duplicateCount,
        invalidCount,
        message: isScheduled
          ? "Campaign scheduled successfully."
          : "Campaign created and immediate sending was started.",
        scheduledInProcess,
        sendResult: null,
        uniqueInsertedCount,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ContactValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return databaseError(error);
  }
}

function mapCampaignRow(row: CampaignRow, dailySendingLimit: number) {
  const progress = {
    failed: Number(row.failed_count || 0),
    pending: Number(row.pending_count || 0),
    sending: Number(row.sending_count || 0),
    success: Number(row.sent_count || 0),
    total: Number(row.recipient_count || 0),
  };
  const status = readCampaignStatus(row, progress.pending);
  const nextBatchAt =
    status === "scheduled" && progress.pending > 0 ? row.schedule_date : null;

  return {
    id: row.id,
    name: row.name,
    recipientCount: progress.total,
    dailyLimitReached: Boolean(nextBatchAt && dailySendingLimit > 0),
    dailySendingLimit,
    failureReason: row.failure_reason || row.send_error || "",
    failedCount: progress.failed,
    nextBatchAt,
    pendingCount: progress.pending,
    sendDate: row.sent_at || row.schedule_date,
    sendError: row.send_error,
    sentCount: progress.success,
    sendingCount: progress.sending,
    status,
    subject: row.subject,
    templateId: row.template_id,
    templateName: row.template_name || "Not set",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateCampaignPayload(payload: unknown): CampaignPayload {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Campaign data is required.");
  }

  const data = payload as Record<string, unknown>;
  const campaignName = readString(data.campaignName);
  const contactsJson = readString(data.contactsJson);
  const emailSubject = readString(data.emailSubject);
  const fromName = readString(data.fromName);
  const fromEmail = readString(data.fromEmail);
  const replyTo = readString(data.replyTo, false);
  const scheduleAt = readString(data.scheduleAt, false);
  const sendMode = data.sendMode === "scheduled" ? "scheduled" : "now";
  const templateId = Number(data.templateId);
  const isUnique = data.isUnique === true || data.is_unique === "true";

  if (!campaignName) {
    throw new ValidationError("Campaign name is required.");
  }

  if (!contactsJson) {
    throw new ValidationError("Contacts JSON is required.");
  }

  if (!Number.isInteger(templateId) || templateId <= 0) {
    throw new ValidationError("Template is required.");
  }

  if (!emailSubject) {
    throw new ValidationError("Email subject is required.");
  }

  if (!fromName) {
    throw new ValidationError("From name is required.");
  }

  if (!fromEmail) {
    throw new ValidationError("From email is required.");
  }

  if (sendMode === "scheduled" && !scheduleAt) {
    throw new ValidationError("Schedule date and time is required.");
  }

  return {
    campaignName,
    contactsJson,
    emailSubject,
    fromEmail,
    fromName,
    isUnique,
    replyTo,
    scheduleAt,
    sendMode,
    templateId,
  };
}

async function assertTemplateExists(templateId: number) {
  const rows = await query<TemplateExistsRow[]>(
    "SELECT id FROM templates WHERE id = ? LIMIT 1",
    [templateId],
  );

  if (!rows[0]) {
    throw new ValidationError("Template not found.");
  }
}

function readScheduleDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Schedule date and time is invalid.");
  }

  return date;
}

function readString(value: unknown, required = true) {
  if (typeof value !== "string") {
    return required ? "" : "";
  }

  return value.trim();
}

function readCampaignStatus(row: CampaignRow, pendingCount: number) {
  if (row.send_status === "sending") {
    return "running";
  }

  if (row.send_status === "scheduled" && pendingCount === 0) {
    return "sent";
  }

  if (row.send_status === "pending" && !row.is_schedule) {
    return "running";
  }

  if (row.send_status === "pending" && row.is_schedule) {
    return "scheduled";
  }

  return row.send_status;
}
