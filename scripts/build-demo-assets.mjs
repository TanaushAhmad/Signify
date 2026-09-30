/** Project-authored ASL demo keyframes, guided by linked ASL University references.
 * These are approximations for this stylized rig, not independently validated motion capture.
 * No source images or videos are distributed. Run: node scripts/build-demo-assets.mjs
 */
import fs from "node:fs";
import * as THREE from "three";
const q = (x = 0, y = 0, z = 0) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const bones = [
  "RightUpperArm",
  "RightForearm",
  "RightHand",
  "Head",
  ...["Thumb", "Index", "Middle", "Ring", "Little"].flatMap((f) =>
    [1, 2, 3].map((j) => `Right${f}${j}`),
  ),
];
const rest = Object.fromEntries(
  bones.map((name) => [
    name,
    q(
      0,
      0,
      name === "RightUpperArm" ? -0.13 : name === "RightThumb1" ? 0.65 : 0,
    ),
  ]),
);
function posed(wrist, orientation, folds = {}, thumb = "open", headYaw = 0, headPitch = 0) {
  const pose = Object.fromEntries(
    bones.map((name) => [name, rest[name].clone()]),
  );
  const shoulder = new THREE.Vector3(-0.29, 1.29, 0),
    target = new THREE.Vector3(...wrist);
  const delta = target.clone().sub(shoulder),
    d = delta.length(),
    u = delta.clone().normalize(),
    a = (0.31 ** 2 - 0.28 ** 2 + d * d) / (2 * d);
  if (d > 0.589) throw Error("Unreachable wrist target");
  const bend = new THREE.Vector3(-0.45, -1, 0.1);
  bend.addScaledVector(u, -bend.dot(u)).normalize();
  const elbow = shoulder
    .clone()
    .addScaledVector(u, a)
    .addScaledVector(bend, Math.sqrt(0.31 ** 2 - a * a));
  const upper = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    elbow.clone().sub(shoulder).normalize(),
  );
  const forearm = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    target.clone().sub(elbow).normalize(),
  );
  pose.RightUpperArm = upper;
  pose.RightForearm = upper.clone().invert().multiply(forearm);
  pose.RightHand = forearm.clone().invert().multiply(orientation);
  for (const finger of ["Index", "Middle", "Ring", "Little"]) {
    const curl = folds[finger] || 0;
    for (let j = 1; j <= 3; j++)
      pose[`Right${finger}${j}`] = q(curl * [0.85, 1.5, 0.85][j - 1]);
  }
  if (thumb === "open") pose.RightThumb1 = q(0, 0, 1.2);
  if (thumb === "flat") {
    pose.RightThumb1 = q(0.1, 0, 0.12);
    pose.RightThumb2 = q(0.12);
  }
  if (thumb === "fist") {
    pose.RightThumb1 = q(0.65, -0.15, -0.7);
    pose.RightThumb2 = q(0.55);
    pose.RightThumb3 = q(0.2);
  }
  if (thumb === "pinch") {
    pose.RightThumb1 = q(0.6, 0, -0.35);
    pose.RightThumb2 = q(0.35);
    pose.RightThumb3 = q(0.1);
  }
  pose.Head = q(headPitch, headYaw, 0);
  return pose;
}

// ── Existing sign poses ────────────────────────────────────────────────────
const hi = (s = 0) =>
  posed([-0.43 + s * 0.06, 1.44, 0.2], q(0, 0, s * 0.25).multiply(q(Math.PI)));
const thanksA = posed([-0.025, 1.35, 0.19], q(0, 0, Math.PI), {}, "flat");
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
    { Index: 1, Middle: 1, Ring: closed ? 0.8 : 0, Little: closed ? 0.8 : 0 },
    closed ? "pinch" : "open",
    yaw,
  );

// ── New sign poses ─────────────────────────────────────────────────────────
// HELLO — open-hand salute from forehead, then sweep outward
// Flat B hand: all fingers extended and together, thumb alongside
const helloA = posed([-0.1, 1.52, 0.18], q(0.2, -0.2, Math.PI * 0.9), {}, "flat");
const helloB = posed([-0.38, 1.48, 0.22], q(0.1, 0.1, Math.PI * 0.85), {}, "flat");

