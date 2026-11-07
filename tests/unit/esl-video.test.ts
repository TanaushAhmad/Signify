/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "vitest";
import { loadFrames } from "../../scripts/lib/landmark-frames";
import { segmentSigns } from "../../src/signing/recognition/segment";
import { bodyOf, sequenceFeatures } from "../../src/signing/recognition/features";
import { SignRecognizer } from "../../src/signing/recognition/recognizer";
import { trimToMotion } from "../../src/signing/recognition/templates";
import { framesFromClip } from "../../src/signing/recognition/synth";
import { TRAINED_TEMPLATES } from "../../src/signing/gestureSignatures";
import type { Template } from "../../src/signing/recognition/types";
import { eslCatalog, clipOf } from "./helpers";

const plan = [["scripts/data/esl-zayed-video-1.json", ["salaam-alaikum", "how-are-you", "fine"]], ["scripts/data/esl-zayed-video-2.json", ["thank-you", "you-are-welcome"]]] as const;
const avatarTemplates: Template[] = eslCatalog.signs.map((s) => {
  const f = framesFromClip(clipOf(eslCatalog, s.id));
  return { id: s.id, label: s.label, rows: sequenceFeatures(trimToMotion(f, s.motion), bodyOf(f))!, source: "avatar" as const };
});
describe("real ESL video landmarks", () => {
  test("segmentation finds each demonstrated sign", () => {
    for (const [file, ids] of plan) expect(segmentSigns(loadFrames(file))).toHaveLength(ids.length);
  });
  test("permanent gestureSignatures.ts holds one real example per video sign", () => {
    expect((TRAINED_TEMPLATES.ESL || []).map((t) => t.id).sort()).toEqual(plan.flatMap(([, ids]) => [...ids]).sort());
  });
  // Cross-domain: real-camera landmarks vs templates made ONLY from the avatar's retargeted clips.
  // Not independent evidence (same signer produced both) but it exercises camera-vs-avatar feature agreement.
  test("real landmarks are matched to the right sign using avatar-derived templates only", () => {
    const rec = new SignRecognizer(avatarTemplates);
    const got: string[] = [], want: string[] = [];
    for (const [file, ids] of plan) segmentSigns(loadFrames(file)).forEach((seg, i) => { const r = rec.recognize(seg.frames); got.push(`${ids[i]}→${r.best?.id}(${Math.round((r.best?.confidence ?? 0) * 100)}%)`); want.push(`${ids[i]}→${ids[i]}`); });
    console.log("video→avatar-template matches:", got.join("  "));
    const correct = got.filter((g, i) => g.startsWith(want[i] + "(")).length;
    expect(correct).toBeGreaterThanOrEqual(4);
  });
  test("with the permanent real examples, every video sign is recognised", () => {
    const rec = new SignRecognizer([...avatarTemplates, ...(TRAINED_TEMPLATES.ESL as Template[])]);
    for (const [file, ids] of plan) segmentSigns(loadFrames(file)).forEach((seg, i) => expect(rec.recognize(seg.frames).best?.id).toBe(ids[i]));
  });
});
