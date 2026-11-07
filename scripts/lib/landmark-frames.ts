/** JSON from scripts/extract-landmarks.py → recognition Frames (same side-assignment rule as the browser tracker). */
import fs from "node:fs";
import { toAvatarFrame } from "../../src/signing/recognition/geometry";
import type { Frame, HandObs, Pt } from "../../src/signing/recognition/types";

interface Raw { frames: { t: number; pose: { world: number[][]; img: number[][] } | null; hands: { img: number[][]; world: number[][]; score: number }[] }[] }
const pt = (a: number[]) => toAvatarFrame({ x: a[0], y: a[1], z: a[2] });
export function loadFrames(file: string): Frame[] {
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Raw;
  return raw.frames.map((f) => {
    const frame: Frame = { t: f.t };
    if (f.pose) frame.pose = { world: f.pose.world.map(pt) as Pt[], vis: f.pose.img.map((p) => p[2]) };
    const assigned: Partial<Record<"Right" | "Left", HandObs>> = {};
    const order = f.hands.map((h, i) => ({ h, i })).sort((a, b) => a.h.img[0][0] - b.h.img[0][0]);
    order.forEach(({ h }, rank) => {
      let side: "Right" | "Left";
      if (f.pose) {
        const r = f.pose.img[16], l = f.pose.img[15];
        side = Math.hypot(h.img[0][0] - r[0], h.img[0][1] - r[1]) <= Math.hypot(h.img[0][0] - l[0], h.img[0][1] - l[1]) ? "Right" : "Left";
      } else side = f.hands.length === 2 ? (rank === 0 ? "Right" : "Left") : h.img[0][0] < 0.5 ? "Right" : "Left";
      if (!assigned[side]) assigned[side] = { world: h.world.map(pt), side, score: h.score };
    });
    frame.right = assigned.Right; frame.left = assigned.Left;
    return frame;
  });
}
