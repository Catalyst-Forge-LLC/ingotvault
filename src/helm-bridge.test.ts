import { equal } from "node:assert/strict";
import { test } from "node:test";
import { backupWrites } from "../scripts/helm-bridge.ts";

test("backup is offered only when the mirror is behind or missing", () => {
  equal(backupWrites("behind"), true);
  equal(backupWrites("missing-mirror"), true);
  equal(backupWrites("ok"), false);
  equal(backupWrites("diverged"), false);
  equal(backupWrites("fail"), false);
  equal(backupWrites("no-commits"), false);
});
