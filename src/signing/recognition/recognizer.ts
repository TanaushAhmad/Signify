import { bodyOf, sequenceFeatures, FEATURE_DIM, WEIGHTS, STEPS } from "./features";
import type { Candidate, Frame, Recognition, Template } from "./types";

/** Weighted DTW between two resampled sequences with a Sakoe-Chiba band; mean cost per path step. */
export function dtw(a: number[][], b: number[][], band = 6): number {
  const n = a.length, m = b.length, INF = 1e18;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
  const steps: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++)
    for (let j = Math.max(1, i - band); j <= Math.min(m, i + band); j++) {
      let d = 0;
      for (let k = 0; k < FEATURE_DIM; k++) {
        const diff = a[i - 1][k] - b[j - 1][k];
        d += WEIGHTS[k] * diff * diff;
      }
      d = Math.sqrt(d);
      const options: [number, number][] = [
        [cost[i - 1][j - 1], steps[i - 1][j - 1]],
        [cost[i - 1][j], steps[i - 1][j]],
        [cost[i][j - 1], steps[i][j - 1]],
      ];
      const [prev, count] = options.reduce((x, y) => (y[0] < x[0] ? y : x));
      cost[i][j] = prev + d;
      steps[i][j] = count + 1;
    }
  return cost[n][m] / Math.max(steps[n][m], 1);
}

export interface RecognizerOptions {
  /** Report nothing when even the closest sign is farther than this (weighted feature distance). */
  maxDistance: number;
  /** Softmax temperature for the displayed confidence. */
  temperature: number;
  leftHanded: boolean;
  /** Real recordings count for more than avatar-derived bootstrap templates. */
  userBonus: number;
}
export const DEFAULTS: RecognizerOptions = {
  maxDistance: 2.0,
  temperature: 0.22,
  leftHanded: false,
  userBonus: 0.8,
};

export class SignRecognizer {
  readonly options: RecognizerOptions;
  constructor(readonly templates: Template[], options: Partial<RecognizerOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }
  /**
   * Classify ONE sign performed in `frames`. The closest sign wins even when a runner-up is near
   * (e.g. Thank you 43% vs Good morning 32% → Thank you); the ranked list carries the confidences.
   * Only "nothing resembles any known sign" is rejected.
   */
  recognize(frames: Frame[]): Recognition {
    if (!frames.some((f) => f.right || f.left)) return { accepted: false, best: null, ranked: [], reason: "no-hand" };
    const rows = sequenceFeatures(frames, bodyOf(frames), this.options.leftHanded);
    if (!rows || rows.length !== STEPS) return { accepted: false, best: null, ranked: [], reason: "too-short" };
    const bestPerSign = new Map<string, { label: string; d: number }>();
    for (const t of this.templates) {
      const d = dtw(rows, t.rows) * (t.source === "user" ? this.options.userBonus : 1);
      const old = bestPerSign.get(t.id);
      if (!old || d < old.d) bestPerSign.set(t.id, { label: t.label, d });
    }
    const entries = [...bestPerSign.entries()].sort((x, y) => x[1].d - y[1].d);
    if (!entries.length) return { accepted: false, best: null, ranked: [], reason: "no-match" };
    const weights = entries.map(([, v]) => Math.exp(-(v.d - entries[0][1].d) / this.options.temperature));
    const total = weights.reduce((a, b) => a + b, 0);
    const ranked: Candidate[] = entries.map(([id, v], i) => ({ id, label: v.label, distance: v.d, confidence: weights[i] / total }));
    const [best] = ranked;
    if (best.distance > this.options.maxDistance) return { accepted: false, best, ranked, reason: "no-match" };
    return { accepted: true, best, ranked };
  }
}
