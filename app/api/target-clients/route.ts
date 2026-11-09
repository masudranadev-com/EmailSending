import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { query } from "../../../lib/db";
import type { TargetClientRow } from "../../../lib/target-clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TargetClientStatsRow = RowDataPacket & {
  total: number;
  old_count: number;
  new_count: number;
  name_count: number;
};

export async function GET(request: Request) {
  try {
    const status = new URL(request.url).searchParams.get("status");
    if (status && status !== "new" && status !== "old") {
      return NextResponse.json({ message: "Status must be new or old." }, { status: 400 });
    }

    const [clients, stats] = await Promise.all([
      query<TargetClientRow[]>(
        `SELECT id, email, information, status, created_at, updated_at
        FROM target_clients
        ${status ? "WHERE status = ?" : ""}
        ORDER BY updated_at DESC, id DESC`,
        status ? [status] : [],
      ),
      query<TargetClientStatsRow[]>(
        `WITH customer_names AS (
          SELECT
            status,
            NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(information, '$.seller_name'))), '') AS seller_name,
            NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(information, '$.business_name'))), '') AS business_name
          FROM target_clients
        ), resolved_names AS (
          SELECT
            status,
            CASE
              WHEN seller_name IS NOT NULL AND LOWER(seller_name) NOT IN ('not found', 'null') THEN seller_name
              WHEN business_name IS NOT NULL AND LOWER(business_name) NOT IN ('not found', 'null') THEN business_name
              ELSE NULL
            END AS client_name
          FROM customer_names
        )
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(status = 'old'), 0) AS old_count,
          COALESCE(SUM(status = 'new'), 0) AS new_count,
          COUNT(DISTINCT client_name) AS name_count
        FROM resolved_names`,
      ),
    ]);
    const counts = stats[0];

    return NextResponse.json({
      clients: clients.map((client) => ({
        id: client.id,
        email: client.email,
        information: parseInformation(client.information),
        status: client.status,
        createdAt: client.created_at,
        updatedAt: client.updated_at,
      })),
      stats: {
        total: Number(counts?.total || 0),
        old: Number(counts?.old_count || 0),
        new: Number(counts?.new_count || 0),
        names: Number(counts?.name_count || 0),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Target clients could not be loaded." },
      { status: 500 },
    );
  }
}

function parseInformation(value: TargetClientRow["information"]) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
