/**
 * Synthetic landmarks from the avatar rig (forward kinematics → MediaPipe layout).
 * Used for (1) bootstrap recognition templates for every sign the avatar can perform, and
 * (2) tests/round-trips that need ground-truth landmarks. Real camera data never goes through here.
 */
import * as THREE from "three";
import { createNeutralAvatar, disposeAvatar } from "../neutralAvatar";
import type { Frame, HandObs, Pt, Side } from "./types";

const FINGERS = ["Index", "Middle", "Ring", "Little"] as const;
const TIP = { Index: 0.033, Middle: 0.038, Ring: 0.035, Little: 0.028 } as const;
const p = (v: THREE.Vector3): Pt => ({ x: v.x, y: v.y, z: v.z });

export function handLandmarks(root: THREE.Object3D, side: Side): Pt[] {
  const at = (name: string, local = new THREE.Vector3()) => p(root.getObjectByName(name)!.localToWorld(local));
  const lm: Pt[] = [at(`${side}Hand`)];
  lm.push(at(`${side}Thumb1`), at(`${side}Thumb2`), at(`${side}Thumb3`), at(`${side}Thumb3`, new THREE.Vector3(0, -0.03, 0)));
  for (const f of FINGERS)
    lm.push(at(`${side}${f}1`), at(`${side}${f}2`), at(`${side}${f}3`), at(`${side}${f}3`, new THREE.Vector3(0, -TIP[f], 0)));
  return lm;
}
export function poseLandmarks(root: THREE.Object3D): Pt[] {
  const out: Pt[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  const world = (name: string, local = new THREE.Vector3()) => p(root.getObjectByName(name)!.localToWorld(local));
  out[0] = world("Head", new THREE.Vector3(0, 0.02, 0.16));
  out[11] = world("LeftUpperArm");
  out[12] = world("RightUpperArm");
  out[13] = world("LeftForearm");
  out[14] = world("RightForearm");
  out[15] = world("LeftHand");
  out[16] = world("RightHand");
  return out;
}
/**
 * A hand hanging at the signer's side is normally out of frame (or not reported) in camera data,
 * so it is omitted here too. Without this, templates for one-handed signs would claim a visible
 * second hand that real recordings never have.
 */
function raised(root: THREE.Object3D, side: Side): boolean {
  const wristY = root.getObjectByName(`${side}Hand`)!.getWorldPosition(new THREE.Vector3()).y;
  return wristY > 1.29 - 1.35 * 0.31;
}
export function frameOf(root: THREE.Object3D, t: number): Frame {
  root.updateMatrixWorld(true);
  const hand = (side: Side): HandObs | undefined =>
    raised(root, side) ? { world: handLandmarks(root, side), side, score: 1 } : undefined;
  return { t, right: hand("Right"), left: hand("Left"), pose: { world: poseLandmarks(root) } };
}
export interface SynthOptions {
  fps?: number;
  /** Gaussian-ish jitter in landmark units (≈ metres). */
  noise?: number;
  /** playback speed multiplier (0.8 = slower signer) */
  speed?: number;
  seed?: number;
}
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Play a clip on a throw-away avatar and capture it as camera-like frames. */
export function framesFromClip(clip: THREE.AnimationClip, options: SynthOptions = {}): Frame[] {
  const { fps = 30, noise = 0, speed = 1, seed = 1 } = options;
  const root = createNeutralAvatar();
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  const rand = rng(seed);
  const jitter = () => (rand() + rand() + rand() - 1.5) * 2 * noise;
  const frames: Frame[] = [];
  const duration = clip.duration / speed;
  for (let t = 0; t <= duration; t += 1 / fps) {
    mixer.setTime(t * speed);
    const frame = frameOf(root, t);
    if (noise > 0) {
      const shake = (pt: Pt) => {
        pt.x += jitter();
        pt.y += jitter();
        pt.z += jitter();
      };
      frame.right?.world.forEach(shake);
      frame.left?.world.forEach(shake);
      frame.pose?.world.forEach(shake);
    }
    frames.push(frame);
  }
  mixer.stopAllAction();
  disposeAvatar(root);
  return frames;
}
