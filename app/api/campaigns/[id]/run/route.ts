import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { databaseError, ValidationError } from "../../../../../lib/api-response";
import { clearScheduledCampaignSend } from "../../../../../lib/campaign-scheduler";
import { startCampaignSend } from "../../../../../lib/campaign-sending";
import { query } from "../../../../../lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CampaignStatusRow = RowDataPacket & {
  send_status: "pending" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const id = await readCampaignId(context);
    const campaigns = await query<CampaignStatusRow[]>(
      "SELECT send_status FROM campaign WHERE id = ? LIMIT 1",
      [id],
    );
    const campaign = campaigns[0];

    if (!campaign) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    if (campaign.send_status === "sending") {
      return NextResponse.json(
        { message: "This campaign is already sending." },
        { status: 409 },
      );
    }

    clearScheduledCampaignSend(id);

    const result = await query<ResultSetHeader>(
      `UPDATE campaign
      SET
        is_schedule = FALSE,
        schedule_date = NULL,
        send_status = 'pending',
        sent_at = NULL,
        send_error = NULL,
        failure_reason = NULL
      WHERE id = ?
        AND send_status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled')`,
      [id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "This campaign cannot be started right now." },
        { status: 409 },
      );
    }

    startCampaignSend(id, { force: true });

    return NextResponse.json({
      message: "Campaign run started.",
      sendResult: null,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return databaseError(error);
  }
}

async function readCampaignId(context: RouteContext) {
  const { id } = await context.params;
  const campaignId = Number(id);

  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    throw new ValidationError("Campaign id is invalid.");
  }

  return campaignId;
}
