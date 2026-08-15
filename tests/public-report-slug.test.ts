import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicReportSlug,
  isPublicReportSlug,
} from "../lib/public-report-slug";

test("creates readable lowercase URL-safe report slugs", () => {
  let nextIndex = 0;
  const publicSlug = createPublicReportSlug(
    "Pizza Warriors",
    upperBound => (nextIndex++ * 7) % upperBound,
  );

  assert.match(publicSlug, /^pizza-warriors-[0-9a-hjkmnp-tv-z]{7}$/);
  assert.equal(isPublicReportSlug(publicSlug), true);
});

test("normalizes labels and falls back safely when a label has no URL characters", () => {
  const firstCode = () => 0;

  assert.equal(createPublicReportSlug("  Pizza   Warriors!  ", firstCode), "pizza-warriors-0000000");
  assert.equal(createPublicReportSlug("!!!", firstCode), "raid-0000000");
});

test("rejects internal CUIDs and malformed public report slugs", () => {
  assert.equal(isPublicReportSlug("cmsu03su9000001ntleh35jew"), false);
  assert.equal(isPublicReportSlug("Pizza-Warriors-2345678"), false);
  assert.equal(isPublicReportSlug("pizza-warriors-iiiiiii"), false);
  assert.equal(isPublicReportSlug("short"), false);
});