// GOOD MORNING — two-part compound sign
// "Good": flat hand touches chin then sweeps down into open palm
const goodA = posed([-0.04, 1.38, 0.15], q(0.35, 0, Math.PI), {}, "flat");
const goodB = posed([-0.04, 1.26, 0.4],  q(0.6, 0, Math.PI * 0.95), {}, "flat");
// "Morning": bent arm rises to indicate sun at horizon, head tilts slightly
const morningA = posed([-0.28, 1.2, 0.3],  q(Math.PI * 0.55, 0, Math.PI), { Middle: 0, Ring: 0, Little: 0 }, "open", 0, 0.05);
const morningB = posed([-0.28, 1.38, 0.18], q(Math.PI * 0.45, 0, Math.PI), { Middle: 0, Ring: 0, Little: 0 }, "open", 0, -0.05);

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

const review = (reference) => ({
  source: `https://www.lifeprint.com/asl101/pages-signs/${reference}`,
  license: "Project-authored demo keyframes; reference media not redistributed",
  validation: "reference-demo",
  reviewedBy: "",
  reviewedOn: "",
});
const catalog = {
  version: 1,
  language: "ASL",
  rig: { id: "signify-neutral-v1", url: null },
  signs: [],
  phrases: [],
};
fs.mkdirSync("public/signing/asl-demo", { recursive: true });
for (const spec of specs) {
  const duration = spec.anchors.at(-1)[0],
    times = Array.from({ length: Math.ceil(duration * 30) + 1 }, (_, i) =>
      Math.min(i / 30, duration),
    );
  times[times.length - 1] = duration;
  const tracks = bones.map((name) => {
    const values = times.flatMap((time) => {
      let i = spec.anchors.findIndex(([t]) => t >= time);
      if (i <= 0) return rest[name].toArray();
      const [a, pA] = spec.anchors[i - 1],
        [b, pB] = spec.anchors[i];
      let t = (time - a) / (b - a);
      t = t * t * (3 - 2 * t);
      return pA[name].clone().slerp(pB[name], t).toArray();
    });
    return new THREE.QuaternionKeyframeTrack(
      `${name}.quaternion`,
      times,
      values,
    );
  });
  const clip = new THREE.AnimationClip(`asl-demo-${spec.id}`, duration, tracks);
  fs.writeFileSync(
    `public/signing/asl-demo/${spec.id}.json`,
    JSON.stringify(THREE.AnimationClip.toJSON(clip)) + "\n",
  );
  const meta = review(spec.reference);
  catalog.signs.push({
    id: spec.id,
    label: spec.label,
    kind: "sign",
    rigId: "signify-neutral-v1",
    url: `/signing/asl-demo/${spec.id}.json`,
    cues: [{ start: 0, caption: spec.label }],
    ...meta,
  });
  catalog.phrases.push({
    text: spec.label,
    signIds: [spec.id],
    transitionSeconds: 0,
    ...meta,
  });
}
fs.writeFileSync(
  "public/signing/catalog.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
fs.writeFileSync(
  "public/signing/asl-demo/REFERENCES.md",
  "# ASL demo animation references\n\nThese are original procedural animation keyframes for the existing Signify rig. They approximate source-described signs and have not been independently validated by an ASL signer. They are not a teaching resource or general sentence translation. No reference images or videos are redistributed.\n\n" +
    specs
      .map(
        (s) =>
          `- **${s.label}**: ${s.note} Reference: https://www.lifeprint.com/asl101/pages-signs/${s.reference}`,
      )
      .join("\n") +
    "\n\nAll clips have their own motion, handshape, entry, hold, and exit poses. The existing avatar model and mixer are unchanged. Bone-name ordering on the physical right hand is accounted for in the animation authoring script.\n",
);
console.log(`Built ${specs.length} distinct reference-based ASL demo clips: ${specs.map(s => s.label).join(", ")}.`);
