import { NextResponse } from "next/server";
import {
  parseTargetClient,
  TargetClientValidationError,
  upsertTargetClients,
} from "../../../lib/target-clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTENSION_ORIGIN = "chrome-extension://eadiekhjkbbiohngnabdfmnaembijkkb";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const source = Array.isArray(body.clients) ? body.clients : [body];
    if (source.length === 0) {
      return NextResponse.json({ message: "At least one target client is required." }, { status: 400 });
    }
    const contacts = source.map(parseTargetClient);
    const unique = new Map(contacts.map((contact) => [contact.email, contact]));
    const savedCount = await upsertTargetClients(Array.from(unique.values()), "new");

    return NextResponse.json(
      {
        message: `${unique.size} target client${unique.size === 1 ? "" : "s"} saved as new.`,
        savedCount: unique.size,
        affectedCount: savedCount,
      },
      { status: 201, headers: corsHeaders(request) },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Target client could not be saved." },
      { status: error instanceof TargetClientValidationError ? 400 : 500, headers: corsHeaders(request) },
    );
  }
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (origin === EXTENSION_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Accept, Content-Type");
    headers.set("Access-Control-Allow-Private-Network", "true");
    headers.set("Vary", "Origin");
  }
  return headers;
}
