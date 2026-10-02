import nodemailer from "nodemailer";
import type { EmailDeliverySettings } from "./email-settings";
import { createRfcMessageId, validateRfcMessageId } from "./campaign-email-messages";

export type SentEmailResult =
  | {
      provider: "brevo_api" | "brevo_smtp";
      providerMessageId: string | null;
      reason: "";
      rfcMessageId: string | null;
      status: "sent";
    }
  | {
      provider: "brevo_api" | "brevo_smtp";
      providerMessageId: string | null;
      reason: string;
      rfcMessageId: string | null;
      status: "failed" | "skipped";
    };

export type CampaignEmailInput = {
  displayName?: string;
  fromEmail: string;
  fromName: string;
  htmlBody: string;
  replyTo: string | null;
  subject: string;
  textBody: string;
  toEmail: string;
};

export type FollowUpEmailInput = CampaignEmailInput & {
  inReplyTo: string;
  messageId: string;
  references: string;
};

export async function sendInitialCampaignEmail(
  input: CampaignEmailInput,
  settings: EmailDeliverySettings,
): Promise<SentEmailResult> {
  if (hasSmtpSettings(settings)) {
    return sendBrevoSmtpEmail(
      {
        ...input,
        messageId: createRfcMessageId(input.fromEmail),
      },
      settings,
    );
  }

  return sendBrevoApiEmail(input, settings);
}

export async function sendThreadedFollowUpEmail(
  input: FollowUpEmailInput,
  settings: EmailDeliverySettings,
): Promise<SentEmailResult> {
  if (!hasSmtpSettings(settings)) {
    return {
      provider: "brevo_smtp",
      providerMessageId: null,
      reason:
        "Brevo SMTP credentials are required for threaded follow-ups because Brevo API does not support standard In-Reply-To and References headers.",
      rfcMessageId: input.messageId,
      status: "failed",
    };
  }

  return sendBrevoSmtpEmail(input, settings);
}

export function hasSmtpSettings(settings: EmailDeliverySettings) {
  return Boolean(settings.smtpHost && settings.smtpUser && settings.smtpPassword);
}

