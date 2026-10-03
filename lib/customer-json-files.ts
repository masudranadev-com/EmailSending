export function parseCustomerJsonFile(content: string): Record<string, unknown>[] {
  const text = content.replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("The JSON file is empty.");
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    // Accept exported object lists with omitted array brackets.
    const list = text.replace(/^\[/, "").replace(/\]$/, "").trim();
    try {
      parsed = JSON.parse(`[${list}]`);
    } catch {
      throw new Error("Invalid JSON. Use an array or a comma-separated list of customer objects.");
    }
  }

  const records = Array.isArray(parsed) ? parsed : [parsed];
  if (records.some((record) => !record || typeof record !== "object" || Array.isArray(record))) {
    throw new Error("Each customer record must be a JSON object.");
  }
  return records as Record<string, unknown>[];
}
