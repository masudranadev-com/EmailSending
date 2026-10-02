export const AUTH_COOKIE_NAME = "email_sender_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const REMEMBERED_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type AuthSession = {
  expiresAt: number;
  userId: number;
  username: string;
};

type SessionTokenPayload = {
  exp: number;
  sub: number;
  username: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function createSessionToken(
  user: { id: number; username: string },
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
) {
  const payload: SessionTokenPayload = {
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    sub: user.id,
    username: user.username,
  };
  const payloadPart = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await sign(payloadPart);

  return `${payloadPart}.${signature}`;
}

export async function readSessionToken(token?: string | null): Promise<AuthSession | null> {
  if (!token) {
    return null;
  }

  const [payloadPart, signature, extra] = token.split(".");

  if (!payloadPart || !signature || extra) {
    return null;
  }

  const expectedSignature = await sign(payloadPart);

  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      textDecoder.decode(base64UrlToBytes(payloadPart)),
    ) as Partial<SessionTokenPayload>;

    if (
      !payload ||
      typeof payload.exp !== "number" ||
      typeof payload.sub !== "number" ||
      typeof payload.username !== "string" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      expiresAt: payload.exp,
      userId: payload.sub,
      username: payload.username,
    };
  } catch {
    return null;
  }
}

function getAuthSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.DB_PASSWORD ||
    "email-sending-project-local-auth-secret"
  );
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(getAuthSecret()),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));

  return bytesToBase64Url(new Uint8Array(signature));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let value = "";

  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }

  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}
