import assert from "node:assert/strict";
import test from "node:test";
import {
  appendReference,
  ensureReSubject,
  normalizeMailStatus,
  sanitizePlainTextMessage,
  validateRfcMessageId,
} from "../lib/campaign-email-messages";
import { decodeCustomerRouteId, encodeCustomerRouteId } from "../lib/customer-route-id";

test("normalizes campaign customer mail statuses", () => {
  assert.equal(normalizeMailStatus("success"), "sent");
  assert.equal(normalizeMailStatus("failed"), "failed");
  assert.equal(normalizeMailStatus("faild"), "failed");
  assert.equal(normalizeMailStatus(""), "not_sent");
  assert.equal(normalizeMailStatus(undefined), "not_sent");
});

test("formats follow-up subjects without double Re prefixes", () => {
  assert.equal(ensureReSubject("Quarterly order"), "Re: Quarterly order");
  assert.equal(ensureReSubject("Re: Quarterly order"), "Re: Quarterly order");
  assert.equal(ensureReSubject("re: Quarterly order"), "re: Quarterly order");
});

test("builds references header chains without duplicates", () => {
  const root = "<root@example.com>";
  const parent = "<parent@example.com>";

  assert.equal(appendReference(root, parent), `${root} ${parent}`);
  assert.equal(appendReference(`${root} ${parent}`, parent), `${root} ${parent}`);
});

test("validates RFC message-id format used for threading", () => {
  assert.equal(validateRfcMessageId("<abc@example.com>"), true);
  assert.equal(validateRfcMessageId("abc@example.com"), false);
  assert.equal(validateRfcMessageId("<abc>"), false);
});

test("sanitizes follow-up message text", () => {
  assert.equal(sanitizePlainTextMessage("  Hello\u0000 there  "), "Hello there");
});

test("encodes customer route ids that contain URL path separators", () => {
  const customerId = "gid://shopify/Customer/12345";
  const encoded = encodeCustomerRouteId(customerId);

  assert.equal(encoded.includes("/"), false);
  assert.equal(decodeCustomerRouteId(encoded), customerId);
});
