/**
 * Per-frame features. Everything is rotation-invariant (joint angles, unit vectors) or measured
 * relative to the signer's own body (nose, upper-arm length), so camera distance/position and
 * signer size don't matter. Replaces the old averaged "cosine similarity of wrist-relative
 * coordinates", which ignored movement and had no rotation normalisation.
 */
import { angle, cross, dist, dot, len, norm, scale, sub } from "./geometry";
import { POSE, type Frame, type HandObs, type Pt, type Side } from "./types";

export const STEPS = 24;
const FINGER_MCP = [5, 9, 13, 17];
/** Max total flexion of one finger (rad), from rigConfig: 1.45 + 1.65 + 1.2. */
const FINGER_RANGE = 4.3;

export interface HandShape {
  curl: number[]; // thumb, index, middle, ring, little — 0 straight … 1 fully curled
  spread: number[]; // index–middle, middle–ring, ring–little
  pinch: number; // thumb tip ↔ index tip, in palm-lengths
  palmNormal: Pt;
  fingerDir: Pt;
}
export function palmNormal(lm: Pt[], side: Side): Pt {
  const n = norm(cross(sub(lm[5], lm[0]), sub(lm[17], lm[0])));
  return side === "Right" ? n : scale(n, -1);
}
export function handShape(lm: Pt[], side: Side): HandShape {
  const curl: number[] = [];
  const thumbA = angle(sub(lm[2], lm[1]), sub(lm[3], lm[2]));
  const thumbB = angle(sub(lm[3], lm[2]), sub(lm[4], lm[3]));
  curl.push(Math.min(1, (thumbA + thumbB) / 1.6));
  const prox: Pt[] = [];
  for (const mcp of FINGER_MCP) {
    const b0 = sub(lm[mcp], lm[0]);
    const b1 = sub(lm[mcp + 1], lm[mcp]);
    const b2 = sub(lm[mcp + 2], lm[mcp + 1]);
    const b3 = sub(lm[mcp + 3], lm[mcp + 2]);
    prox.push(b1);
    curl.push(Math.min(1, (angle(b0, b1) + angle(b1, b2) + angle(b2, b3)) / FINGER_RANGE));
  }
  const spread = [0, 1, 2].map((i) => angle(prox[i], prox[i + 1]) / 0.6);
  const palm = dist(lm[0], lm[9]) || 1;
  return {
    curl,
    spread,
    pinch: Math.min(2, dist(lm[4], lm[8]) / palm),
    palmNormal: palmNormal(lm, side),
    fingerDir: norm(sub(lm[9], lm[0])),
  };
}

/** Feature-group weights (tuned on perturbed avatar sequences; see tests/unit/recognizer.test.ts). */
export const W = { curl: 1.2, spread: 0.5, pinch: 0.8, orient: 0.9, pos: 0.9, flag: 1.5, other: 0.8 };
export const FEATURE_DIM = 5 + 3 + 1 + 3 + 3 + 3 + 1 + 1 + 3 + 3;
export const WEIGHTS: number[] = [
  ...Array(5).fill(W.curl), ...Array(3).fill(W.spread), W.pinch,
  ...Array(3).fill(W.orient), ...Array(3).fill(W.orient),
  ...Array(3).fill(W.pos), W.flag,
  W.flag, ...Array(3).fill(W.other), ...Array(3).fill(W.orient * 0.7),
];

export interface Body {
  nose: Pt | null;
  /** Upper-arm length: the unit all positions are measured in. */
  unit: number;
}
/** Median upper-arm length over the sequence (stable against single bad frames). */
export function bodyOf(frames: Frame[]): Body {
  const lengths: number[] = [];
  let nose: Pt | null = null;
  for (const f of frames) {
    const w = f.pose?.world;
    if (!w) continue;
    for (const [s, e] of [[POSE.rShoulder, POSE.rElbow], [POSE.lShoulder, POSE.lElbow]]) {
      const l = dist(w[s], w[e]);
      if (l > 1e-3) lengths.push(l);
    }
    nose ??= w[POSE.nose];
  }
  lengths.sort((a, b) => a - b);
  return { nose, unit: lengths.length ? lengths[lengths.length >> 1] : 0 };
}
const wristOf = (f: Frame, hand: HandObs | undefined, side: Side): Pt | null =>
  f.pose ? f.pose.world[side === "Right" ? POSE.rWrist : POSE.lWrist] : hand ? hand.world[0] : null;

