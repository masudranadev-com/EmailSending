import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { query } from "../../../../lib/db";

export const runtime = "nodejs";

type HealthRow = RowDataPacket & {
  ok: number;
};

export async function GET() {
  try {
    const rows = await query<HealthRow[]>("SELECT 1 AS ok");

    return NextResponse.json({
      ok: rows[0]?.ok === 1,
      database: process.env.DB_NAME || "email_sending_project",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 500 },
    );
  }
}
