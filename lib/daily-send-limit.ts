import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { query, withTransaction } from "./db";

export type DailySendReservation = {
  sendDate: string;
};

type DailyUsageRow = RowDataPacket & {
  sent_count: number;
};

export type DailySendSlotResult =
  | {
      allowed: true;
      limit: number;
      remainingAfterReservation: number | null;
      reservation: DailySendReservation | null;
      sendDate: string;
      sentCount: number;
    }
  | {
      allowed: false;
      limit: number;
      reason: string;
      reservation: null;
      sendDate: string;
      sentCount: number;
    };

export async function reserveDailySendSlot(
  limit: number,
  timeZone: string,
): Promise<DailySendSlotResult> {
  const sendDate = readDailySendDate(timeZone);

  if (limit < 1) {
    return {
      allowed: true,
      limit,
      remainingAfterReservation: null,
      reservation: null,
      sendDate,
      sentCount: 0,
    };
  }

  return withTransaction(async (connection) => {
    await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO email_send_daily_usage (send_date, sent_count)
      VALUES (?, 0)`,
      [sendDate],
    );

    const [rows] = await connection.execute<DailyUsageRow[]>(
      `SELECT sent_count
      FROM email_send_daily_usage
      WHERE send_date = ?
      FOR UPDATE`,
      [sendDate],
    );
    const sentCount = Number(rows[0]?.sent_count || 0);

    if (sentCount >= limit) {
      return {
        allowed: false,
        limit,
        reason: `Daily sending limit reached for ${sendDate}. Sent ${sentCount} of ${limit}.`,
        reservation: null,
        sendDate,
        sentCount,
      };
    }

    const nextSentCount = sentCount + 1;

    await connection.execute<ResultSetHeader>(
      `UPDATE email_send_daily_usage
      SET sent_count = ?
      WHERE send_date = ?`,
      [nextSentCount, sendDate],
    );

    return {
      allowed: true,
      limit,
      remainingAfterReservation: Math.max(limit - nextSentCount, 0),
      reservation: { sendDate },
      sendDate,
      sentCount: nextSentCount,
    };
  });
}

export async function releaseDailySendSlot(reservation: DailySendReservation | null) {
  if (!reservation) {
    return;
  }

  await withTransaction(async (connection) => {
    await connection.execute<ResultSetHeader>(
      `UPDATE email_send_daily_usage
      SET sent_count = GREATEST(sent_count - 1, 0)
      WHERE send_date = ?`,
      [reservation.sendDate],
    );
  });
}

export async function readDailySendUsage(limit: number, timeZone: string) {
  const sendDate = readDailySendDate(timeZone);
  const rows = await query<DailyUsageRow[]>(
    `SELECT sent_count
    FROM email_send_daily_usage
    WHERE send_date = ?
    LIMIT 1`,
    [sendDate],
  );
  const sentCount = Number(rows[0]?.sent_count || 0);

  return {
    limit,
    remaining: limit > 0 ? Math.max(limit - sentCount, 0) : null,
    sendDate,
    sentCount,
  };
}

export function readDailySendDate(timeZone: string, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = values.get("year");
    const month = values.get("month");
    const day = values.get("day");

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through to UTC if the configured time zone is invalid.
  }

  return date.toISOString().slice(0, 10);
}
