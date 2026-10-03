import assert from "node:assert/strict";
import test from "node:test";
import { parseCustomerJsonFile } from "../lib/customer-json-files";

test("merges file arrays without losing placeholders, duplicates or extra fields", () => {
  const first = [{ email: "Not found", id: 1, is_existing_client: true }];
  const second = [{ email: "hello@example.com", id: 2 }, { email: "Not found", id: 1 }];
  const merged = [JSON.stringify(first), JSON.stringify(second)].flatMap(parseCustomerJsonFile);
  assert.deepEqual(merged, [...first, ...second]);
});

test("accepts the sample's missing opening bracket, object lists and single objects", () => {
  const records = [{ email: "Not found" }, { email: "hello@example.com" }];
  const json = JSON.stringify(records);
  assert.deepEqual(parseCustomerJsonFile(json.slice(1)), records);
  assert.deepEqual(parseCustomerJsonFile(json.slice(1, -1)), records);
  assert.deepEqual(parseCustomerJsonFile('\uFEFF' + JSON.stringify(records[0])), [records[0]]);
});

test("rejects malformed JSON and non-object records", () => {
  for (const content of ['{"email":', '[null]', '[1]', '[[{}]]', 'true', '']) {
    assert.throws(() => parseCustomerJsonFile(content));
  }
});
