import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { databaseError } from "../../../../lib/api-response";
import { startCampaignSend } from "../../../../lib/campaign-sending";
import { query } from "../../../../lib/db";

export const runtime = "nodejs";

type DueCampaignRow = RowDataPacket & {
  id: number;
};

export async function GET() {
  return sendDueCampaigns();
}

export async function POST() {
  return sendDueCampaigns();
}

async function sendDueCampaigns() {
  try {
    const dueCampaigns = await query<DueCampaignRow[]>(
      `SELECT id
      FROM campaign
      WHERE (
          is_schedule = TRUE
          AND schedule_date <= NOW()
          AND send_status = 'scheduled'
        )
        OR (
          is_schedule = FALSE
          AND send_status = 'pending'
        )
      ORDER BY schedule_date ASC, id ASC
      LIMIT 25`,
    );

    for (const campaign of dueCampaigns) {
      startCampaignSend(campaign.id);
    }

    return NextResponse.json({
      checkedCount: dueCampaigns.length,
      startedCampaignIds: dueCampaigns.map((campaign) => campaign.id),
    });
  } catch (error) {
    return databaseError(error);
  }
}
