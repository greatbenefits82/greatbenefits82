import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * On-device object detection (COCO-SSD) can only classify into ~80 broad
 * COCO categories ("bottle", "remote", "toilet", ...) — it has no notion of
 * a specific product name or wine label. To count "what, specifically, and
 * how many" we send the captured frame to Claude's vision API instead. This
 * trades continuous real-time detection for a capture → analyze step (a few
 * seconds, and a per-call API cost), in exchange for actually reading
 * product names / brand text off the packaging.
 *
 * Structured output is extracted via a forced tool call (`tool_choice`
 * naming the tool) rather than the newer `output_config.format` helper,
 * since the installed SDK version doesn't yet expose that helper's types —
 * the tool-call pattern is the long-stable way to get JSON back and is
 * re-validated with zod below in case the model's output ever strays from
 * the declared schema.
 */

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export const VISION_MODEL = "claude-opus-5";

export function isVisionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) || Boolean(process.env.ANTHROPIC_AUTH_TOKEN);
}

export interface ImageInput {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

const GenericItemsResult = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      category: z.string().optional(),
      quantity: z.number().int().min(1),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),
  notes: z.string().optional(),
});
export type GenericVisionResult = z.infer<typeof GenericItemsResult>;

const WineLabelsResult = z.object({
  wines: z.array(
    z.object({
      brand: z.string(),
      producer: z.string().optional(),
      vintage: z.string().optional(),
      category: z.string().optional(),
      quantity: z.number().int().min(1),
      confidence: z.enum(["high", "medium", "low"]),
      rawLabelText: z.string().optional(),
    })
  ),
  notes: z.string().optional(),
});
export type WineVisionResult = z.infer<typeof WineLabelsResult>;

const GENERIC_SYSTEM_PROMPT = `あなたは倉庫・店舗の棚卸し（在庫カウント）を手伝うアシスタントです。
与えられた写真の中に写っている物品を、できるだけ具体的な商品名・型番まで識別してください。
「ボトル」「箱」のような大まかな分類ではなく、パッケージや本体に書かれている文字・ロゴ・形状から
分かる範囲で具体的な名称を答えてください。分からない場合は無理に断定せず、confidence を low にし、
name には分かる範囲の説明（例:「白い電子体温計」）を入れてください。
同じ商品が複数写っていればまとめて1エントリにし、quantity にその個数を入れてください。
結果は必ず record_items ツールを呼び出して報告してください。`;

const WINE_SYSTEM_PROMPT = `あなたはワインの棚卸し（在庫カウント）を手伝うアシスタントです。
与えられた写真に写っているワインボトルのラベルを、できるだけ正確に読み取ってください。
ワインは一見同じラベルデザインに見えても、生産者名・ヴィンテージ（年号）・畑名などの
小さな文字が違うだけで全く別の銘柄であることが多いです。ラベルの細かい文字まで注意深く読み、
違いがあれば別エントリとして扱ってください。読み取れた文字は rawLabelText にできるだけ
そのまま書き起こしてください。ラベルが不鮮明・一部隠れている場合は confidence を low/medium にし、
無理に銘柄を断定しないでください。
結果は必ず record_wines ツールを呼び出して報告してください。`;

const GENERIC_TOOL: Anthropic.Tool = {
  name: "record_items",
  description: "写真の中で識別できた物品を、名称ごとに1エントリとして記録する",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "できるだけ具体的な商品名・型番・種類（日本語）" },
            category: { type: "string", description: "大まかな分類（任意）" },
            quantity: { type: "integer", minimum: 1, description: "写真に写っている個数" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["name", "quantity", "confidence"],
        },
      },
      notes: { type: "string", description: "識別しづらかった点などの補足（任意）" },
    },
    required: ["items"],
  },
};

const WINE_TOOL: Anthropic.Tool = {
  name: "record_wines",
  description: "写真の中で読み取れたワインラベルを、銘柄ごとに1エントリとして記録する",
  input_schema: {
    type: "object",
    properties: {
      wines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            brand: { type: "string", description: "銘柄名（ラベルに書かれている名称そのまま）" },
            producer: { type: "string", description: "生産者・醸造元（分かれば）" },
            vintage: { type: "string", description: "ヴィンテージ年（4桁）" },
            category: { type: "string", description: "赤/白/スパークリング等（分かれば）" },
            quantity: { type: "integer", minimum: 1, description: "同じ銘柄・同じヴィンテージの本数" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            rawLabelText: { type: "string", description: "ラベルの文字を読めた範囲でそのまま書き起こしたもの" },
          },
          required: ["brand", "quantity", "confidence"],
        },
      },
      notes: { type: "string", description: "同じに見えて実は違う可能性がある銘柄同士の注意点など（任意）" },
    },
    required: ["wines"],
  },
};

async function callVision<T extends z.ZodTypeAny>(
  image: ImageInput,
  systemPrompt: string,
  userPrompt: string,
  tool: Anthropic.Tool,
  schema: T
): Promise<z.infer<T>> {
  const response = await getClient().messages.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
          { type: "text", text: userPrompt },
        ],
      },
    ],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === tool.name
  );
  if (!toolUse) {
    throw new Error("画像認識モデルから結果を取得できませんでした");
  }

  const parsed = schema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`画像認識の結果が想定した形式ではありませんでした: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function identifyGenericItems(image: ImageInput): Promise<GenericVisionResult> {
  return callVision(
    image,
    GENERIC_SYSTEM_PROMPT,
    "この写真に写っている物品を識別し、商品名（分かる範囲で具体的に）と個数を教えてください。",
    GENERIC_TOOL,
    GenericItemsResult
  );
}

export function identifyWineLabels(image: ImageInput): Promise<WineVisionResult> {
  return callVision(
    image,
    WINE_SYSTEM_PROMPT,
    "この写真に写っているワインのラベルを読み取り、銘柄ごとに本数を教えてください。",
    WINE_TOOL,
    WineLabelsResult
  );
}
