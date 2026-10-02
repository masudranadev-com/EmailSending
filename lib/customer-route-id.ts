const CUSTOMER_ROUTE_ID_PREFIX = "__email_sender_customer_id_v1__";

export function encodeCustomerRouteId(value: string) {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const base64 = btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  return `${CUSTOMER_ROUTE_ID_PREFIX}${base64}`;
}

export function decodeCustomerRouteId(value: string) {
  if (!value.startsWith(CUSTOMER_ROUTE_ID_PREFIX)) {
    return value;
  }

  try {
    const encoded = value.slice(CUSTOMER_ROUTE_ID_PREFIX.length);
    const base64 = encoded
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}
