import assert from "node:assert/strict";
import test from "node:test";
import {
  sendInitialCampaignEmail,
  verifyBrevoCanSendTransactionalEmail,
} from "../lib/mail-transport";
import type { EmailDeliverySettings } from "../lib/email-settings";

const baseSettings: EmailDeliverySettings = {
  apiKey: "test-key",
  apiKeyName: "BREVO_API_KEY",
  apiKeyPreview: "test...",
  dailySendingLimit: 0,
  dailySendingLimitRaw: "",
  dailySendingTimeZone: "Asia/Dhaka",
  defaultFromEmail: "",
  defaultFromName: "",
  messageIdDomain: "",
  provider: "Brevo API",
  requireBrevoCreditCheck: true,
  speedLimitPerMinute: 0,
  speedLimitPerMinuteRaw: "",
  smtpHost: "",
  smtpPassword: "",
  smtpPasswordPreview: "Not set",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
};

test("stops sending when Brevo reports zero remaining email credits", async () => {
  const restoreFetch = mockFetch({
    plan: [
      {
        credits: {
          email: {
            remaining: 0,
          },
        },
      },
    ],
    relay: {
      enabled: true,
    },
  });

  try {
    const result = await verifyBrevoCanSendTransactionalEmail(baseSettings);

    assert.equal(result.allowed, false);
    assert.match(result.reason, /0 remaining email credits/i);
  } finally {
    restoreFetch();
  }
});

test("fails closed when Brevo remaining credits cannot be verified", async () => {
  const restoreFetch = mockFetch({
    plan: [
      {
        type: "unknown",
      },
    ],
    relay: {
      enabled: true,
    },
  });

  try {
    const result = await verifyBrevoCanSendTransactionalEmail(baseSettings);

    assert.equal(result.allowed, false);
    assert.match(result.reason, /could not be verified/i);
  } finally {
    restoreFetch();
  }
});

test("allows sending when Brevo reports remaining email credits", async () => {
  const restoreFetch = mockFetch({
    plan: [
      {
        credits: {
          email: {
            remaining: 12,
          },
        },
      },
    ],
    relay: {
      enabled: true,
    },
  });

  try {
    const result = await verifyBrevoCanSendTransactionalEmail(baseSettings);

    assert.equal(result.allowed, true);
  } finally {
    restoreFetch();
  }
});

test("allows sending when Brevo reports send limit credits", async () => {
  const restoreFetch = mockFetch({
    plan: [
      {
        credits: 237,
        creditsType: "sendLimit",
        type: "free",
      },
    ],
    relay: {
      enabled: true,
    },
  });

  try {
    const result = await verifyBrevoCanSendTransactionalEmail(baseSettings);

    assert.equal(result.allowed, true);
  } finally {
    restoreFetch();
  }
});

test("uses Brevo API messageId as RFC Message-ID when it is valid", async () => {
  const providerMessageId = "<202608040924.70976044034@smtp-relay.mailin.fr>";
  const restoreFetch = mockFetchSequence([
    {
      body: {
        plan: [
          {
            credits: 237,
            creditsType: "sendLimit",
          },
        ],
        relay: {
          enabled: true,
        },
      },
      status: 200,
    },
    {
      body: {
        messageId: providerMessageId,
      },
      status: 201,
    },
  ]);

  try {
    const result = await sendInitialCampaignEmail(
      {
        fromEmail: "sender@example.com",
        fromName: "Sender",
        htmlBody: "<p>Hello</p>",
        replyTo: null,
        subject: "Hello",
        textBody: "Hello",
        toEmail: "customer@example.com",
      },
      baseSettings,
    );

    assert.equal(result.status, "sent");
    assert.equal(result.providerMessageId, providerMessageId);
    assert.equal(result.rfcMessageId, providerMessageId);
  } finally {
    restoreFetch();
  }
});

function mockFetch(payload: unknown) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json",
      },
      status: 200,
    })) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function mockFetchSequence(
  responses: Array<{
    body: unknown;
    status: number;
  }>,
) {
  const originalFetch = globalThis.fetch;
  let index = 0;

  globalThis.fetch = (async () => {
    const response = responses[index] ?? responses[responses.length - 1];
    index += 1;

    return new Response(JSON.stringify(response.body), {
      headers: {
        "content-type": "application/json",
      },
      status: response.status,
    });
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}
