/**
 * MediaPipe Tasks Vision wrapper: hands (both) + body pose → recognition Frames.
 * One <video> element feeds both models; we never open a second camera stream.
 */
import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { toAvatarFrame } from "./geometry";
import { POSE, type Frame, type HandObs, type Pt } from "./types";

const WASM_LOCAL = "/mediapipe/wasm";
const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const MODELS = {
  hand: ["/models/hand_landmarker.task", "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"],
  pose: ["/models/pose_landmarker_lite.task", "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"],
};
export interface Overlay {
  hands: { x: number; y: number }[][];
  pose: { x: number; y: number }[] | null;
}
export interface Tracker {
  /** `ms` must increase monotonically within one video; call `reset()` before starting another. */
  detect(video: HTMLVideoElement, ms: number): { frame: Frame; overlay: Overlay };
  /** Start a new video: MediaPipe needs increasing timestamps, so later timestamps are offset internally. */
  reset(): void;
  hasPose: boolean;
  close(): void;
}
/** The dev server answers unknown paths with index.html (HTTP 200), so check the content type too. */
async function usable(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok && !(r.headers.get("content-type") || "").includes("text/html");
  } catch {
    return false;
  }
}
async function firstUsable(urls: string[]) {
  for (const u of urls) if (await usable(u)) return u;
  return urls[urls.length - 1];
}
export async function createTracker(onStatus: (m: string) => void = () => undefined): Promise<Tracker> {
  onStatus("Loading hand-tracking runtime…");
  const wasm = await FilesetResolver.forVisionTasks((await usable(`${WASM_LOCAL}/vision_wasm_internal.wasm`)) ? WASM_LOCAL : WASM_CDN);
  const make = async <T,>(build: (delegate: "GPU" | "CPU") => Promise<T>) => {
    try {
      return await build("GPU");
    } catch {
      return build("CPU");
    }
  };
  onStatus("Loading hand model…");
  const handUrl = await firstUsable(MODELS.hand);
  const hands = await make((delegate) =>
    HandLandmarker.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: handUrl, delegate },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }));
  let pose: PoseLandmarker | null = null;
  try {
    onStatus("Loading body model…");
    const poseUrl = await firstUsable(MODELS.pose);
    pose = await make((delegate) =>
      PoseLandmarker.createFromOptions(wasm, { baseOptions: { modelAssetPath: poseUrl, delegate }, runningMode: "VIDEO", numPoses: 1 }));
  } catch {
    onStatus("Body model unavailable — hand shape only (less accurate).");
  }
  let offset = 0, lastMs = 0;
  return {
    hasPose: pose !== null,
    reset() {
      offset = lastMs + 1000;
    },
    close() {
      hands.close();
      pose?.close();
    },
    detect(video, ms) {
      lastMs = ms + offset;
      const h = hands.detectForVideo(video, ms + offset);
      const p = pose?.detectForVideo(video, ms + offset);
      const body = p?.landmarks[0];
      const bodyWorld = p?.worldLandmarks[0];
      const wristImg = (side: "right" | "left") => body?.[side === "right" ? POSE.rWrist : POSE.lWrist];
      // Which hand is which: match each detected hand to the nearest body wrist (robust to mirroring).
      const assigned: Partial<Record<"Right" | "Left", HandObs>> = {};
      const order = h.landmarks.map((lm, i) => ({ i, x: lm[0].x }));
      order.sort((a, b) => a.x - b.x);
      order.forEach(({ i }, rank) => {
        const lm = h.landmarks[i];
        let side: "Right" | "Left";
        if (body) {
          const dr = Math.hypot(lm[0].x - wristImg("right")!.x, lm[0].y - wristImg("right")!.y);
          const dl = Math.hypot(lm[0].x - wristImg("left")!.x, lm[0].y - wristImg("left")!.y);
          side = dr <= dl ? "Right" : "Left";
        } else side = h.landmarks.length === 2 ? (rank === 0 ? "Right" : "Left") : lm[0].x < 0.5 ? "Right" : "Left";
        if (assigned[side]) return; // two hands claimed the same side: keep the first, drop the duplicate
        assigned[side] = { world: h.worldLandmarks[i].map(toAvatarFrame), side, score: h.handedness[i]?.[0]?.score ?? 1 };
      });
      const frame: Frame = {
        t: ms / 1000,
        right: assigned.Right,
        left: assigned.Left,
        pose: bodyWorld ? { world: bodyWorld.map(toAvatarFrame) as Pt[], vis: body?.map((l) => l.visibility ?? 1) } : undefined,
      };
      return { frame, overlay: { hands: h.landmarks.map((l) => l.map(({ x, y }) => ({ x, y }))), pose: body ? body.map(({ x, y }) => ({ x, y })) : null } };
    },
  };
}
