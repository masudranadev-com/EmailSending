import assert from "node:assert/strict";
import test from "node:test";
import {
  CustomerUpdateValidationError,
  parseCustomerUpdates,
} from "../lib/customer-updates";

test("accepts matched-customer update fields and ignores unrelated JSON properties", () => {
  const result = parseCustomerUpdates([
    {
      email: " CUSTOMER@Example.com ",
      headquarters: " Dhaka ",
      mobile_number: "+8801000000000",
      store_link: "https://example.com/store",
      business_name: "Example Ltd",
      seller_name: "Example Seller",
      status: "Found",
    },
  ]);

  assert.deepEqual(result, {
    updates: [
      {
        email: "customer@example.com",
        information: {
          headquarters: "Dhaka",
          mobile_number: "+8801000000000",
          store_link: "https://example.com/store",
          business_name: "Example Ltd",
          seller_name: "Example Seller",
        },
      },
    ],
    invalidCount: 0,
    duplicateCount: 0,
  });
});

test("skips placeholder and invalid emails", () => {
  const result = parseCustomerUpdates([
    {
      email: "Sold & shipped by not found",
      headquarters: "Not found",
      mobile_number: "Not found",
      store_link: "Not found",
      business_name: "Target",
    },
    {
      email: "valid@example.com",
      headquarters: "Brooklyn, NY",
    },
  ]);

  assert.equal(result.invalidCount, 1);
  assert.deepEqual(result.updates, [
    {
      email: "valid@example.com",
      information: { headquarters: "Brooklyn, NY" },
    },
  ]);
});

test("uses the last JSON item when an email occurs more than once", () => {
  const result = parseCustomerUpdates([
    { email: "same@example.com", business_name: "First" },
    { email: "SAME@example.com", business_name: "Replacement" },
  ]);

  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.updates[0], {
    email: "same@example.com",
    information: { business_name: "Replacement" },
  });
});

test("rejects malformed or non-array customer update JSON", () => {
  assert.throws(
    () => parseCustomerUpdates("not json"),
    (error) =>
      error instanceof CustomerUpdateValidationError &&
      error.message === "Customer update JSON is invalid.",
  );
  assert.throws(
    () => parseCustomerUpdates('{"email":"customer@example.com"}'),
    (error) =>
      error instanceof CustomerUpdateValidationError &&
      error.message === "Customer update JSON must be an array.",
  );
});
