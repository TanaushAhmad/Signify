/**
 * Landmarks → avatar joint rotations ("motion capture" for the signing rig).
 *
 * Uses the same conventions as the authoring scripts (scripts/rig-authoring.mjs `arm`/`handshape`):
 * fingers extend along local −Y, the palm faces local −Z, finger flexion is rotation about X and
 * spread about Z; the upper arm / forearm rotate the rest vector (0,−1,0) onto the measured bone.
 *
 * Arm lengths are NOT copied from the signer — only bone directions — so the avatar keeps its own
 * proportions. Consequence: contact points (hand on face/chest) are approximate after capture and
 * must be checked by a reviewer (scripts/verify-contacts.mjs style) before publishing.
 */
import * as THREE from "three";
import config from "../rigConfig.json";
import { angle, norm, sub } from "./geometry";
import { bodyOf, palmNormal } from "./features";
import { POSE, type Frame, type HandObs, type Pt, type Side } from "./types";

const clamp = THREE.MathUtils.clamp;
const v = (p: Pt) => new THREE.Vector3(p.x, p.y, p.z);
const q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
export type JointPose = Record<string, THREE.Quaternion>;

export function handBasis(hand: HandObs): THREE.Matrix4 {
  const lm = hand.world;
  const fingers = v(norm(sub(lm[9], lm[0])));
  const palm = v(palmNormal(lm, hand.side));
  const z = palm.clone().negate();
  const y = fingers.clone().negate();
  y.addScaledVector(z, -y.dot(z)).normalize();
  const x = y.clone().cross(z).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}

/** Avatar body constants (see src/signing/neutralAvatar.ts). */
const AV = { upper: 0.31, fore: 0.28, shoulderX: 0.29, shoulderY: 1.29, nose: new THREE.Vector3(0, 1.65, 0.165) };
const smooth01 = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * Where the avatar's wrist should be. Shoulder-relative placement keeps chest-level signs right;
 * but the avatar's neck is longer than a real person's relative to its arm, so for hands raised to
 * the face we blend toward a NOSE-relative target (otherwise a forehead salute stops at the temple).
 */
