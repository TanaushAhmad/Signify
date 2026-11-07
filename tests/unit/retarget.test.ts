/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { createNeutralAvatar } from "../../src/signing/neutralAvatar";
import { frameOf, handLandmarks } from "../../src/signing/recognition/synth";
import { retargetFrame, clipFromFrames } from "../../src/signing/recognition/retarget";
import { framesFromClip } from "../../src/signing/recognition/synth";
import { aslCatalog, clipOf } from "./helpers";
import { dist } from "../../src/signing/recognition/geometry";

/** Pose → landmarks → retarget → pose → landmarks: how far do the landmarks drift? */
function roundTrip(id: string, t: number) {
  const source = createNeutralAvatar();
  const mixer = new THREE.AnimationMixer(source);
  mixer.clipAction(clipOf(aslCatalog, id)).play();
  mixer.setTime(t);
  const frame = frameOf(source, t);
  const rebuilt = createNeutralAvatar();
  const pose = retargetFrame(frame).Right!;
  for (const [name, quat] of Object.entries(pose)) rebuilt.getObjectByName(name)!.quaternion.copy(quat);
  rebuilt.updateMatrixWorld(true);
  const before = frame.right!.world, after = handLandmarks(rebuilt, "Right");
  const tipIdx = [4, 8, 12, 16, 20];
  return {
    wrist: dist(before[0], after[0]) * 100,
    tips: tipIdx.map((i) => dist(before[i], after[i]) * 100),
  };
}

describe("landmark → avatar retargeting (round trip on avatar-generated landmarks)", () => {
  const cases: [string, number][] = [["hello", 0.6], ["thank-you", 0.7], ["water", 1.0], ["i-love-you", 1.5], ["yes", 1.2], ["mother", 0.9], ["no", 1.3]];
  for (const [id, t] of cases)
    test(`${id} @ ${t}s: wrist and fingertips reproduce`, () => {
      const r = roundTrip(id, t);
      expect(r.wrist).toBeLessThan(0.5); // cm: arm bone directions are exact
      const mean = r.tips.reduce((a, b) => a + b, 0) / 5;
      console.log(`${id}: wrist ${r.wrist.toFixed(2)} cm, fingertip errors (cm) ${r.tips.map((x) => x.toFixed(1)).join(" ")} mean ${mean.toFixed(2)}`);
      expect(mean).toBeLessThan(3.0);
    });
  test("clipFromFrames produces a loadable, rest-to-rest clip", () => {
    const frames = framesFromClip(clipOf(aslCatalog, "hello"));
    const result = clipFromFrames(frames, "captured-hello")!;
    expect(result.clip.validate()).toBe(true);
    expect(result.coverage).toBeGreaterThan(0.6); // resting hands are (correctly) not tracked
    expect(result.motion.end).toBeGreaterThan(result.motion.start);
    const first = result.clip.tracks.find((t) => t.name === "RightForearm.quaternion")!;
    expect(Array.from(first.values.slice(0, 4))).toEqual([0, 0, 0, 1]); // starts at rest
  });
});
