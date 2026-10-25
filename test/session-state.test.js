import test from "node:test";
import assert from "node:assert/strict";
import { connectionAvailable } from "../src/session-state.js";
test("saved devices stay connected without date checks, including previous expired timestamps", () => {
  for (const expiresAt of [
    undefined,
    null,
    "1970-01-01T00:00:00.000Z",
    "invalid",
  ])
    assert.equal(
      connectionAvailable({ token: "saved-device-token", expiresAt }),
      true,
    );
  assert.equal(connectionAvailable(null), false);
  assert.equal(connectionAvailable({ token: "" }), false);
  assert.equal(
    connectionAvailable({ token: "removed-device", needsCode: true }),
    false,
  );
});
