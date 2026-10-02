import assert from "node:assert/strict";
import test from "node:test";
import { GET, OPTIONS } from "../app/target/client-names/route";

const EXTENSION_ORIGIN = "chrome-extension://eadiekhjkbbiohngnabdfmnaembijkkb";

test("returns the forced validation example from the SignalDock header", async () => {
  const response = await GET(
    new Request("http://localhost:3000/target/client-names", {
      headers: { "x-signaldock-example": "Validation error" },
    }),
  );

  assert.equal(response.status, 422);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.deepEqual(await response.json(), {
    status: false,
    msg: "The client names request could not be validated.",
  });
});

test("returns the forced validation example from the SignalDock query", async () => {
  const response = await GET(
    new Request("http://localhost:3000/target/client-names?__example=Validation%20error"),
  );

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    status: false,
    msg: "The client names request could not be validated.",
  });
});

test("allows the Target Mail Hunter extension to request client names", async () => {
  const response = await GET(
    new Request("http://localhost:3000/target/client-names?__example=Validation%20error", {
      headers: { Origin: EXTENSION_ORIGIN },
    }),
  );

  assert.equal(response.headers.get("access-control-allow-origin"), EXTENSION_ORIGIN);
  assert.equal(response.headers.get("access-control-allow-private-network"), "true");
  assert.equal(response.headers.get("vary"), "Origin");
});

test("handles the extension private-network preflight", async () => {
  const response = await OPTIONS(
    new Request("http://localhost:3000/target/client-names", {
      method: "OPTIONS",
      headers: { Origin: EXTENSION_ORIGIN },
    }),
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), EXTENSION_ORIGIN);
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.equal(response.headers.get("access-control-allow-private-network"), "true");
});