export function wristTarget(w: Pt[], side: Side, unit: number): THREE.Vector3 {
  const [s, wr] = side === "Right" ? [POSE.rShoulder, POSE.rWrist] : [POSE.lShoulder, POSE.lWrist];
  const k = AV.upper / unit;
  const shoulderAv = new THREE.Vector3(side === "Right" ? -AV.shoulderX : AV.shoulderX, AV.shoulderY, 0);
  const fromShoulder = shoulderAv.clone().add(v(sub(w[wr], w[s])).multiplyScalar(k));
  const fromNose = AV.nose.clone().add(v(sub(w[wr], w[POSE.nose])).multiplyScalar(k));
  const height = (w[wr].y - w[s].y) / (unit * 1.9); // wrist above shoulder line, in arm lengths
  return fromShoulder.lerp(fromNose, smooth01(0.1, 0.5, height));
}
/** Two-bone IK to `target`; the elbow bends toward the signer's own elbow side. */
function solveArm(frame: Frame, side: Side, unit: number) {
  const w = frame.pose!.world;
  const [s, e, wr] = side === "Right" ? [POSE.rShoulder, POSE.rElbow, POSE.rWrist] : [POSE.lShoulder, POSE.lElbow, POSE.lWrist];
  const shoulder = new THREE.Vector3(side === "Right" ? -AV.shoulderX : AV.shoulderX, AV.shoulderY, 0);
  const delta = wristTarget(w, side, unit).sub(shoulder);
  delta.setLength(clamp(delta.length(), 0.14, AV.upper + AV.fore - 0.015));
  const d = delta.length(), u = delta.clone().normalize();
  const along = v(sub(w[wr], w[s])).normalize();
  const pole = v(sub(w[e], w[s])).sub(along.clone().multiplyScalar(v(sub(w[e], w[s])).dot(along)));
  const bend = pole.length() > 1e-3 * unit ? pole : new THREE.Vector3(side === "Right" ? -0.45 : 0.45, -1, 0.1);
  bend.addScaledVector(u, -bend.dot(u)).normalize();
  const a = (AV.upper ** 2 - AV.fore ** 2 + d * d) / (2 * d);
  const elbow = shoulder.clone().addScaledVector(u, a).addScaledVector(bend, Math.sqrt(Math.max(AV.upper ** 2 - a * a, 0)));
  const down = new THREE.Vector3(0, -1, 0);
  const upper = new THREE.Quaternion().setFromUnitVectors(down, elbow.clone().sub(shoulder).normalize());
  const forearm = new THREE.Quaternion().setFromUnitVectors(down, shoulder.clone().add(delta).sub(elbow).normalize());
  return { upper, forearm };
}
function medianUpperArm(frame: Frame): number {
  const w = frame.pose!.world;
  const l = [len3(w[POSE.rShoulder], w[POSE.rElbow]), len3(w[POSE.lShoulder], w[POSE.lElbow])].filter((x) => x > 1e-3);
  return l.length ? l.reduce((a, b) => a + b) / l.length : AV.upper;
}
const len3 = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** `unit` = the signer's upper-arm length (median over the recording is steadier than one frame). */
export function retargetArm(frame: Frame, side: Side, unit?: number): JointPose | null {
  const hand = side === "Right" ? frame.right : frame.left;
  const w = frame.pose?.world;
  if (!w) return null;
  const [e, wr] = side === "Right" ? [POSE.rElbow, POSE.rWrist] : [POSE.lElbow, POSE.lWrist];
  const { upper, forearm } = solveArm(frame, side, unit ?? medianUpperArm(frame));
  if (!hand) {
    // Hand tracking dropped out (common during fast motion) but the body model still sees the arm:
    // move the arm, leave hand/finger joints to be held by the caller.
    const vis = frame.pose?.vis;
    if (vis && Math.min(vis[e], vis[wr]) < 0.5) return null;
    const shoulder = new THREE.Quaternion().slerp(upper, 0.12);
    return {
      [`${side}Shoulder`]: shoulder,
      [`${side}UpperArm`]: shoulder.clone().invert().multiply(upper),
      [`${side}Forearm`]: upper.clone().invert().multiply(forearm),
    };
  }
  const basis = handBasis(hand);
  const orientation = new THREE.Quaternion().setFromRotationMatrix(basis);
  // Pronation/supination lives in the forearm; only bounded bending stays in the wrist.
  const relative = forearm.clone().invert().multiply(orientation);
  forearm.multiply(new THREE.Quaternion(0, relative.y, 0, relative.w).normalize());
  const wristEuler = new THREE.Euler().setFromQuaternion(forearm.clone().invert().multiply(orientation), "XYZ");
  const [lx, ly, lz] = config.wristLimits;
  const shoulder = new THREE.Quaternion().slerp(upper, 0.12);
  const pose: JointPose = {
    [`${side}Shoulder`]: shoulder,
    [`${side}UpperArm`]: shoulder.clone().invert().multiply(upper),
    [`${side}Forearm`]: upper.clone().invert().multiply(forearm),
    [`${side}Hand`]: q(clamp(wristEuler.x, -lx, lx), clamp(wristEuler.y, -ly, ly), clamp(wristEuler.z, -lz, lz)),
  };
  Object.assign(pose, retargetFingers(hand, basis, side));
  return pose;
}

export function retargetFingers(hand: HandObs, basis: THREE.Matrix4, side: Side): JointPose {
  const lm = hand.world;
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
  basis.extractBasis(X, Y, Z);
  const out: JointPose = {};
  ["Index", "Middle", "Ring", "Little"].forEach((finger, i) => {
    const mcp = 5 + i * 4;
    const b0 = sub(lm[mcp], lm[0]), b1 = sub(lm[mcp + 1], lm[mcp]), b2 = sub(lm[mcp + 2], lm[mcp + 1]), b3 = sub(lm[mcp + 3], lm[mcp + 2]);
    const flex = [angle(b0, b1), angle(b1, b2), angle(b2, b3)];
    // After Rx(flex)·Rz(spread) the bone's X component is exactly sin(spread), whatever the flexion.
    const spread = Math.asin(clamp(v(norm(b1)).dot(X), -1, 1));
    for (let j = 0; j < 3; j++)
      out[`${side}${finger}${j + 1}`] = q(clamp(flex[j], 0, config.fingerFlexion[j]), 0,
        j === 0 ? clamp(spread, -config.fingerSpread, config.fingerSpread) : 0);
  });
  // Thumb: base direction in the hand frame → (flexion about X, abduction about Z); then two flexions.
  const t1 = v(norm(sub(lm[2], lm[1])));
  const a = t1.dot(X), b = t1.dot(Y), c = t1.dot(Z);
  const lim = config.thumbLimits;
  const base = q(
    clamp(Math.atan2(-c, -b), lim[0][0], lim[0][1]), 0,
    clamp(Math.asin(clamp(a, -1, 1)), lim[0][4], lim[0][5]));
  out[`${side}Thumb1`] = base;
  out[`${side}Thumb2`] = q(clamp(angle(sub(lm[2], lm[1]), sub(lm[3], lm[2])), lim[1][0], lim[1][1]));
  out[`${side}Thumb3`] = q(clamp(angle(sub(lm[3], lm[2]), sub(lm[4], lm[3])), lim[2][0], lim[2][1]));
  return out;
}

