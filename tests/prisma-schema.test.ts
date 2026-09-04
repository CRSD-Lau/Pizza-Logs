import assert from "node:assert/strict";
import { test } from "node:test";
import { createPrismaClient } from "../lib/prisma-client";

test("unsupported schema identifiers fail before opening a connection", () => {
  const previous = process.env.DATABASE_URL;
  try {
    for (const schema of ["", 'embedded"quote', "null\0character", "a".repeat(64), "é".repeat(32)]) {
      const url = new URL("postgresql://test:test@127.0.0.1:1/test");
      url.searchParams.set("schema", schema);
      process.env.DATABASE_URL = url.toString();
      assert.throws(() => createPrismaClient(), /DATABASE_URL schema/);
    }
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
