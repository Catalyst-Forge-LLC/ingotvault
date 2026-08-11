import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sanitizeRefSegment,
  wipHostPrefix,
  wipSlugSegment,
  wipTimestampSegment,
} from "./wip.js";

describe("WIP ref segments", () => {
  it("scopes host prefix under refs/ingotvault/wip/<host>", () => {
    assert.equal(wipHostPrefix("laptop.local"), "refs/ingotvault/wip/laptop.local");
    assert.equal(
      wipHostPrefix("bad host/name"),
      `refs/ingotvault/wip/${sanitizeRefSegment("bad host/name")}`,
    );
  });

  it("sorts retention by timestamp segment, not slug", () => {
    const hostPrefix = "refs/ingotvault/wip/host";
    const refs = [
      `${hostPrefix}/zeta/2026-01-01T00-00-00Z`,
      `${hostPrefix}/alpha/2026-06-01T00-00-00Z`,
      `${hostPrefix}/zeta/2026-03-01T00-00-00Z`,
      `${hostPrefix}/alpha/2026-02-01T00-00-00Z`,
    ];

    const bySlug = new Map<string, string[]>();
    for (const ref of refs) {
      const slug = wipSlugSegment(ref, hostPrefix);
      const group = bySlug.get(slug) ?? [];
      group.push(ref);
      bySlug.set(slug, group);
    }

    for (const group of bySlug.values()) {
      group.sort((a, b) =>
        wipTimestampSegment(b).localeCompare(wipTimestampSegment(a)),
      );
    }

    assert.deepEqual(bySlug.get("alpha"), [
      `${hostPrefix}/alpha/2026-06-01T00-00-00Z`,
      `${hostPrefix}/alpha/2026-02-01T00-00-00Z`,
    ]);
    assert.deepEqual(bySlug.get("zeta"), [
      `${hostPrefix}/zeta/2026-03-01T00-00-00Z`,
      `${hostPrefix}/zeta/2026-01-01T00-00-00Z`,
    ]);

    // Full-string sort would put every zeta ahead of every alpha.
    const wrong = [...refs].sort((a, b) => b.localeCompare(a));
    assert.equal(wrong[0]?.includes("/zeta/"), true);
  });
});