/** Both arms for one frame; a side with no visible hand returns null (caller holds/rests). */
export function retargetFrame(frame: Frame, unit?: number): { Right: JointPose | null; Left: JointPose | null } {
  return { Right: retargetArm(frame, "Right", unit), Left: retargetArm(frame, "Left", unit) };
}

// ── clip export ─────────────────────────────────────────────────────────────
const SIDES: Side[] = ["Left", "Right"];
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"];
export const BONES: string[] = [
  "Head", "LeftBrow", "RightBrow",
  ...SIDES.flatMap((side) => [`${side}Shoulder`, `${side}UpperArm`, `${side}Forearm`, `${side}Hand`,
    ...FINGERS.flatMap((f) => [1, 2, 3].map((j) => `${side}${f}${j}`))]),
];
export const REST: JointPose = Object.fromEntries(BONES.map((n) => [n,
  n.endsWith("UpperArm") ? q(0, 0, n.startsWith("Left") ? 0.13 : -0.13)
    : n.endsWith("Thumb1") ? q(0, 0, n.startsWith("Left") ? -0.65 : 0.65) : new THREE.Quaternion()]));

export interface CaptureResult {
  clip: THREE.AnimationClip;
  /** seconds from clip start to first/last signing pose (for fluent chaining) */
  motion: { start: number; end: number };
  coverage: number;
  hands: "right" | "both";
}
/** Frames → smoothed 30 fps clip that eases in from and out to the rest pose. */
export function clipFromFrames(frames: Frame[], name: string): CaptureResult | null {
  const lead = 0.45;
  const unit = bodyOf(frames).unit || undefined; // median upper-arm length: steadier than per-frame
  const poses = frames.map((f) => ({ t: f.t - frames[0].t, ...retargetFrame(f, unit) }));
  const hasHand = (p: JointPose | null, side: Side) => Boolean(p && p[`${side}Hand`]);
  const valid = poses.filter((p) => hasHand(p.Right, "Right") || hasHand(p.Left, "Left"));
  if (valid.length < 5) return null;
  const T = poses[poses.length - 1].t;
  const left = valid.filter((p) => hasHand(p.Left, "Left")).length > valid.length * 0.3;
  const fps = 30, n = Math.max(2, Math.round(T * fps) + 1);
  // last known pose per bone, carried across tracking dropouts
  const times: number[] = [0];
  const values = new Map<string, number[]>(BONES.map((b) => [b, [...REST[b].toArray()]]));
  const last = new Map<string, THREE.Quaternion>(BONES.map((b) => [b, REST[b].clone()]));
  const smoothed = new Map<string, THREE.Quaternion>(BONES.map((b) => [b, REST[b].clone()]));
  const push = (b: string, qq: THREE.Quaternion) => values.get(b)!.push(...qq.toArray());
  let seen = 0;
  for (let i = 0; i < n; i++) {
    const t = Math.min(i / fps, T);
    let k = poses.findIndex((p) => p.t >= t);
    if (k < 0) k = poses.length - 1;
    const pick = (side: Side) => {
      for (let d = 0; d < poses.length; d++) for (const idx of [k - d, k + d]) if (poses[idx]?.[side] && Math.abs(poses[idx].t - t) < 0.35) return poses[idx][side];
      return null;
    };
    const sides = left ? SIDES : (["Right"] as Side[]);
    for (const side of sides) {
      const p = pick(side);
      if (p) { if (p[`${side}Hand`]) seen++; for (const [b, qq] of Object.entries(p)) last.set(b, qq); }
    }
    times.push(lead + t);
    for (const b of BONES) {
      const target = last.get(b)!.clone();
      const prev = smoothed.get(b)!;
      if (prev.dot(target) < 0) target.set(-target.x, -target.y, -target.z, -target.w);
      prev.slerp(target, 0.55);
      push(b, prev.clone().normalize());
    }
  }
  times.push(lead + T + lead);
  for (const b of BONES) push(b, REST[b]);
  const tracks = BONES.map((b) => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, values.get(b)!));
  const clip = new THREE.AnimationClip(name, times[times.length - 1], tracks);
  return { clip, motion: { start: lead, end: lead + T }, coverage: seen / (n * (left ? 2 : 1)), hands: left ? "both" : "right" };
}
export const _angle = angle;
