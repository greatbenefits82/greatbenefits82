import { describe, expect, it } from "vitest";
import { matchWine } from "./wineMatcher.js";
import type { MasterItem } from "../types.js";

function makeItem(overrides: Partial<MasterItem>): MasterItem {
  return {
    id: overrides.brand ?? "id",
    brand: "テスト",
    quantity: 0,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("matchWine", () => {
  it("returns no candidates when the master list is empty", () => {
    expect(matchWine("シャトー・マルゴー 2015", [])).toEqual([]);
  });

  it("ranks the same brand with the matching vintage above a mismatched vintage", () => {
    const list = [
      makeItem({ id: "a", brand: "シャトー・マルゴー", vintage: "2010" }),
      makeItem({ id: "b", brand: "シャトー・マルゴー", vintage: "2015" }),
    ];
    const candidates = matchWine("シャトー・マルゴー 2015", list);
    expect(candidates[0].masterId).toBe("b");
    expect(candidates[0].score).toBeLessThan(candidates[1].score);
  });

  it("still finds a reasonable match despite noisy OCR text", () => {
    const list = [
      makeItem({ id: "opus", brand: "オーパス・ワン", producer: "オーパスワンワイナリー", vintage: "2018" }),
      makeItem({ id: "margaux", brand: "シャトー・マルゴー", vintage: "2015" }),
    ];
    // OCR noise: stray characters mixed in with the real label text
    const candidates = matchWine("0PU5 オーパス ワン ワイナリー 2O18", list);
    expect(candidates[0].masterId).toBe("opus");
  });

  it("does not treat two wines with similar names but different vintages as identical", () => {
    const list = [makeItem({ id: "old", brand: "シャトー・マルゴー", vintage: "2000" })];
    const candidates = matchWine("シャトー・マルゴー 2020", list);
    // still surfaced as the closest text match, but the mismatched vintage should push the score up
    expect(candidates[0].score).toBeGreaterThan(0.3);
  });
});
