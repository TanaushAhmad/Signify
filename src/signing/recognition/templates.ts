import * as THREE from "three";
import { bodyOf, sequenceFeatures } from "./features";
import { framesFromClip } from "./synth";
import type { Frame, Template } from "./types";
import type { Catalog } from "../pipeline";
import { SignRecognizer, type RecognizerOptions } from "./recognizer";
import { TRAINED_TEMPLATES } from "../gestureSignatures";

/** Bootstrap templates: play every sign the avatar can perform and record its features. */
export async function templatesFromCatalog(catalog: Catalog, signal?: AbortSignal): Promise<Template[]> {
  const out: Template[] = [];
  for (const sign of catalog.signs) {
    if (sign.kind !== "sign") continue;
    const response = await fetch(sign.url, { signal });
    if (!response.ok) continue;
    const clip = THREE.AnimationClip.parse(await response.json());
    const frames = framesFromClip(clip);
    const rows = sequenceFeatures(trimToMotion(frames, sign.motion), bodyOf(frames));
    if (rows) out.push({ id: sign.id, label: sign.label, rows, source: "avatar" });
  }
  return out;
}
/** Keep only the part of the clip where the sign is performed (drop rest-pose lead-in/out). */
export function trimToMotion(frames: Frame[], motion?: { start: number; end: number }): Frame[] {
  if (!motion) return frames;
  const kept = frames.filter((f) => f.t >= Math.max(0, motion.start - 0.15) && f.t <= motion.end + 0.15);
  return kept.length >= 5 ? kept : frames;
}

// ── user calibration, kept in this browser only ─────────────────────────────
const KEY = (language: string) => `signify.templates.${language}`;
export function loadUserTemplates(language: string): Template[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(language)) || "[]");
    return Array.isArray(raw) ? raw.filter((t) => t?.id && Array.isArray(t.rows)) : [];
  } catch {
    return [];
  }
}
export function saveUserTemplate(language: string, template: Template) {
  const all = loadUserTemplates(language);
  all.push({ ...template, source: "user" });
  localStorage.setItem(KEY(language), JSON.stringify(all.slice(-400)));
}
export function clearUserTemplates(language: string) {
  localStorage.removeItem(KEY(language));
}
export function buildRecognizer(avatar: Template[], user: Template[], options: Partial<RecognizerOptions> = {}) {
  return new SignRecognizer([...avatar, ...user], options);
}

/** Permanent examples (gestureSignatures.ts) plus ones added in this browser but not yet saved to the file. */
export function allTrainedTemplates(language: string): Template[] {
  return [...(TRAINED_TEMPLATES[language] || []), ...loadUserTemplates(language)];
}
