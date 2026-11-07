import type { Frame } from "./types";
import type { Tracker } from "./tracker";

export function seekTo(video: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve) => {
    const done = () => { video.removeEventListener("seeked", done); resolve(); };
    video.addEventListener("seeked", done);
    setTimeout(done, 2500);
    video.currentTime = t;
  });
}
/** Load a video file into a detached <video> element (never shown, never uploaded anywhere). */
export function loadVideoFile(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.preload = "auto";
    video.onloadedmetadata = () => (Number.isFinite(video.duration) && video.duration > 0 ? resolve({ video, url }) : reject(new Error(`${file.name}: length can't be read`)));
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name}: this video can't be played (try MP4 or WebM)`)); };
    video.src = url;
  });
}
/** Step through a video by seeking and run hand + body tracking on every step. */
export async function extractFrames(
  video: HTMLVideoElement, tracker: Tracker,
  { fps = 15, onProgress = () => undefined, cancelled = () => false }: { fps?: number; onProgress?: (percent: number) => void; cancelled?: () => boolean } = {},
): Promise<Frame[]> {
  tracker.reset();
  const frames: Frame[] = [];
  for (let t = 0; t <= video.duration; t += 1 / fps) {
    if (cancelled()) break;
    await seekTo(video, t);
    frames.push(tracker.detect(video, Math.round(t * 1000)).frame);
    onProgress(Math.round((t / video.duration) * 100));
  }
  return frames;
}
