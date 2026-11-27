import assert from "node:assert/strict";
import { test } from "node:test";
import { cataloguePayload, catalogueProblems, catalogueStatus } from "../src/data/catalogueForm.js";

const form = {
  name: " Room booking ",
  description: " Reserve a meeting room. ",
  keywords: ["Room", "room"],
  href: " https://example.com/rooms ",
  accessInstructions: "",
  visibility: "all_users",
  active: true,
  verified: false,
  verificationNotes: "",
};

test("catalogue status follows archive, then verification", () => {
  assert.equal(catalogueStatus({ active: false, verified: true }), "Archived");
  assert.equal(catalogueStatus({ active: true, verified: true }), "Verified");
  assert.equal(catalogueStatus({ active: true, verified: false }), "Draft");
});

test("catalogue payload trims text, folds keywords, and clears an empty link", () => {
  const payload = cataloguePayload(form, " Booking ");
  assert.equal(payload.name, "Room booking");
  assert.deepEqual(payload.keywords, ["room", "booking"]);
  assert.equal(payload.href, "https://example.com/rooms");
  assert.equal(payload.accessInstructions, null);
  assert.equal(payload.verificationNotes, null);
  assert.deepEqual(catalogueProblems(payload), {});
});

test("a verified entry needs a check note, and a link or access instructions", () => {
  const missing = cataloguePayload({ ...form, href: "", verified: true });
  const problems = catalogueProblems(missing);
  assert.match(problems.accessInstructions, /link or say how/);
  assert.match(problems.verificationNotes, /checked this service/);
  const insecure = catalogueProblems(cataloguePayload({ ...form, href: "https://user:pass@example.com/rooms" }));
  assert.match(insecure.href, /HTTPS/);
});
