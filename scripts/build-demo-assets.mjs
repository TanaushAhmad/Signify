/** Project-authored ASL demo keyframes, guided by linked ASL University references.
 * These are approximations for this stylized rig, not independently validated motion capture.
 * No source images or videos are distributed. Run: node scripts/build-demo-assets.mjs
 */
import fs from "node:fs";
import * as THREE from "three";
import { q, rest, posed, posedTo, twoHand, palmOf, v3, flared } from "./rig-authoring.mjs";
import { everyday, morningSupport, facing, T, PALM_GAP } from "./everyday-signs.mjs";
import { buildPack } from "./lib/pack-builder.mjs";

const hi = (s = 0) =>
  posed([-0.43 + s * 0.06, 1.44, 0.2], q(0, 0, s * 0.25).multiply(q(Math.PI)));
// Middle fingertip starts on the chin/lips, then the hand travels forward and down.
const thanksA = flared(1.0, () => posedTo("MiddleTip", T.chin, q(0, 0, Math.PI), {}, "flat"));
const thanksB = posed([-0.025, 1.26, 0.46], q(0.7, 0, Math.PI), {}, "flat");
const ily = posed(
  [-0.32, 1.35, 0.25],
  q(Math.PI),
  { Middle: 1, Ring: 1 },
  "open",
);
const yes = (angle = 0) =>
  posed(
    [-0.23, 1.28, 0.28],
    q(Math.PI + angle),
    { Index: 1, Middle: 1, Ring: 1, Little: 1 },
    "fist",
  );
const no = (closed = false, yaw = 0) =>
  posed(
    [-0.23, 1.31, 0.29],
    q(Math.PI),
    { Index: closed ? [0.8, 0.65, 0.2] : 0, Middle: closed ? [0.8, 0.65, 0.2] : 0, Ring: 1, Little: 1 },
    closed ? "pinch" : "open",
    yaw,
  );

// ── New sign poses ─────────────────────────────────────────────────────────
// HELLO — open-hand salute from forehead, then sweep outward
// Flat B hand: all fingers extended and together, thumb alongside
// Fingertips touch the side of the forehead (salute), solved against the real head geometry.
// Palm faces forward/outward (not toward the face), fingers lean toward the temple, elbow flared out.
const helloA = flared(1.6, () => posedTo("MiddleTip", T.forehead, q(Math.PI - 0.15, 0.1, -0.4), {}, "flat"));
const helloB = flared(1.6, () => posed([-0.42, 1.5, 0.24], q(Math.PI - 0.1, 0.25, 0.15), {}, "flat"));

// GOOD MORNING — two-part compound sign
// "Good": flat hand touches chin then sweeps down into open palm
const goodA = flared(1.0, () => posedTo("MiddleTip", T.chin, q(0.35, 0, Math.PI), {}, "flat"));
const baseHand = [[0.005, 1.075, 0.35], facing([-1, 0, 0], [0, 1, 0]), {}, "flat"];
const goodB = twoHand(baseHand, { point: "Palm", target: () => palmOf("Left").add(v3(0, PALM_GAP, 0)), orientation: q(Math.PI / 2, 0, Math.PI), folds: {}, thumb: "flat" });
// "Morning": bent arm rises to indicate sun at horizon, head tilts slightly
const morningA = posed([-0.18, 1.16, 0.32],  q(Math.PI * 0.55, 0, Math.PI), { Middle: 0, Ring: 0, Little: 0 }, "open", 0, 0.05);
const morningB = posed([-0.18, 1.20, 0.32], q(Math.PI * 0.3, 0, Math.PI), { Middle: 0, Ring: 0, Little: 0 }, "open", 0, -0.05);

// BYE — open relaxed wave, palm faces out, hand sweeps side to side (looser than Hi)
const bye = (s = 0) =>
  posed([-0.44 + s * 0.07, 1.42, 0.22], q(0, 0, s * 0.3).multiply(q(Math.PI)), {}, "open");

