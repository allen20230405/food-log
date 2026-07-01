import { describe, expect, test } from "vitest";
import { createId } from "./id";

describe("createId", () => {
  test("uses crypto.randomUUID when available", () => {
    const id = createId({
      randomUUID: () => "uuid-from-browser"
    });

    expect(id).toBe("uuid-from-browser");
  });

  test("falls back when crypto.randomUUID is unavailable", () => {
    const id = createId({}, () => 1780000000000);

    expect(id).toMatch(/^meal-1780000000000-[a-z0-9]+$/);
  });
});
