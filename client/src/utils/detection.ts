import type { DetectedObject } from "../types";

const CLASS_NAME_JA: Record<string, string> = {
  bottle: "ボトル",
  "wine glass": "ワイングラス",
  cup: "カップ",
  book: "本",
  box: "箱",
  person: "人",
};

export function classNameJa(label: string): string {
  return CLASS_NAME_JA[label] ?? label;
}

export function tally(detections: DetectedObject[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of detections) {
    counts[d.class] = (counts[d.class] ?? 0) + 1;
  }
  return counts;
}
