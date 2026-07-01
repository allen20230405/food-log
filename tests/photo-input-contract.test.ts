import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");

describe("photo input contract", () => {
  test("offers separate camera and gallery inputs on Android Chrome", () => {
    const cameraInput = matchInputById("cameraInput");
    const galleryInput = matchInputById("galleryInput");

    expect(cameraInput).toContain('type="file"');
    expect(cameraInput).toContain('accept="image/*"');
    expect(cameraInput).toContain('capture="environment"');
    expect(galleryInput).toContain('type="file"');
    expect(galleryInput).toContain('accept="image/*"');
    expect(galleryInput).not.toContain("capture=");
  });
});

function matchInputById(id: string): string {
  const match = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
  if (!match) {
    throw new Error(`Missing input #${id}`);
  }
  return match[0];
}
