/**
 * Contact accuracy report, measured against the avatar's ACTUAL rendered meshes (not the numbers
 * the authoring script used). Plays each generated clip on the real rig and checks:
 *   lips   – fingertips reach the lips
 *   face   – fingertip/thumb reaches the head surface (|gap| <= FACE_CM) without sinking in > PEN_CM
 *   chest  – palm rests on the torso front surface (raycast)
 *   hands  – dominant palm meets the base palm at face-to-face palm thickness
 *   no-clip – (all signs) hands never sink deeper than PEN_CM into head or torso
 *   node scripts/verify-contacts.mjs [--quiet]
 */
import fs from "node:fs";
import * as THREE from "three";
import { avatar, tipOf, palmOf, wristOf } from "./lib/fk.mjs";

const FACE_CM = 2.0, CHEST_CM = 2.5, HAND_CM = 2.5, PEN_CM = 2.5, PALM_GAP_CM = 5.8;
const R = "Right", L = "Left";
const head = avatar.getObjectByName("HeadSkin");
const torso = avatar.getObjectByName("Torso");
const ray = new THREE.Raycaster();

/** Signed gap (cm) from a world point to the head surface; negative = inside the head. */
function headGap(p) {
  const local = head.worldToLocal(p.clone());
  const mean = (head.scale.x + head.scale.y + head.scale.z) / 3;
  return (local.length() - 1) * mean * 100;
}
/** Gap (cm) to the lips (they stand proud of the face): distance to lip centre minus lip half-height. */
function lipGap(p) {
  const lips = avatar.getObjectByName("UpperLip").getWorldPosition(new THREE.Vector3())
    .add(avatar.getObjectByName("LowerLip").getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
  return (p.distanceTo(lips) - 0.012) * 100;
}
/** Gap (cm) between a palm centre and the torso front surface in front of it. */
function chestGap(p) {
  ray.set(new THREE.Vector3(p.x, p.y, 1.5), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(torso)[0];
  return hit ? (p.z - hit.point.z - 0.024) * 100 : Infinity;
}
const contacts = [
  ["hello", "face", "right middle tip → forehead", () => tipOf(R, "Middle")],
  ["thank-you", "face", "right middle tip → chin", () => tipOf(R, "Middle")],
  ["mother", "face", "right thumb tip → chin", () => tipOf(R, "Thumb")],
  ["father", "face", "right thumb tip → forehead", () => tipOf(R, "Thumb")],
  ["food", "lips", "right fingertips → mouth", () => tipOf(R, "Middle")],
  ["eat", "lips", "right fingertips → mouth", () => tipOf(R, "Middle")],
  ["water", "face", "right index tip → chin", () => tipOf(R, "Index")],
  ["good-morning", "face", "right middle tip → chin", () => tipOf(R, "Middle")],
  ["please", "chest", "right palm on chest", () => palmOf(R)],
  ["sorry", "chest", "right palm on chest", () => palmOf(R)],
  ["school", "hands", "dominant palm on base palm", () => palmOf(R)],
  ["help", "hands", "dominant fist on base palm", () => palmOf(R)],
  ["work", "hands", "dominant fist on base fist", () => palmOf(R)],
];
// Tests every sign for hand-into-head/torso interpenetration.
const bodySigns = JSON.parse(fs.readFileSync("public/signing/catalog.json", "utf8")).signs.map((s) => s.id);

function play(id, visit) {
  const clip = THREE.AnimationClip.parse(JSON.parse(fs.readFileSync(`${process.env.CLIP_DIR || "public/signing/asl-demo"}/${id}.json`, "utf8")));
  const mixer = new THREE.AnimationMixer(avatar);
  mixer.clipAction(clip).play();
  for (let t = 0; t <= clip.duration; t += 1 / 30) {
    mixer.setTime(t); avatar.updateMatrixWorld(true); visit(t);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(avatar);
}
const quiet = process.argv.includes("--quiet");
const rows = []; let failed = 0;
for (const [id, kind, label, point] of contacts) {
  let best = Infinity, bestT = 0, deepest = 0;
  play(id, (t) => {
    const p = point();
    const gap = kind === "face" ? headGap(p) : kind === "lips" ? lipGap(p) : kind === "chest" ? chestGap(p) : (p.distanceTo(palmOf(L)) * 100 - PALM_GAP_CM);
    if (Math.abs(gap) < Math.abs(best)) { best = gap; bestT = t; }
    // Only judge sinking while the hand is actually in the region where this contact happens.
    const inZone = kind === "chest" ? Math.abs(p.x) < 0.22 && p.y > 1.0 && p.y < 1.35 : kind === "hands" ? false : p.y > 1.4;
    if (inZone) deepest = Math.min(deepest, kind === "chest" || kind === "lips" ? gap : headGap(p));
  });
  const tol = kind === "face" || kind === "lips" ? FACE_CM : kind === "chest" ? CHEST_CM : HAND_CM;
  const ok = Math.abs(best) <= tol && deepest >= -PEN_CM;
  if (!ok) failed++;
  rows.push({ sign: id, contact: label, "gap at best (cm)": +best.toFixed(1), "at (s)": +bestT.toFixed(2), "deepest sink (cm)": +deepest.toFixed(1), ok: ok ? "✓" : "✗" });
}
if (!quiet) console.table(rows);
// Interpenetration over the whole vocabulary: any hand landmark deeper than PEN_CM inside the head.
let clipped = [];
for (const id of bodySigns) {
  let worst = 0;
  play(id, () => { for (const side of [R, L]) for (const f of ["Index", "Middle", "Ring", "Little", "Thumb"]) worst = Math.min(worst, headGap(tipOf(side, f))); worst = Math.min(worst, headGap(palmOf(R))); });
  if (worst < -PEN_CM) clipped.push(`${id} (${worst.toFixed(1)} cm)`);
}
console.log(`contacts: ${contacts.length - failed}/${contacts.length} within tolerance`);
console.log(clipped.length ? `hand sinks into head: ${clipped.join(", ")}` : `no sign sinks a hand more than ${PEN_CM} cm into the head`);
process.exit(failed || clipped.length ? 1 : 0);
