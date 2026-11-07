/**
 * Split a long recording into individual signs. A sign is a run of frames where a hand is in
 * "signing space" (raised away from the resting position); short dropouts are bridged because
 * hand tracking flickers, and a lowered/absent hand ends the sign.
 */
import { POSE, type Frame } from "./types";

export interface Segment {
  start: number;
  end: number;
  frames: Frame[];
}
export interface SegmentOptions {
  /** Hand tracking can drop for a few frames mid-sign; bridge gaps up to this long (s). */
  bridgeGap: number;
  minDuration: number;
  maxDuration: number;
  leftHanded: boolean;
}
export const SEGMENT_DEFAULTS: SegmentOptions = { bridgeGap: 0.4, minDuration: 0.4, maxDuration: 7, leftHanded: false };

function raised(f: Frame): boolean {
  const hands = [f.right, f.left].filter(Boolean);
  if (!hands.length) return false;
  const w = f.pose?.world;
  if (!w) return true; // no body model: any visible hand counts
  const upper = Math.hypot(w[POSE.rShoulder].x - w[POSE.rElbow].x, w[POSE.rShoulder].y - w[POSE.rElbow].y, w[POSE.rShoulder].z - w[POSE.rElbow].z) || 0.3;
  const shoulderY = (w[POSE.rShoulder].y + w[POSE.lShoulder].y) / 2;
  // Resting hands hang ~1.9 upper-arm lengths below the shoulders; signing space starts above ~1.35.
  const limit = shoulderY - 1.35 * upper;
  return [w[POSE.rWrist], w[POSE.lWrist]].some((p) => p && p.y > limit);
}
export function segmentSigns(frames: Frame[], options: Partial<SegmentOptions> = {}): Segment[] {
  const o = { ...SEGMENT_DEFAULTS, ...options };
  const out: Segment[] = [];
  let startIdx = -1, lastActive = -1;
  const flush = (endIdx: number) => {
    if (startIdx < 0) return;
    const slice = frames.slice(startIdx, endIdx + 1);
    const start = slice[0].t, end = slice[slice.length - 1].t;
    if (end - start >= o.minDuration) {
      // Split over-long runs so one long recording never becomes one giant "sign".
      const parts = Math.ceil((end - start) / o.maxDuration);
      for (let p = 0; p < parts; p++) {
        const a = start + ((end - start) * p) / parts, b = start + ((end - start) * (p + 1)) / parts;
        out.push({ start: a, end: b, frames: slice.filter((f) => f.t >= a && f.t <= b) });
      }
    }
    startIdx = -1;
  };
  frames.forEach((f, i) => {
    if (raised(f)) {
      if (startIdx < 0) startIdx = i;
      lastActive = i;
    } else if (startIdx >= 0 && f.t - frames[lastActive].t > o.bridgeGap) {
      flush(lastActive);
    }
  });
  if (startIdx >= 0) flush(lastActive);
  return out;
}
