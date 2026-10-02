import { NextResponse } from "next/server";
import { decodeCustomerRouteId } from "../../../../../../../lib/customer-route-id";
import {
  assertSameOriginRequest,
  AuthenticationError,
  CsrfError,
  requireApiSession,
} from "../../../../../../../lib/api-auth";
import { databaseError, ValidationError } from "../../../../../../../lib/api-response";
import {
  appendReference,
  createRfcMessageId,
  ensureReSubject,
  insertCampaignMessage,
  loadCampaignCustomer,
  normalizeMailStatus,
  readBusinessName,
  readCustomerKey,
  readParentMessageId,
  readReferencesHeader,
  readThreadRootMessageId,
  sanitizePlainTextMessage,
  updateCampaignMessage,
  updateCustomerAfterFollowUp,
  validateRfcMessageId,
} from "../../../../../../../lib/campaign-email-messages";
import { readEmailDeliverySettings } from "../../../../../../../lib/email-settings";
import {
  hasSmtpSettings,
  plainTextToHtml,
  sendInitialCampaignEmail,
  sendThreadedFollowUpEmail,
} from "../../../../../../../lib/mail-transport";
import { checkRateLimit } from "../../../../../../../lib/rate-limit";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 5000;

type RouteContext = {
  params: Promise<{
    customerId: string;
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let messageRecordId: number | null = null;

  try {
    const session = await requireApiSession();
    await assertSameOriginRequest(request);

    const { campaignId, customerId } = await readRouteParams(context);
    const rateLimit = checkRateLimit(
      `follow-up:${session.userId}:${campaignId}:${customerId}`,
      { limit: 5, windowMs: 10 * 60 * 1000 },
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          message: `Too many follow-up attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
        },
        { status: 429 },
      );
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const message = validateMessage(payload.message);
    const loaded = await loadCampaignCustomer(campaignId, customerId);

    if (!loaded) {
      return NextResponse.json(
        { message: "Campaign customer not found." },
        { status: 404 },
      );
    }

    const status = normalizeMailStatus(loaded.contact.mail_sent);
    const originalSubject =
      typeof loaded.contact.email_subject === "string" && loaded.contact.email_subject.trim()
        ? loaded.contact.email_subject.trim()
        : loaded.campaign.subject;
    const settings = await readEmailDeliverySettings();
    const shouldSendThreaded = hasSmtpSettings(settings);
    const threadRootMessageId = shouldSendThreaded
      ? readThreadRootMessageId(loaded.contact)
      : "";
    const parentMessageId = shouldSendThreaded ? readParentMessageId(loaded.contact) : "";

    if (status !== "sent") {
      throw new ValidationError(
        "Follow-up is available only after the original email was sent successfully.",
      );
    }

    if (!originalSubject) {
      throw new ValidationError("Original email subject is missing.");
    }

    if (shouldSendThreaded && (!threadRootMessageId || !parentMessageId)) {
      throw new ValidationError(
        "Original RFC Message-ID is missing, so a threaded follow-up cannot be sent.",
      );
    }

    if (
      shouldSendThreaded &&
      (!validateRfcMessageId(threadRootMessageId) || !validateRfcMessageId(parentMessageId))
    ) {
      throw new ValidationError("Stored RFC Message-ID is invalid.");
    }

    const subject = ensureReSubject(originalSubject);
    const fromEmail = loaded.campaign.from_email || settings.defaultFromEmail;
    const fromName = loaded.campaign.from_name || settings.defaultFromName || fromEmail;
    const newMessageId = createRfcMessageId(fromEmail);
    const referencesForThisMessage = shouldSendThreaded
      ? appendReference(
          readReferencesHeader(loaded.contact) || threadRootMessageId,
          parentMessageId,
        )
      : "";
    const sentAt = new Date();

    messageRecordId = await insertCampaignMessage({
      body: message,
      businessName: readBusinessName(loaded.contact),
      campaignId,
      customerEmail: loaded.contact.email,
      customerUniqueId: readCustomerKey(loaded.contact),
      messageType: "follow_up",
      parentMessageId: parentMessageId || null,
      provider: shouldSendThreaded ? "brevo_smtp" : "brevo_api",
      referencesHeader: referencesForThisMessage || null,
      rfcMessageId: shouldSendThreaded ? newMessageId : null,
      status: "pending",
      subject,
      threadRootMessageId: threadRootMessageId || null,
    });

    const emailInput = {
      displayName: readBusinessName(loaded.contact),
      fromEmail,
      fromName,
      htmlBody: plainTextToHtml(message),
      replyTo: loaded.campaign.reply_to,
      subject,
      textBody: message,
      toEmail: loaded.contact.email,
    };
    const result = shouldSendThreaded
      ? await sendThreadedFollowUpEmail(
          {
            ...emailInput,
            inReplyTo: parentMessageId,
            messageId: newMessageId,
            references: referencesForThisMessage,
          },
          settings,
        )
      : await sendInitialCampaignEmail(emailInput, settings);

    if (result.status !== "sent") {
      await updateCampaignMessage(messageRecordId, {
        errorMessage: result.reason,
        failedAt: sentAt,
        providerMessageId: result.providerMessageId,
        status: "failed",
      });

      return NextResponse.json({ message: result.reason }, { status: 502 });
    }

    const savedMessageId = result.rfcMessageId || (shouldSendThreaded ? newMessageId : "");
    const referencesForNextMessage = shouldSendThreaded
      ? appendReference(referencesForThisMessage, savedMessageId)
      : savedMessageId;

    await updateCampaignMessage(messageRecordId, {
      providerMessageId: result.providerMessageId,
      rfcMessageId: result.rfcMessageId,
      sentAt,
      status: "sent",
    });
    await updateCustomerAfterFollowUp(campaignId, customerId, {
      lastFollowUpAt: sentAt,
      lastMessageId: savedMessageId,
      referencesHeader: referencesForNextMessage,
    });

    return NextResponse.json({
      message: "Follow-up sent successfully.",
      sentAt,
    });
  } catch (error) {
    if (messageRecordId) {
      await updateCampaignMessage(messageRecordId, {
        errorMessage: error instanceof Error ? error.message : "Follow-up failed.",
        failedAt: new Date(),
        status: "failed",
      }).catch(() => undefined);
    }

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof CsrfError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
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

function validateMessage(value: unknown) {
  if (typeof value !== "string") {
    throw new ValidationError("Follow-up message is required.");
  }

  const message = sanitizePlainTextMessage(value);

  if (!message) {
    throw new ValidationError("Follow-up message is required.");
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError(
      `Follow-up message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    );
  }

  return message;
}
