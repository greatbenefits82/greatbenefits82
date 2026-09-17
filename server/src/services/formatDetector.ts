import type { ColumnRole, DetectedFormat, MasterItem } from "../types.js";

/**
 * Alias lists (Japanese + English) used to recognize columns in an existing
 * inventory / wine-list spreadsheet. Matching is done by substring on a
 * normalized (trimmed, lowercased, full-width-space-stripped) header, so a
 * sheet that already exists in the wild (e.g. "商品名(銘柄)") still matches.
 */
const ROLE_ALIASES: Record<ColumnRole, string[]> = {
  brand: ["銘柄", "商品名", "品名", "ワイン名", "アイテム名", "name", "brand", "product", "item"],
  producer: ["生産者", "醸造元", "producer", "winery", "maker"],
  vintage: ["年号", "ヴィンテージ", "ビンテージ", "vintage", "year"],
  category: ["種別", "タイプ", "分類", "category", "type"],
  sku: ["コード", "商品コード", "品番", "sku", "code", "id"],
  quantity: ["数量", "本数", "在庫数", "在庫", "個数", "qty", "quantity", "count", "stock"],
  location: ["場所", "保管場所", "棚番", "location", "place", "bin"],
  notes: ["備考", "メモ", "note", "notes", "comment"],
};

// role priority when a header could match more than one role (e.g. "コード" vs "商品コード")
const ROLE_PRIORITY: ColumnRole[] = [
  "brand",
  "vintage",
  "producer",
  "quantity",
  "sku",
  "category",
  "location",
  "notes",
];

function normalize(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/　/g, " ") // full-width space
    .replace(/\s+/g, "");
}

function detectRole(header: string): ColumnRole | undefined {
  const normalized = normalize(header);
  if (!normalized) return undefined;
  for (const role of ROLE_PRIORITY) {
    if (ROLE_ALIASES[role].some((alias) => normalized.includes(normalize(alias)))) {
      return role;
    }
  }
  return undefined;
}

/**
 * Inspect the header row of an uploaded spreadsheet and decide whether it
 * already matches a recognizable inventory / wine-list format. If so, we
 * reuse it (so exports stay compatible with whatever the user already had).
 * If not, the caller falls back to `defaultFormat()` and records a brand
 * new original format instead of guessing at a bad mapping.
 */
export function detectFormat(headers: string[]): DetectedFormat {
  const roleByHeader: Record<string, ColumnRole> = {};
  for (const header of headers) {
    const role = detectRole(header);
    if (role && !Object.values(roleByHeader).includes(role)) {
      roleByHeader[header] = role;
    }
  }

  const hasBrand = Object.values(roleByHeader).includes("brand");
  const isExistingFormat = hasBrand;

  return {
    isExistingFormat,
    headers,
    roleByHeader,
    note: isExistingFormat
      ? `既存フォーマットを検出しました（${Object.entries(roleByHeader)
          .map(([h, r]) => `${h}→${r}`)
          .join(", ")}）`
      : "既存フォーマットを認識できなかったため、独自フォーマットで新規作成します",
  };
}

export const DEFAULT_HEADERS = ["銘柄", "生産者", "ヴィンテージ", "種別", "数量", "場所", "備考"] as const;

export function defaultFormat(): DetectedFormat {
  const headers = [...DEFAULT_HEADERS];
  return {
    isExistingFormat: false,
    headers,
    roleByHeader: {
      銘柄: "brand",
      生産者: "producer",
      ヴィンテージ: "vintage",
      種別: "category",
      数量: "quantity",
      場所: "location",
      備考: "notes",
    },
    note: "オリジナルフォーマットで記録します",
  };
}

/** Convert raw spreadsheet rows into MasterItem drafts using a detected column mapping. */
export function rowsToMasterItems(
  headers: string[],
  rows: string[][],
  roleByHeader: Record<string, ColumnRole>
): Array<Omit<MasterItem, "id" | "createdAt" | "updatedAt">> {
  const headerIndex = new Map(headers.map((h, i) => [h, i]));

  return rows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => {
      const raw: Record<string, string> = {};
      headers.forEach((h, i) => {
        raw[h] = String(row[i] ?? "").trim();
      });

      const getByRole = (role: ColumnRole): string | undefined => {
        const header = Object.entries(roleByHeader).find(([, r]) => r === role)?.[0];
        if (!header) return undefined;
        const idx = headerIndex.get(header);
        if (idx === undefined) return undefined;
        return String(row[idx] ?? "").trim() || undefined;
      };

      const quantityRaw = getByRole("quantity");
      const quantity = quantityRaw ? Number.parseInt(quantityRaw, 10) : 0;

      return {
        brand: getByRole("brand") ?? "",
        producer: getByRole("producer"),
        vintage: getByRole("vintage"),
        category: getByRole("category"),
        sku: getByRole("sku"),
        quantity: Number.isFinite(quantity) ? quantity : 0,
        location: getByRole("location"),
        notes: getByRole("notes"),
        raw,
      };
    })
    .filter((item) => item.brand !== "");
}
