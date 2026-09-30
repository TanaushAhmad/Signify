/**
 * gestureClassifier
 * -----------------
 * Classifies a window of recent hand-landmark frames into one of the 8 known
 * phrases. Works in two steps:
 *
 *  1. For each frame, normalise the 21 landmarks into a 63-element feature
 *     vector (translation- and scale-invariant, relative to wrist + middle
 *     finger MCP baseline distance).
 *
 *  2. Average the feature vectors across the window, then compute cosine
 *     similarity against every stored reference signature. Return the best
 *     match if it clears a confidence threshold.
 *
 * This is deliberately lightweight — no WASM, no model file, runs in <1ms
 * per frame on any modern device.
 */

import type { Landmark } from "../hooks/useHandTracking";
import { GESTURE_SIGNATURES } from "./gestureSignatures";

export type GestureLabel = keyof typeof GESTURE_SIGNATURES;

export interface ClassifierResult {
  label: GestureLabel;
  confidence: number; // 0–1 cosine similarity
}

// ── Feature extraction ───────────────────────────────────────────────────────

/**
 * Convert 21 raw landmarks into a 63-element normalised feature vector.
 *
 * Normalisation:
 *  - Translate so the wrist (index 0) is at the origin.
 *  - Scale so the distance from wrist → middle-finger MCP (index 9) = 1.
 *  - Flatten to [x0,y0,z0, x1,y1,z1, …].
 */
export function extractFeatures(landmarks: Landmark[]): Float32Array {
  const wrist = landmarks[0];
  const ref = landmarks[9]; // middle finger MCP
  const scale = Math.hypot(
    ref.x - wrist.x,
    ref.y - wrist.y,
    ref.z - wrist.z,
  ) || 1;

  const vec = new Float32Array(63);
  for (let i = 0; i < 21; i++) {
    vec[i * 3 + 0] = (landmarks[i].x - wrist.x) / scale;
    vec[i * 3 + 1] = (landmarks[i].y - wrist.y) / scale;
    vec[i * 3 + 2] = (landmarks[i].z - wrist.z) / scale;
  }
  return vec;
}

/** Element-wise average of an array of feature vectors. */
function averageVectors(vecs: Float32Array[]): Float32Array {
  const out = new Float32Array(63);
  for (const v of vecs) for (let i = 0; i < 63; i++) out[i] += v[i];
  for (let i = 0; i < 63; i++) out[i] /= vecs.length;
  return out;
}

/** Cosine similarity in [−1, 1]. We use it as a 0–1 confidence proxy. */
function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-9 ? 0 : dot / denom;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Minimum cosine similarity to report a match (tune after recording). */
export const CONFIDENCE_THRESHOLD = 0.82;

/**
 * Classify a rolling window of landmark frames.
 * Returns null if the window is empty or no gesture clears the threshold.
 */
export function classify(
  window: Landmark[][],
): ClassifierResult | null {
  if (window.length === 0) return null;

  const features = window.map(extractFeatures);
  const query = averageVectors(features);

  let best: ClassifierResult | null = null;

  for (const [label, signature] of Object.entries(GESTURE_SIGNATURES) as [GestureLabel, number[]][]) {
    const ref = new Float32Array(signature);
    const sim = cosineSim(query, ref);
    if (!best || sim > best.confidence) {
      best = { label, confidence: sim };
    }
  }

  if (!best || best.confidence < CONFIDENCE_THRESHOLD) return null;
  return best;
}

/**
 * Compute the average feature vector for a set of captured frames.
 * Used by the recorder page to produce a signature you can paste into
 * gestureSignatures.ts.
 */
export function computeSignature(frames: Landmark[][]): number[] {
  if (frames.length === 0) return [];
  const avg = averageVectors(frames.map(extractFeatures));
  return Array.from(avg);
}
