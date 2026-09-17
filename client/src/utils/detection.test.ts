import { describe, expect, it } from "vitest";
import { classNameJa, tally } from "./detection";
import type { DetectedObject } from "../types";

describe("classNameJa", () => {
  it("translates known COCO-SSD classes to Japanese", () => {
    expect(classNameJa("bottle")).toBe("ボトル");
    expect(classNameJa("cup")).toBe("カップ");
  });

  it("falls back to the original label for unknown classes", () => {
    expect(classNameJa("skateboard")).toBe("skateboard");
  });
});

describe("tally", () => {
  it("counts detections per class", () => {
    const detections: DetectedObject[] = [
      { class: "bottle", score: 0.9, bbox: [0, 0, 10, 10] },
      { class: "bottle", score: 0.8, bbox: [10, 10, 10, 10] },
      { class: "cup", score: 0.7, bbox: [20, 20, 10, 10] },
    ];
    expect(tally(detections)).toEqual({ bottle: 2, cup: 1 });
  });

  it("returns an empty object for no detections", () => {
    expect(tally([])).toEqual({});
  });
});
