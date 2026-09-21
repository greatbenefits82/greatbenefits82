import { describe, expect, it } from "vitest";
import { buildWineMatchQuery } from "./wineQuery";

describe("buildWineMatchQuery", () => {
  it("prefers the raw label transcription when present", () => {
    const query = buildWineMatchQuery({
      rawLabelText: "CHATEAU MARGAUX 2015 Margaux Appellation",
      brand: "シャトー・マルゴー",
      vintage: "2015",
    });
    expect(query).toBe("CHATEAU MARGAUX 2015 Margaux Appellation");
  });

  it("falls back to structured fields when no raw text is available", () => {
    const query = buildWineMatchQuery({ brand: "オーパス・ワン", producer: "オーパスワンワイナリー", vintage: "2018" });
    expect(query).toBe("オーパス・ワン オーパスワンワイナリー 2018");
  });

  it("omits missing fields from the fallback", () => {
    const query = buildWineMatchQuery({ brand: "シャブリ" });
    expect(query).toBe("シャブリ");
  });
});
