import { NextResponse } from "next/server";
import { readDailySendUsage } from "../../../../lib/daily-send-limit";
import { readEmailDeliverySettings } from "../../../../lib/email-settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await readEmailDeliverySettings();
    const dailySendingUsage = await readDailySendUsage(
      settings.dailySendingLimit,
      settings.dailySendingTimeZone,
    );

    return NextResponse.json({
      smtp: {
        apiKeyConfigured: settings.apiKey.length > 0,
        apiKeyName: settings.apiKeyName,
        apiKeyPreview: settings.apiKeyPreview,
        dailySendingLimit: settings.dailySendingLimitRaw,
        dailySendingTimeZone: settings.dailySendingTimeZone,
        dailySendingUsage,
        provider: settings.provider,
        speedLimitPerMinute: settings.speedLimitPerMinuteRaw,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "SMTP settings could not be loaded.",
      },
      { status: 500 },
    );
  }
}
