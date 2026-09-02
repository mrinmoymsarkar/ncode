import { describe, expect, it } from "vitest";
import { sourceUrlSchema } from "@/lib/schemas";

describe("sourceUrlSchema", () => {
  it("accepts valid HTTP(S) media URLs", () => {
    expect(sourceUrlSchema.safeParse("https://cdn.example.com/videos/sample.mp4").success).toBe(true);
    expect(sourceUrlSchema.safeParse("http://media.example.com/library/clip.mov").success).toBe(true);
  });

  it("rejects invalid or unsupported URLs", () => {
    expect(sourceUrlSchema.safeParse("not a url").success).toBe(false);
    expect(sourceUrlSchema.safeParse("ftp://cdn.example.com/videos/sample.mp4").success).toBe(false);
    expect(sourceUrlSchema.safeParse("https://cdn.example.com").success).toBe(false);
  });
});
