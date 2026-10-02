import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";
import { databaseError, ValidationError } from "../../../../../lib/api-response";
import { clearScheduledCampaignSend } from "../../../../../lib/campaign-scheduler";
import { query } from "../../../../../lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const id = await readCampaignId(context);
    clearScheduledCampaignSend(id);

    const result = await query<ResultSetHeader>(
      `UPDATE campaign
      SET
        send_status = 'cancelled',
        send_error = 'Campaign stopped by user.',
        failure_reason = 'Campaign was stopped manually before sending completed.'
      WHERE id = ?
        AND send_status IN ('pending', 'scheduled', 'sending')`,
      [id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Only running or scheduled campaigns can be stopped." },
        { status: 409 },
      );
    }

    return NextResponse.json({ message: "Campaign stopped successfully." });
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
