import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { disposeAvatar } from "./neutralAvatar";
import type { SignAsset } from "./pipeline";
import { signingJoints, constrainHands } from "./rig";
export async function loadGLTF(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load avatar asset: ${url}`);
  const data = await response.arrayBuffer();
  return new GLTFLoader().parseAsync(
    data,
    new URL(".", new URL(url, location.href)).href,
  );
}
export async function loadMotion(
  asset: SignAsset,
  root: THREE.Object3D,
  signal: AbortSignal,
) {
  let clip: THREE.AnimationClip | undefined;
  if (/\.(glb|gltf)(\?|$)/i.test(asset.url)) {
    const gltf = await loadGLTF(asset.url, signal);
    clip = gltf.animations.find((item) => item.name === asset.animationName);
    // These are motion-only files; use the configured avatar, never their mesh.
    disposeAvatar(gltf.scene);
  } else {
    const response = await fetch(asset.url, { signal });
    if (!response.ok) throw new Error(`Animation unavailable: ${asset.label}`);
    clip = THREE.AnimationClip.parse(await response.json());
  }
  if (
    !clip ||
    !Number.isFinite(clip.duration) ||
    clip.duration <= 0 ||
    !clip.tracks.length ||
    !clip.validate()
  )
    throw new Error(`Invalid animation: ${asset.label}`);
  for (const track of clip.tracks) {
    const binding = THREE.PropertyBinding.parseTrackName(track.name);
    if (!THREE.PropertyBinding.findNode(root, binding.nodeName))
      throw new Error(
        `Animation ${asset.label} targets a missing joint: ${binding.nodeName}`,
      );
    if (!Array.from(track.values).every(Number.isFinite))
      throw new Error(`Invalid motion values: ${asset.label}`);
  }
  if (asset.rigId === "signify-neutral-v1") {
    const tracks = new Set(clip.tracks.map(t => t.name));
    const missing = signingJoints.filter(name => !tracks.has(`${name}.quaternion`));
    if (missing.length) throw new Error(`Incomplete animation mapping for ${asset.label}: ${missing.join(", ")}`);
  }
  if (asset.cues.some((cue) => cue.start > clip.duration))
    throw new Error(`Caption timing exceeds animation: ${asset.label}`);
  return clip;
}
/** Part of a clip that actually carries the sign (first pose reached → last pose left). */
export interface MotionWindow {
  start: number;
  end: number;
}
/**
 * A single clock drives the pose, caption, progress, pause and speed.
 * With `windows`, neighbouring signs skip the rest-pose lead-out/lead-in and blend hand-to-hand
 * (co-articulation) instead of dropping to the neutral pose between every word.
 */
export class SequencePlayer {
  readonly mixer: THREE.AnimationMixer;
  readonly actions: THREE.AnimationAction[];
  readonly starts: number[] = [];
  readonly from: number[];
  readonly lengths: number[];
  readonly duration: number;
  time = 0;
  constructor(
    root: THREE.Object3D,
    readonly clips: THREE.AnimationClip[],
    readonly transition: number,
    windows?: (MotionWindow | undefined)[],
  ) {
    if (!clips.length || !Number.isFinite(transition) || transition < 0)
      throw new Error("A sequence needs clips and a valid transition duration.");
    this.mixer = new THREE.AnimationMixer(root);
    const last = clips.length - 1;
    this.from = clips.map((clip, i) => {
      const w = windows?.[i];
      return w && i > 0 ? THREE.MathUtils.clamp(w.start, 0, clip.duration) : 0;
    });
    this.lengths = clips.map((clip, i) => {
      const w = windows?.[i];
      const to = w && i < last ? THREE.MathUtils.clamp(w.end, this.from[i], clip.duration) : clip.duration;
      return Math.max(to - this.from[i], 0.001);
    });
    let total = 0;
    this.actions = clips.map((clip, i) => {
      this.starts.push(total);
      total += this.lengths[i] + transition;
      const action = this.mixer.clipAction(clip.clone());
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      action.paused = true;
      return action;
    });
    this.duration = Math.max(0, total - transition);
    this.seek(0);
  }
  seek(time: number) {
    this.time = Math.max(0, Math.min(time, this.duration));
    let index = this.starts.findIndex(
      (start, i) =>
        this.time >= start &&
        this.time < start + this.lengths[i] + this.transition,
    );
    if (index < 0) index = this.clips.length - 1;
    const local = this.time - this.starts[index];
    const length = this.lengths[index];
    const inTransition = local > length && index < this.clips.length - 1;
    this.actions.forEach((action) => {
      action.enabled = false;
    });
    const action = this.actions[index];
    action.enabled = true;
    action.time = this.from[index] + Math.min(local, length);
    action.setEffectiveWeight(1);
    if (inTransition) {
      const t = (local - length) / this.transition;
      const weight = t * t * (3 - 2 * t);
      action.setEffectiveWeight(1 - weight);
      const next = this.actions[index + 1];
      next.enabled = true;
      next.time = this.from[index + 1];
      next.setEffectiveWeight(weight);
    }
    this.mixer.update(0);
    const root = this.mixer.getRoot();
    if (root instanceof THREE.Object3D && root.name === "SignifyAvatar") constrainHands(root);
    return {
      index,
      local,
      inTransition,
      time: this.time,
      duration: this.duration,
      ended: this.time >= this.duration,
    };
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
