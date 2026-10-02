import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";
import { databaseError, ValidationError } from "../../../../lib/api-response";
import { clearScheduledCampaignSend } from "../../../../lib/campaign-scheduler";
import { query } from "../../../../lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = await readCampaignId(context);
    const payload = (await request.json()) as Record<string, unknown>;
    const name = typeof payload.name === "string" ? payload.name.trim() : "";

    if (!name) {
      throw new ValidationError("Campaign name is required.");
    }

    const result = await query<ResultSetHeader>(
      "UPDATE campaign SET name = ? WHERE id = ?",
      [name, id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Campaign name updated successfully." });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return databaseError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const id = await readCampaignId(context);
    clearScheduledCampaignSend(id);

    const result = await query<ResultSetHeader>("DELETE FROM campaign WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Campaign deleted successfully." });
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
