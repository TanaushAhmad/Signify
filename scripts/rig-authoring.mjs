import fs from "node:fs";
import * as THREE from "three";
import { applyPose, tipOf, palmOf, wristOf, bodyAnchors } from "./lib/fk.mjs";
export const config = JSON.parse(fs.readFileSync(new URL("../src/signing/rigConfig.json", import.meta.url), "utf8"));
export const q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
export const bones = ["Head", "LeftBrow", "RightBrow", ...config.sides.flatMap(side => [
  `${side}Shoulder`, `${side}UpperArm`, `${side}Forearm`, `${side}Hand`,
  ...config.fingers.flatMap(f => [1, 2, 3].map(j => `${side}${f}${j}`)),
])];
export const rest = Object.fromEntries(bones.map(name => [name, q(0, 0,
  name.endsWith("UpperArm") ? (name.startsWith("Left") ? 0.13 : -0.13) :
    name.endsWith("Thumb1") ? (name.startsWith("Left") ? -0.65 : 0.65) : 0)]));
const clamp = THREE.MathUtils.clamp;
/** How far the elbow swings out to the side (0.45 = hangs close to the body; ~1.5 = signer\'s "elbow out" for face signs). */
export const elbowStyle = { flare: 0.45 };
export function flared(k, build) {
  const previous = elbowStyle.flare;
  elbowStyle.flare = k;
  try { return build(); } finally { elbowStyle.flare = previous; }
}
const thumbs = {
  open: [[0, 0, 1.05], [0.05, 0, 0], [0.03, 0, 0]],
  flat: [[0.1, 0, 0.12], [0.12, 0, 0], [0.04, 0, 0]],
  fist: [[0.65, -0.15, -0.7], [0.55, 0, 0], [0.2, 0, 0]],
  a: [[0.05, 0, 0.25], [0.08, 0, 0], [0.06, 0, 0]],
  pinch: [[0.6, 0, -0.35], [0.35, 0, 0], [0.1, 0, 0]],
};
export function handshape(pose, side, folds = {}, thumb = "open", spreads = {}) {
  const mirror = side === "Right" ? 1 : -1;
  for (const finger of ["Index", "Middle", "Ring", "Little"]) {
    const value = folds[finger] ?? 0;
    // Explicit three-element arrays allow independent MCP/PIP/DIP authoring.
    const joints = Array.isArray(value) ? value : [value * 0.85, value * 1.5, value * 0.85];
    for (let j = 0; j < 3; j++) pose[`${side}${finger}${j + 1}`] = q(
      clamp(joints[j], 0, config.fingerFlexion[j]), 0,
      j === 0 ? mirror * clamp(spreads[finger] || 0, -config.fingerSpread, config.fingerSpread) : 0);
  }
  (Array.isArray(thumb) ? thumb : thumbs[thumb]).forEach((xyz, j) => {
    const limits = config.thumbLimits[j];
    pose[`${side}Thumb${j + 1}`] = q(...xyz.map((v, axis) =>
      clamp(v * (axis ? mirror : 1), limits[axis * 2], limits[axis * 2 + 1])));
  });
}
export function arm(pose, side, wrist, orientation, folds = {}, thumb = "open", spreads = {}) {
  const direction = side === "Right" ? -1 : 1;
  const shoulder = new THREE.Vector3(direction * 0.29, 1.29, 0);
  const target = new THREE.Vector3(...wrist);
  const delta = target.clone().sub(shoulder), d = delta.length(), u = delta.clone().normalize();
  // Keep the elbow away from a locked straight arm or impossible folded pose.
  if (d > 0.58 || d < 0.14) throw Error(`Unreachable ${side} wrist target: ${wrist}`);
  const a = (0.31 ** 2 - 0.28 ** 2 + d * d) / (2 * d);
  const bend = new THREE.Vector3(direction * elbowStyle.flare, -1, 0.1);
  bend.addScaledVector(u, -bend.dot(u)).normalize();
  const elbow = shoulder.clone().addScaledVector(u, a).addScaledVector(bend, Math.sqrt(0.31 ** 2 - a * a));
  const upper = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), elbow.clone().sub(shoulder).normalize());
  const forearm = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(elbow).normalize());
  // Pronation/supination belongs in the forearm, not an axial wrist twist.
  const relative = forearm.clone().invert().multiply(orientation);
  const twist = new THREE.Quaternion(0, relative.y, 0, relative.w).normalize();
  forearm.multiply(twist);
  const wristEuler = new THREE.Euler().setFromQuaternion(forearm.clone().invert().multiply(orientation), "XYZ");
  const limits = config.wristLimits;
  const shoulderRotation = new THREE.Quaternion().slerp(upper, 0.12);
  pose[`${side}Shoulder`] = shoulderRotation;
  pose[`${side}UpperArm`] = shoulderRotation.clone().invert().multiply(upper);
  pose[`${side}Forearm`] = upper.clone().invert().multiply(forearm);
  pose[`${side}Hand`] = q(clamp(wristEuler.x, -limits[0], limits[0]), clamp(wristEuler.y, -limits[1], limits[1]), clamp(wristEuler.z, -limits[2], limits[2]));
  handshape(pose, side, folds, thumb, spreads);
  return pose;
}
export function posed(wrist, orientation, folds = {}, thumb = "open", headYaw = 0, headPitch = 0, spreads = {}) {
  const pose = Object.fromEntries(bones.map(name => [name, rest[name].clone()]));
  arm(pose, "Right", wrist, orientation, folds, thumb, spreads);
  pose.Head = q(headPitch, headYaw, 0);
  return pose;
}
export function question(pose) {
  pose.LeftBrow = q(0, 0, 0.2);
  pose.RightBrow = q(0, 0, -0.2);
  pose.Head = q(0.12);
  return pose;
}

