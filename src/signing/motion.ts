import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { disposeAvatar } from "./neutralAvatar";
import type { SignAsset } from "./pipeline";
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
  if (asset.cues.some((cue) => cue.start > clip.duration))
    throw new Error(`Caption timing exceeds animation: ${asset.label}`);
  return clip;
}
/** A single clock drives the pose, caption, progress, pause and speed. */
export class SequencePlayer {
  readonly mixer: THREE.AnimationMixer;
  readonly actions: THREE.AnimationAction[];
  readonly starts: number[] = [];
  readonly duration: number;
  time = 0;
  constructor(
    root: THREE.Object3D,
    readonly clips: THREE.AnimationClip[],
    readonly transition: number,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    let total = 0;
    this.actions = clips.map((clip) => {
      this.starts.push(total);
      total += clip.duration + transition;
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
        this.time < start + this.clips[i].duration + this.transition,
    );
    if (index < 0) index = this.clips.length - 1;
    const local = this.time - this.starts[index];
    const inTransition =
      local > this.clips[index].duration && index < this.clips.length - 1;
    this.actions.forEach((action) => {
      action.enabled = false;
    });
    const action = this.actions[index];
    action.enabled = true;
    action.time = Math.min(local, this.clips[index].duration);
    action.setEffectiveWeight(1);
    if (inTransition) {
      const weight = (local - this.clips[index].duration) / this.transition;
      action.setEffectiveWeight(1 - weight);
      const next = this.actions[index + 1];
      next.enabled = true;
      next.time = 0;
      next.setEffectiveWeight(weight);
    }
    this.mixer.update(0);
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