/** One feature row for a frame, or null when no hand is visible. `leftHanded` swaps roles. */
export function frameFeatures(f: Frame, body: Body, leftHanded = false): number[] | null {
  const dom = leftHanded ? f.left : f.right;
  const other = leftHanded ? f.right : f.left;
  if (!dom && !other) return null;
  const row = new Array<number>(FEATURE_DIM).fill(0);
  const side: Side = leftHanded ? "Left" : "Right";
  const mirror = (p: Pt): Pt => (leftHanded ? { x: -p.x, y: p.y, z: p.z } : p);
  let wrist: Pt | null = null;
  if (dom) {
    const s = handShape(leftHanded ? dom.world.map(mirror) : dom.world, "Right");
    row.splice(0, 5, ...s.curl);
    row.splice(5, 3, ...s.spread);
    row[8] = s.pinch;
    row.splice(9, 3, s.palmNormal.x, s.palmNormal.y, s.palmNormal.z);
    row.splice(12, 3, s.fingerDir.x, s.fingerDir.y, s.fingerDir.z);
    wrist = wristOf(f, dom, side);
    if (wrist && body.nose && body.unit > 0) {
      const rel = mirror(sub(wrist, body.nose));
      row.splice(15, 3, rel.x / body.unit, rel.y / body.unit, rel.z / body.unit);
    }
    row[18] = 1;
  }
  if (other) {
    const otherSide: Side = leftHanded ? "Right" : "Left";
    const ow = wristOf(f, other, otherSide);
    row[19] = 1;
    if (ow && wrist && body.unit > 0) {
      const rel = mirror(sub(ow, wrist));
      row.splice(20, 3, rel.x / body.unit, rel.y / body.unit, rel.z / body.unit);
    } else if (ow && body.nose && body.unit > 0) {
      const rel = mirror(sub(ow, body.nose));
      row.splice(20, 3, rel.x / body.unit, rel.y / body.unit, rel.z / body.unit);
    }
    const n = palmNormal(leftHanded ? other.world.map(mirror) : other.world, "Left");
    row.splice(23, 3, n.x, n.y, n.z);
  }
  return row;
}

/** Light smoothing (3-tap) to suppress landmark jitter without erasing fast waves. */
export function smooth(rows: number[][]): number[][] {
  if (rows.length < 3) return rows;
  return rows.map((r, i) => {
    const a = rows[Math.max(0, i - 1)], b = rows[Math.min(rows.length - 1, i + 1)];
    return r.map((v, k) => 0.25 * a[k] + 0.5 * v + 0.25 * b[k]);
  });
}
export function resample(rows: number[][], steps = STEPS): number[][] {
  if (rows.length === 1) return Array.from({ length: steps }, () => rows[0].slice());
  return Array.from({ length: steps }, (_, i) => {
    const x = (i / (steps - 1)) * (rows.length - 1);
    const lo = Math.floor(x), hi = Math.min(lo + 1, rows.length - 1), t = x - lo;
    return rows[lo].map((v, k) => v * (1 - t) + rows[hi][k] * t);
  });
}
/** Frames → resampled feature rows; null if too little signal. */
export function sequenceFeatures(frames: Frame[], body: Body = bodyOf(frames), leftHanded = false): number[][] | null {
  const rows = frames.map((f) => frameFeatures(f, body, leftHanded)).filter((r): r is number[] => r !== null);
  if (rows.length < 5) return null;
  return resample(smooth(rows));
}
export const _internal = { len, dot };