// ── Contact-based authoring ─────────────────────────────────────────────────
// Instead of guessing wrist coordinates, say WHICH part of the hand must touch WHERE and let the
// solver find the wrist. It iterates against real forward kinematics of the rendered avatar, so
// "fingertip touches chin" is true in the browser, not just on paper.
export const anchor = bodyAnchors();
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);
export const contactPoints = {
  IndexTip: (s) => tipOf(s, "Index"),
  MiddleTip: (s) => tipOf(s, "Middle"),
  ThumbTip: (s) => tipOf(s, "Thumb"),
  FingerPads: (s) => mid(tipOf(s, "Index"), tipOf(s, "Middle")),
  IndexThumbGap: (s) => mid(tipOf(s, "Index"), tipOf(s, "Thumb")),
  Palm: palmOf,
  Wrist: wristOf,
};
export const defaultPose = () => Object.fromEntries(bones.map(name => [name, rest[name].clone()]));
const shoulderOf = (side) => v3((side === "Right" ? -1 : 1) * 0.29, 1.29, 0);
export function armTo(pose, side, point, target, orientation, folds = {}, thumb = "open", spreads = {}) {
  const shoulder = shoulderOf(side);
  const wrist = target.clone().add(v3(0, -0.14, -0.02));
  let error = Infinity;
  for (let i = 0; i < 24; i++) {
    const reach = wrist.clone().sub(shoulder);
    reach.setLength(THREE.MathUtils.clamp(reach.length(), 0.16, 0.565));
    arm(pose, side, shoulder.clone().add(reach).toArray(), orientation, folds, thumb, spreads);
    applyPose(pose);
    const delta = target.clone().sub(contactPoints[point](side));
    error = delta.length();
    if (error < 0.002) return pose;
    wrist.add(delta);
  }
  if (error > 0.012) throw Error(`${side} ${point} cannot reach ${target.toArray().map(n => n.toFixed(3))} (off by ${(error * 100).toFixed(1)} cm)`);
  return pose;
}
export function posedTo(point, target, orientation, folds = {}, thumb = "open", headYaw = 0, headPitch = 0, spreads = {}) {
  const pose = defaultPose();
  armTo(pose, "Right", point, target, orientation, folds, thumb, spreads);
  pose.Head = q(headPitch, headYaw, 0);
  return pose;
}
/** Base (left) hand is placed freely; the dominant (right) hand is then solved relative to it. */
export function twoHand(left, right) {
  const pose = defaultPose();
  arm(pose, "Left", ...left);
  applyPose(pose);
  const target = right.target(pose);
  armTo(pose, "Right", right.point, target, right.orientation, right.folds, right.thumb, right.spreads);
  if (right.head) pose.Head = q(...right.head);
  return pose;
}
export { applyPose, palmOf, wristOf, tipOf };
