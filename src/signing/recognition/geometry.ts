import type { Pt } from "./types";
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Pt, b: Pt): Pt => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a: Pt) => Math.hypot(a.x, a.y, a.z);
export const norm = (a: Pt): Pt => {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / l);
};
export const dist = (a: Pt, b: Pt) => len(sub(a, b));
export const mid = (a: Pt, b: Pt): Pt => scale(add(a, b), 0.5);
/** Unsigned angle in radians between two vectors. */
export const angle = (a: Pt, b: Pt) => {
  const d = len(a) * len(b);
  return d < 1e-12 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot(a, b) / d)));
};
export const toAvatarFrame = (p: { x: number; y: number; z: number }): Pt => ({ x: p.x, y: -p.y, z: -p.z });
