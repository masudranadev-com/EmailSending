import { readFile } from "node:fs/promises";
import path from "node:path";

type EnvValues = Record<string, string>;

export type EmailDeliverySettings = {
  apiKey: string;
  apiKeyName: string;
  apiKeyPreview: string;
  dailySendingLimit: number;
  dailySendingLimitRaw: string;
  dailySendingTimeZone: string;
  defaultFromEmail: string;
  defaultFromName: string;
  messageIdDomain: string;
  provider: string;
  requireBrevoCreditCheck: boolean;
  speedLimitPerMinute: number;
  speedLimitPerMinuteRaw: string;
  smtpHost: string;
  smtpPassword: string;
  smtpPasswordPreview: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
};

export async function readEmailDeliverySettings() {
  const env = {
    ...process.env,
    ...(await readEnvFile()),
  } as EnvValues;
  const apiKey = env.BREVO_API_KEY || env.SENDINBLUE_API_KEY || "";
  const speedLimitPerMinuteRaw = env.SPEED_LIMIT_PER_MINUTE || "";
  const dailySendingLimitRaw = env.DAILY_SENDING_LIMIT || "";
  const smtpPort = readPositiveInteger(env.BREVO_SMTP_PORT || "", 587);

  return {
    apiKey,
    apiKeyName: env.BREVO_API_KEY
      ? "BREVO_API_KEY"
      : env.SENDINBLUE_API_KEY
        ? "SENDINBLUE_API_KEY"
        : "BREVO_API_KEY",
    apiKeyPreview: maskSecret(apiKey),
    dailySendingLimit: readPositiveInteger(dailySendingLimitRaw, 0),
    dailySendingLimitRaw,
    dailySendingTimeZone: env.DAILY_SENDING_TIME_ZONE || env.TZ || "Asia/Dhaka",
    defaultFromEmail: env.DEFAULT_FROM_EMAIL || "",
    defaultFromName: env.DEFAULT_FROM_NAME || "",
    messageIdDomain: env.MESSAGE_ID_DOMAIN || "",
    provider: env.EMAIL_PROVIDER || "Brevo API",
    requireBrevoCreditCheck: env.BREVO_REQUIRE_CREDIT_CHECK !== "false",
    speedLimitPerMinute: readPositiveInteger(speedLimitPerMinuteRaw, 0),
    speedLimitPerMinuteRaw,
    smtpHost: env.BREVO_SMTP_HOST || "",
    smtpPassword: env.BREVO_SMTP_PASSWORD || "",
    smtpPasswordPreview: maskSecret(env.BREVO_SMTP_PASSWORD || ""),
    smtpPort,
    smtpSecure: smtpPort === 465 || env.BREVO_SMTP_SECURE === "true",
    smtpUser: env.BREVO_SMTP_USER || "",
  };
}

async function readEnvFile() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const envText = await readFile(envPath, "utf8");
    const values: EnvValues = {};

    for (const line of envText.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

      values[key] = unwrapEnvValue(rawValue);
    }

    return values;
  } catch {
    return {};
  }
}

function readPositiveInteger(value: string, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function unwrapEnvValue(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function maskSecret(value: string) {
  if (!value) {
    return "Not set";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}...${value.slice(-2)}`;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
