/** Landmark space used everywhere in recognition: metres-ish, x → signer's LEFT (viewer's right),
 *  y up, z toward the viewer. This is the avatar's own frame, so camera data and avatar-derived
 *  templates are directly comparable. */
export interface Pt {
  x: number;
  y: number;
  z: number;
}
export type Side = "Left" | "Right";
export interface HandObs {
  /** 21 MediaPipe hand landmarks. */
  world: Pt[];
  side: Side;
  score: number;
}
export interface PoseObs {
  /** 33 MediaPipe pose landmarks (only 0, 11–16 are required). */
  world: Pt[];
  /** Per-landmark visibility 0–1 when the tracker provides it. */
  vis?: number[];
}
export interface Frame {
  /** seconds */
  t: number;
  right?: HandObs;
  left?: HandObs;
  pose?: PoseObs;
}
export interface Candidate {
  id: string;
  label: string;
  distance: number;
  /** 0–1 share of probability mass among all signs (softmax over −distance). */
  confidence: number;
}
export interface Recognition {
  accepted: boolean;
  best: Candidate | null;
  ranked: Candidate[];
  /** Why nothing was returned (shown to the user instead of guessing). */
  reason?: "no-hand" | "too-short" | "no-match";
}
export interface Template {
  id: string;
  label: string;
  /** Resampled feature rows (STEPS × FEATURE_DIM). */
  rows: number[][];
  source: "avatar" | "user";
  /** Where a trained example came from (shown in the training UI; never contains imagery). */
  origin?: string;
}
export const POSE = { nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16 } as const;
