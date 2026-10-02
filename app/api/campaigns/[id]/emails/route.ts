import { NextResponse } from "next/server";
import { AuthenticationError, requireApiSession } from "../../../../../lib/api-auth";
import { databaseError, ValidationError } from "../../../../../lib/api-response";
import { readCampaignEmailList } from "../../../../../lib/campaign-email-messages";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireApiSession();
    const campaignId = await readCampaignId(context);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || 1);
    const limit = Number(url.searchParams.get("limit") || 50);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const result = await readCampaignEmailList(campaignId, {
      limit,
      page,
      search,
      status,
    });

    if (!result) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return databaseError(error);
  }
}

async function readCampaignId(context: RouteContext) {
  const { id: campaignId } = await context.params;
  const id = Number(campaignId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("Campaign id is invalid.");
  }

  return id;
}
