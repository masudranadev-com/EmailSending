import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { query } from "../../../lib/db";

export const runtime = "nodejs";

type CampaignStatus = "pending" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";

type CampaignSummaryRow = RowDataPacket & {
  total_campaigns: number;
  emails_sent: number | null;
  running_campaigns: number | null;
  scheduled_campaigns: number | null;
  failed_campaigns: number | null;
};

type CustomerSummaryRow = RowDataPacket & {
  total_customers: number;
  with_business_info: number | null;
  with_store_link: number | null;
};

type TemplateSummaryRow = RowDataPacket & {
  total_templates: number;
  active_templates: number | null;
};

type CampaignRow = RowDataPacket & {
  id: number;
  name: string;
  template_name: string | null;
  recipient_count: number;
  is_schedule: 0 | 1 | boolean;
  schedule_date: Date | null;
  send_status: CampaignStatus;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function GET() {
  try {
    const [campaignSummaryRows, customerSummaryRows, templateSummaryRows, recentRows, upcomingRows] =
      await Promise.all([
        query<CampaignSummaryRow[]>(
          `SELECT
            COUNT(*) AS total_campaigns,
            COALESCE(SUM(sent_count), 0) AS emails_sent,
            COALESCE(SUM(CASE WHEN send_status = 'sending' OR (send_status = 'pending' AND is_schedule = 0) THEN 1 ELSE 0 END), 0) AS running_campaigns,
            COALESCE(SUM(CASE WHEN send_status = 'scheduled' OR (send_status = 'pending' AND is_schedule = 1) THEN 1 ELSE 0 END), 0) AS scheduled_campaigns,
            COALESCE(SUM(CASE WHEN send_status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_campaigns
          FROM campaign`,
        ),
        query<CustomerSummaryRow[]>(
          `SELECT
            COUNT(*) AS total_customers,
            COALESCE(SUM(CASE
              WHEN JSON_UNQUOTE(JSON_EXTRACT(information, '$.business_name')) IS NOT NULL
                AND JSON_UNQUOTE(JSON_EXTRACT(information, '$.business_name')) <> ''
              THEN 1 ELSE 0 END), 0) AS with_business_info,
            COALESCE(SUM(CASE
              WHEN JSON_UNQUOTE(JSON_EXTRACT(information, '$.store_link')) IS NOT NULL
                AND JSON_UNQUOTE(JSON_EXTRACT(information, '$.store_link')) <> ''
              THEN 1 ELSE 0 END), 0) AS with_store_link
          FROM unique_emails`,
        ),
        query<TemplateSummaryRow[]>(
          `SELECT
            COUNT(*) AS total_templates,
            COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_templates
          FROM templates`,
        ),
        query<CampaignRow[]>(
          `SELECT
            c.id,
            c.name,
            t.name AS template_name,
            c.recipient_count,
            c.is_schedule,
            c.schedule_date,
            c.send_status,
            c.sent_at,
            c.created_at,
            c.updated_at
          FROM campaign c
          LEFT JOIN templates t ON t.id = c.template_id
          ORDER BY c.updated_at DESC, c.id DESC
          LIMIT 5`,
        ),
        query<CampaignRow[]>(
          `SELECT
            c.id,
            c.name,
            t.name AS template_name,
            c.recipient_count,
            c.is_schedule,
            c.schedule_date,
            c.send_status,
            c.sent_at,
            c.created_at,
            c.updated_at
          FROM campaign c
          LEFT JOIN templates t ON t.id = c.template_id
          WHERE c.is_schedule = 1
            AND c.schedule_date IS NOT NULL
            AND c.send_status IN ('pending', 'scheduled')
          ORDER BY c.schedule_date ASC, c.id ASC
          LIMIT 5`,
        ),
      ]);
    const campaignSummary = campaignSummaryRows[0] ?? {
      emails_sent: 0,
      failed_campaigns: 0,
      running_campaigns: 0,
      scheduled_campaigns: 0,
      total_campaigns: 0,
    };
    const customerSummary = customerSummaryRows[0] ?? {
      total_customers: 0,
      with_business_info: 0,
      with_store_link: 0,
    };
    const templateSummary = templateSummaryRows[0] ?? {
      active_templates: 0,
      total_templates: 0,
    };

    return NextResponse.json({
      listHealth: {
        totalCustomers: Number(customerSummary.total_customers || 0),
        withBusinessInfo: Number(customerSummary.with_business_info || 0),
        withStoreLink: Number(customerSummary.with_store_link || 0),
      },
      recentCampaigns: recentRows.map(mapCampaignRow),
      stats: {
        activeTemplates: Number(templateSummary.active_templates || 0),
        emailsSent: Number(campaignSummary.emails_sent || 0),
        failedCampaigns: Number(campaignSummary.failed_campaigns || 0),
        runningCampaigns: Number(campaignSummary.running_campaigns || 0),
        scheduledCampaigns: Number(campaignSummary.scheduled_campaigns || 0),
        totalCampaigns: Number(campaignSummary.total_campaigns || 0),
        totalCustomers: Number(customerSummary.total_customers || 0),
        totalTemplates: Number(templateSummary.total_templates || 0),
      },
      upcomingSends: upcomingRows.map(mapCampaignRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Dashboard request failed.",
      },
      { status: 500 },
    );
  }
}

function mapCampaignRow(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name,
    recipientCount: Number(row.recipient_count || 0),
    scheduleDate: row.schedule_date,
    sentAt: row.sent_at,
    status: readCampaignStatus(row),
    templateName: row.template_name || "No template",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readCampaignStatus(row: CampaignRow) {
  if (row.send_status === "sending") {
    return "running";
  }

  if (row.send_status === "pending" && !row.is_schedule) {
    return "running";
  }

  if (row.send_status === "pending" && row.is_schedule) {
    return "scheduled";
  }

  return row.send_status;
}