const specs = [
  // ── Original five ──────────────────────────────────────────────────────
  {
    id: "hi",
    label: "Hi",
    reference: "h/hello.htm",
    anchors: [
      [0, rest],
      [0.6, hi(0)],
      [0.9, hi(-1)],
      [1.25, hi(1)],
      [1.6, hi(-1)],
      [1.95, hi(1)],
      [2.25, hi(0)],
      [2.65, hi(0)],
      [3.25, rest],
    ],
    note: "Side-to-side greeting wave, palm outward.",
  },
  {
    id: "thank-you",
    label: "Thank you",
    reference: "t/thankyou.htm",
    anchors: [
      [0, rest],
      [0.7, thanksA],
      [1, thanksA],
      [1.9, thanksB],
      [2.35, thanksB],
      [3, rest],
    ],
    note: "Flat dominant hand begins near lips and moves forward and slightly down.",
  },
  {
    id: "i-love-you",
    label: "I love you",
    reference: "i/ily.htm",
    anchors: [
      [0, rest],
      [0.75, ily],
      [2.5, ily],
      [3.15, rest],
    ],
    note: "ILY handshape: thumb, physical index and little finger extended; middle and ring folded. A lexicalized ILY sign, not sequential fingerspelling.",
  },
  {
    id: "yes",
    label: "Yes",
    reference: "y/yes.htm",
    anchors: [
      [0, rest],
      [0.6, yes(0.05)],
      [0.9, yes(0.05)],
      [1.2, yes(0.7)],
      [1.5, yes(0.05)],
      [1.8, yes(0.7)],
      [2.1, yes(0.05)],
      [2.5, yes(0.05)],
      [3.1, rest],
    ],
    note: "S handshape makes two wrist nods.",
  },
  {
    id: "no",
    label: "No",
    reference: "n/no.htm",
    anchors: [
      [0, rest],
      [0.6, no(false)],
      [0.9, no(false)],
      [1.2, no(true, -0.09)],
      [1.5, no(false, 0.09)],
      [1.8, no(true, -0.09)],
      [2.15, no(true, 0)],
      [2.45, no(true, 0)],
      [3.1, rest],
    ],
    note: "Physical index and middle fingers close to the thumb twice, with a small negative headshake.",
  },

  // ── Three new signs ────────────────────────────────────────────────────
  {
    id: "hello",
    label: "Hello",
    reference: "h/hello.htm",
    anchors: [
      [0,    rest],
      [0.55, helloA],
      [0.9,  helloA],
      [1.6,  helloB],
      [2.0,  helloB],
      [2.7,  rest],
    ],
    note: "Flat B hand, fingertips touch forehead then sweep outward and to the side — the standard ASL salute-style hello.",
  },
  {
    id: "good-morning",
    label: "Good morning",
    reference: "g/goodmorning.htm",
    anchors: [
      [0,    rest],
      [0.5,  goodA],
      [0.85, goodA],
      [1.4,  goodB],
      [1.75, goodB],
      [2.1,  morningA],
      [2.45, morningB],
      [2.8,  morningA],
      [3.1,  morningB],
      [3.5,  morningA],
      [3.85, rest],
    ],
    note: "Two-part compound: 'Good' — flat hand chin-to-palm sweep; 'Morning' — bent forearm rises twice to represent the rising sun.",
  },
  {
    id: "bye",
    label: "Bye",
    reference: "b/bye.htm",
    anchors: [
      [0,    rest],
      [0.5,  bye(0)],
      [0.8,  bye(-1)],
      [1.15, bye(1)],
      [1.5,  bye(-1)],
      [1.85, bye(1)],
      [2.15, bye(0)],
      [2.55, bye(0)],
      [3.1,  rest],
    ],
    note: "Relaxed open-hand farewell wave, palm outward, hand oscillates side to side — the universal goodbye gesture used in ASL.",
  },
];

specs.push(...everyday);
for (const spec of specs) {
  spec.hands ||= spec.id === "good-morning" ? "both" : "right";
  spec.aliases ||= spec.id === "bye" ? ["Goodbye"] : [];
  if (spec.id === "good-morning") {
    spec.reference = "m/morning.htm";
    spec.note = "Compound GOOD + MORNING, with a supporting base palm/forearm. See also g/good.htm. Contact is approximate on this stylized rig.";
    spec.anchors = [[0, rest], [0.6, morningSupport(goodA)], [1.2, goodB],
      [1.8, morningSupport(morningA, true)], [2.6, morningSupport(morningB, true)],
      [3, morningSupport(morningB, true)], [3.7, rest]];
  }
}

const review = (spec) => ({
  source: `https://www.lifeprint.com/asl101/pages-signs/${spec.reference}`,
  license: "Project-authored demo keyframes; reference media not redistributed",
  validation: "reference-demo",
  reviewedBy: "",
  reviewedOn: "",
});
const catalog = buildPack({
  language: "ASL",
  dir: "public/signing/asl-demo",
  catalogPath: "public/signing/catalog.json",
  captureDir: "captures/ASL",
  specs,
  review,
  title: "ASL demo animation references",
  notes: "These are original procedural animation keyframes for the existing Signify rig. They approximate source-described signs and have not been independently validated by an ASL signer. They are not a teaching resource or general sentence translation. No reference images or videos are redistributed.\n\nContact signs (face/chest/hand) are solved against the avatar's real geometry and checked by `node scripts/verify-contacts.mjs`. Motion is C1-continuous quaternion spline interpolation through the authored anchors. Meshes use rigid segments, not skin deformation; facial grammar remains approximate. All assets await independent ASL review.",
});
console.log(`Built ${specs.length} ASL clips: ${specs.map(s => s.label).join(", ")}.`);
await import("./esl-pack.mjs");
