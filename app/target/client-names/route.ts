import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientNameRow = RowDataPacket & {
  seller_name: string;
};

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

const ALLOWED_EXTENSION_ORIGINS = new Set([
  "chrome-extension://eadiekhjkbbiohngnabdfmnaembijkkb",
]);

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: responseHeaders(request),
  });
}

export async function GET(request: Request) {
  const responseName = getResponseName(request);

  if (responseName?.toLowerCase() === "validation error") {
    return jsonResponse(
      {
        status: false,
        msg: "The client names request could not be validated.",
      },
      request,
      422,
    );
  }

  try {
    const rows = await query<ClientNameRow[]>(
      `WITH customer_names AS (
        SELECT
          id,
          NULLIF(
            TRIM(JSON_UNQUOTE(JSON_EXTRACT(information, '$.seller_name'))),
            ''
          ) AS seller_name,
          NULLIF(
            TRIM(JSON_UNQUOTE(JSON_EXTRACT(information, '$.business_name'))),
            ''
          ) AS business_name
        FROM unique_emails
      ), resolved_names AS (
        SELECT
          id,
          CASE
            WHEN seller_name IS NOT NULL
              AND LOWER(seller_name) NOT IN ('not found', 'null')
              THEN seller_name
            WHEN business_name IS NOT NULL
              AND LOWER(business_name) NOT IN ('not found', 'null')
              THEN business_name
            ELSE NULL
          END AS seller_name
        FROM customer_names
      )
      SELECT seller_name
      FROM resolved_names
      WHERE seller_name IS NOT NULL
      ORDER BY id ASC`,
    );

    return jsonResponse(rows.map((row) => row.seller_name), request);
  } catch (error) {
    return jsonResponse(
      {
        status: false,
        msg: error instanceof Error ? error.message : "Client names request failed.",
      },
      request,
      500,
    );
  }
}

function getResponseName(request: Request) {
  const headerValue = request.headers.get("x-signaldock-example")?.trim();

  if (headerValue) {
    return headerValue;
  }

  return new URL(request.url).searchParams.get("__example")?.trim() || null;
}

function responseHeaders(request: Request) {
  const headers: Record<string, string> = { ...RESPONSE_HEADERS };
  const origin = request.headers.get("origin")?.trim() || "";

  if (ALLOWED_EXTENSION_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Accept, Content-Type, x-signaldock-example";
    headers["Access-Control-Allow-Private-Network"] = "true";
    headers.Vary = "Origin";
  }

  return headers;
}

function jsonResponse(body: unknown, request: Request, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: responseHeaders(request),
  });
}
