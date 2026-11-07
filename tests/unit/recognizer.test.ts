/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "vitest";
import { bodyOf, sequenceFeatures } from "../../src/signing/recognition/features";
import { SignRecognizer } from "../../src/signing/recognition/recognizer";
import { trimToMotion } from "../../src/signing/recognition/templates";
import { framesFromClip } from "../../src/signing/recognition/synth";
import { segmentSigns } from "../../src/signing/recognition/segment";
import type { Template } from "../../src/signing/recognition/types";
import { aslCatalog, clipOf } from "./helpers";

const templates: Template[] = aslCatalog.signs.flatMap((s) => {
  const frames = framesFromClip(clipOf(aslCatalog, s.id));
  const rows = sequenceFeatures(trimToMotion(frames, s.motion), bodyOf(frames));
  return rows ? [{ id: s.id, label: s.label, rows, source: "avatar" as const }] : [];
});
const perform = (id: string, noise: number, speed: number, seed: number) => {
  const s = aslCatalog.signs.find((x) => x.id === id)!;
  return trimToMotion(framesFromClip(clipOf(aslCatalog, id), { noise, speed, seed }), s.motion
    ? { start: s.motion.start / speed, end: s.motion.end / speed } : undefined);
};
function evaluate(noise: number, speeds: number[], seeds: number[]) {
  const rec = new SignRecognizer(templates);
  let right = 0, wrong = 0, rejected = 0, total = 0;
  const confusions: string[] = [], rejections: string[] = [];
  for (const s of aslCatalog.signs) for (const speed of speeds) for (const seed of seeds) {
    const r = rec.recognize(perform(s.id, noise, speed, seed));
    total++;
    if (!r.accepted) rejected++;
    else if (r.best!.id === s.id) right++;
    else { wrong++; confusions.push(`${s.id}→${r.best!.id}`); }
    if (!r.accepted && noise === 0.004) rejections.push(`${s.id}(${r.reason}:${r.ranked[1]?.id})`);
  }
  return { right, wrong, rejected, total, confusions, rejections };
}
describe("sign recognizer on perturbed avatar performances", () => {
  test("has a template for every sign", () => expect(templates).toHaveLength(aslCatalog.signs.length));
  test("clean replay", () => {
    const r = evaluate(0, [1], [1]);
    console.log("clean", JSON.stringify(r));
    expect(r.wrong).toBe(0);
    expect(r.right / r.total).toBeGreaterThan(0.95);
  });
  test("4 mm landmark jitter + speed 0.8–1.25x: closest sign wins", () => {
    const r = evaluate(0.004, [0.8, 1.25], [1, 2]);
    console.log("jitter 4mm", JSON.stringify({ right: r.right, wrong: r.wrong, rejected: r.rejected, confusions: [...new Set(r.confusions)] }));
    expect(r.rejected).toBe(0);
    expect(r.right / r.total).toBeGreaterThan(0.9);
  });
  test("a close call still names the closest sign and ranks the runners-up with confidences", () => {
    const rec = new SignRecognizer(templates);
    const r = rec.recognize(perform("hi", 0.004, 1, 5));
    expect(r.accepted).toBe(true);
    expect(["hi", "bye"]).toContain(r.best!.id);
    expect(r.ranked[0].confidence).toBeGreaterThanOrEqual(r.ranked[1].confidence);
    expect(r.ranked.reduce((a, c) => a + c.confidence, 0)).toBeCloseTo(1, 5);
  });
  test("1 cm jitter degrades gracefully (reported, not a pass mark)", () => {
    const r = evaluate(0.01, [1], [1, 2]);
    console.log("jitter 1cm", JSON.stringify({ right: r.right, wrong: r.wrong, rejected: r.rejected, total: r.total }));
    expect(r.right + r.wrong + r.rejected).toBe(r.total);
  });
  test("rejects a hand held still and a hand that is absent", () => {
    const rec = new SignRecognizer(templates);
    expect(rec.recognize([]).reason).toBe("no-hand");
    const rest = framesFromClip(clipOf(aslCatalog, "hello")).slice(0, 8);
    expect(rec.recognize(rest).accepted).toBe(false);
  });
  test("segments a back-to-back recording into its signs", () => {
    const a = framesFromClip(clipOf(aslCatalog, "hello")), b = framesFromClip(clipOf(aslCatalog, "water"));
    const shift = a[a.length - 1].t + 0.1;
    const frames = [...a, ...b.map((f) => ({ ...f, t: f.t + shift }))];
    const segs = segmentSigns(frames);
    console.log("segments", segs.map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)}`).join(" "));
    expect(segs).toHaveLength(2);
    const rec = new SignRecognizer(templates);
    expect(segs.map((s) => rec.recognize(s.frames).best?.id)).toEqual(["hello", "water"]);
  });
});
