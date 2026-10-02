import { NextResponse } from "next/server";

export class ValidationError extends Error {}

export function databaseError(error: unknown) {
  return NextResponse.json(
    {
      message: error instanceof Error ? error.message : "Database request failed.",
    },
    { status: 500 },
  );
}