async function sendBrevoApiEmail(
  input: CampaignEmailInput,
  settings: EmailDeliverySettings,
): Promise<SentEmailResult> {
  const apiKey = settings.apiKey;

  if (!apiKey) {
    return {
      provider: "brevo_api",
      providerMessageId: null,
      reason:
        "BREVO_API_KEY is not configured, so the email provider could not send this campaign.",
      rfcMessageId: null,
      status: "skipped",
    };
  }

  const quota = await verifyBrevoCanSendTransactionalEmail(settings);

  if (!quota.allowed) {
    return {
      provider: "brevo_api",
      providerMessageId: null,
      reason: quota.reason,
      rfcMessageId: null,
      status: "skipped",
    };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      htmlContent: input.htmlBody,
      replyTo: input.replyTo ? { email: input.replyTo } : undefined,
      sender: {
        email: input.fromEmail,
        name: input.fromName,
      },
      subject: input.subject,
      textContent: input.textBody,
      to: [
        {
          email: input.toEmail,
          name: input.displayName,
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    return {
      provider: "brevo_api",
      providerMessageId: null,
      reason: `Brevo rejected ${input.toEmail}: ${summarizeProviderError(details)}`,
      rfcMessageId: null,
      status: "failed",
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    messageId?: string;
  };

  return {
    provider: "brevo_api",
    providerMessageId: payload.messageId || null,
    reason: "",
    rfcMessageId: readProviderRfcMessageId(payload.messageId),
    status: "sent",
  };
}

async function sendBrevoSmtpEmail(
  input: CampaignEmailInput & {
    inReplyTo?: string;
    messageId: string;
    references?: string;
  },
  settings: EmailDeliverySettings,
): Promise<SentEmailResult> {
  const quota = await verifyBrevoCanSendTransactionalEmail(settings);

  if (!quota.allowed) {
    return {
      provider: "brevo_smtp",
      providerMessageId: null,
      reason: quota.reason,
      rfcMessageId: input.messageId,
      status: "skipped",
    };
  }

  const transporter = nodemailer.createTransport({
    auth: {
      pass: settings.smtpPassword,
      user: settings.smtpUser,
    },
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
  });

  try {
    const info = await transporter.sendMail({
      from: {
        address: input.fromEmail,
        name: input.fromName,
      },
      headers: {
        ...(input.inReplyTo ? { "In-Reply-To": input.inReplyTo } : {}),
        ...(input.references ? { References: input.references } : {}),
      },
      html: input.htmlBody,
      inReplyTo: input.inReplyTo,
      messageId: input.messageId,
      references: input.references ? input.references.split(/\s+/).filter(Boolean) : undefined,
      replyTo: input.replyTo || undefined,
      subject: input.subject,
      text: input.textBody,
      to: {
        address: input.toEmail,
        name: input.displayName || "",
      },
    });

    return {
      provider: "brevo_smtp",
      providerMessageId: info.messageId || null,
      reason: "",
      rfcMessageId: input.messageId,
      status: "sent",
    };
  } catch (error) {
    return {
      provider: "brevo_smtp",
      providerMessageId: null,
      reason: error instanceof Error ? error.message : "Brevo SMTP send failed.",
      rfcMessageId: input.messageId,
      status: "failed",
    };
  } finally {
    transporter.close();
  }
}

export async function verifyBrevoCanSendTransactionalEmail(
  settings: EmailDeliverySettings,
) {
  if (!settings.requireBrevoCreditCheck) {
    return {
      allowed: true,
      reason: "",
    };
  }

  if (!settings.apiKey) {
    return {
      allowed: false,
      reason:
        "BREVO_API_KEY is required to verify Brevo remaining credits before sending.",
    };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/account", {
      headers: {
        accept: "application/json",
        "api-key": settings.apiKey,
      },
    });

    if (!response.ok) {
      const details = await response.text();
      return {
        allowed: false,
        reason: `Brevo credit check failed: ${summarizeProviderError(details)}`,
      };
    }

    const account = (await response.json()) as unknown;
    const relayStatus = readRelayStatus(account);

    if (relayStatus === false) {
      return {
        allowed: false,
        reason: "Brevo transactional relay is disabled for this account.",
      };
    }

    const remainingCredits = readRemainingEmailCredits(account);

    if (remainingCredits == null) {
      return {
        allowed: false,
        reason:
          "Brevo remaining email credits could not be verified. Sending was stopped to avoid false success records.",
      };
    }

    if (remainingCredits <= 0) {
      return {
        allowed: false,
        reason:
          "Brevo reports 0 remaining email credits. Sending was stopped before contacting more recipients.",
      };
    }

    return {
      allowed: true,
      reason: "",
    };
  } catch (error) {
    return {
      allowed: false,
      reason:
        error instanceof Error
          ? `Brevo credit check failed: ${error.message}`
          : "Brevo credit check failed before sending.",
    };
  }
}

export function plainTextToHtml(value: string) {
  const escapedText = escapeHtml(value).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>',
  );

  return `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${escapedText.replace(
    /\r\n|\r|\n/g,
    "<br />",
  )}</div>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function readRelayStatus(value: unknown): boolean | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const relay = (value as Record<string, unknown>).relay;

  if (!relay || typeof relay !== "object" || Array.isArray(relay)) {
    return null;
  }

  const enabled = (relay as Record<string, unknown>).enabled;
  return typeof enabled === "boolean" ? enabled : null;
}

function readRemainingEmailCredits(value: unknown) {
  const planCredits = readPlanSendLimitCredits(value);

  if (planCredits != null) {
    return planCredits;
  }

  const candidates = readRemainingCandidates(value, "");

  if (candidates.length === 0) {
    return null;
  }

  const relevantCandidates = candidates.filter((candidate) =>
    /email|mail|smtp|transaction|relay|plan|credit|send/i.test(candidate.path),
  );
  const usableCandidates = relevantCandidates.length > 0 ? relevantCandidates : candidates;
  const unlimited = usableCandidates.some((candidate) => candidate.value < 0);

  if (unlimited) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(...usableCandidates.map((candidate) => candidate.value));
}

function readPlanSendLimitCredits(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const plan = (value as Record<string, unknown>).plan;

  if (!Array.isArray(plan)) {
    return null;
  }

  const credits = plan
    .map((item) => readPlanCreditValue(item))
    .filter((item): item is number => item != null);

  if (credits.length === 0) {
    return null;
  }

  return Math.max(...credits);
}

function readPlanCreditValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const plan = value as Record<string, unknown>;
  const creditsType = typeof plan.creditsType === "string" ? plan.creditsType : "";

  if (!/send|email|mail|transaction/i.test(creditsType)) {
    return null;
  }

  return typeof plan.credits === "number" ? plan.credits : null;
}

function readProviderRfcMessageId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const messageId = value.trim();
  return validateRfcMessageId(messageId) ? messageId : null;
}

function readRemainingCandidates(
  value: unknown,
  path: string,
): Array<{ path: string; value: number }> {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      readRemainingCandidates(item, `${path}[${index}]`),
    );
  }

  const record = value as Record<string, unknown>;
  const candidates: Array<{ path: string; value: number }> = [];

  for (const [key, item] of Object.entries(record)) {
    const itemPath = path ? `${path}.${key}` : key;

    if (key.toLowerCase() === "remaining" && typeof item === "number") {
      candidates.push({
        path: itemPath,
        value: item,
      });
    } else if (item && typeof item === "object") {
      candidates.push(...readRemainingCandidates(item, itemPath));
    }
  }

  return candidates;
}
