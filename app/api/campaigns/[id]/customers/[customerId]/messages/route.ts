import { NextResponse } from "next/server";
import { AuthenticationError, requireApiSession } from "../../../../../../../lib/api-auth";
import { databaseError, ValidationError } from "../../../../../../../lib/api-response";
import { readCampaignCustomerMessages } from "../../../../../../../lib/campaign-email-messages";
import { decodeCustomerRouteId } from "../../../../../../../lib/customer-route-id";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    customerId: string;
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireApiSession();
    const { campaignId, customerId } = await readRouteParams(context);
    const result = await readCampaignCustomerMessages(campaignId, customerId);

    if (!result) {
      return NextResponse.json(
        { message: "Campaign customer not found." },
        { status: 404 },
      );
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

async function readRouteParams(context: RouteContext) {
  const { customerId, id: campaignId } = await context.params;
  const id = Number(campaignId);
  const decodedCustomerId = decodeCustomerRouteId(customerId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("Campaign id is invalid.");
  }

  if (!decodedCustomerId.trim()) {
    throw new ValidationError("Customer id is required.");
  }

  return {
    campaignId: id,
    customerId: decodedCustomerId,
  };
}
