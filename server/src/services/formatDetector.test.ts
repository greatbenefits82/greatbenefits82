import { describe, expect, it } from "vitest";
import { defaultFormat, detectFormat, rowsToMasterItems } from "./formatDetector.js";

describe("detectFormat", () => {
  it("recognizes a Japanese wine-list layout", () => {
    const headers = ["銘柄", "生産者", "ヴィンテージ", "在庫数", "保管場所"];
    const format = detectFormat(headers);
    expect(format.isExistingFormat).toBe(true);
    expect(format.roleByHeader["銘柄"]).toBe("brand");
    expect(format.roleByHeader["在庫数"]).toBe("quantity");
    expect(format.roleByHeader["保管場所"]).toBe("location");
  });

  it("recognizes an English inventory layout", () => {
    const headers = ["Product Name", "Vintage", "Qty", "Code"];
    const format = detectFormat(headers);
    expect(format.isExistingFormat).toBe(true);
    expect(format.roleByHeader["Product Name"]).toBe("brand");
    expect(format.roleByHeader["Qty"]).toBe("quantity");
    expect(format.roleByHeader["Code"]).toBe("sku");
  });

  it("falls back to no existing format when no brand-like column is present", () => {
    const headers = ["日付", "担当者", "備考"];
    const format = detectFormat(headers);
    expect(format.isExistingFormat).toBe(false);
  });
});

describe("defaultFormat", () => {
  it("produces an original format with a brand and quantity column", () => {
    const format = defaultFormat();
    expect(format.isExistingFormat).toBe(false);
    expect(Object.values(format.roleByHeader)).toContain("brand");
    expect(Object.values(format.roleByHeader)).toContain("quantity");
  });
});

describe("rowsToMasterItems", () => {
  it("maps rows using the detected column roles and preserves raw values", () => {
    const headers = ["銘柄", "ヴィンテージ", "在庫数"];
    const format = detectFormat(headers);
    const rows = [
      ["シャトー・マルゴー", "2015", "3"],
      ["", "", ""], // blank row should be dropped
      ["オーパス・ワン", "2018", "5"],
    ];
    const items = rowsToMasterItems(headers, rows, format.roleByHeader);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ brand: "シャトー・マルゴー", vintage: "2015", quantity: 3 });
    expect(items[0].raw).toEqual({ 銘柄: "シャトー・マルゴー", ヴィンテージ: "2015", 在庫数: "3" });
    expect(items[1]).toMatchObject({ brand: "オーパス・ワン", vintage: "2018", quantity: 5 });
  });

  it("drops rows without a brand value", () => {
    const headers = ["銘柄", "在庫数"];
    const format = detectFormat(headers);
    const items = rowsToMasterItems(headers, [["", "10"]], format.roleByHeader);
    expect(items).toHaveLength(0);
  });
});
