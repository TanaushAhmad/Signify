/**
 * useHandTracking
 * ---------------
 * Loads MediaPipe Hands via CDN (no extra npm install needed) and runs it
 * against a <video> element at ~20 fps. Emits normalized landmark arrays
 * (21 points × {x,y,z}) whenever a hand is visible in the frame.
 *
 * Usage:
 *   const { landmarks, ready, error } = useHandTracking(webcamRef);
 */
import { useEffect, useRef, useState } from "react";

export interface Landmark {
  x: number; // 0-1 normalised, left = 0
  y: number; // 0-1 normalised, top = 0
  z: number; // depth relative to wrist
}

export interface HandTrackingState {
  /** 21-landmark array for the most recently detected hand, or null */
  landmarks: Landmark[] | null;
  /** true once the MediaPipe model is downloaded and warm */
  ready: boolean;
  /** human-readable error string, or empty */
  error: string;
}

// We load MediaPipe from the official CDN so the project needs zero extra deps.
const MP_HANDS_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js";
const MP_UTILS_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1640029074/camera_utils.js";

/** Load a script tag once and resolve when it fires onload. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
): HandTrackingState {
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!active) {
      setLandmarks(null);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        // Load MediaPipe scripts from CDN
        await loadScript(MP_UTILS_URL);
        await loadScript(MP_HANDS_URL);
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        if (!win.Hands || !win.Camera) {
          throw new Error(
            "MediaPipe failed to initialise. Check your internet connection.",
          );
        }

        const hands = new win.Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.6,
        });
        hands.onResults((results: { multiHandLandmarks?: Landmark[][] }) => {
          if (cancelled) return;
          const hand = results.multiHandLandmarks?.[0];
          setLandmarks(hand ?? null);
        });

        // Wait for the video element to be available and playing
        let video: HTMLVideoElement | null = null;
        for (let i = 0; i < 40; i++) {
          video = videoRef.current as HTMLVideoElement | null;
          if (video && video.readyState >= 2) break;
          await new Promise((r) => setTimeout(r, 150));
        }
        if (!video) throw new Error("Camera video element not ready.");
        if (cancelled) return;

        const camera = new win.Camera(video, {
          onFrame: async () => {
            if (!cancelled && video) await hands.send({ image: video });
          },
          width: 320,
          height: 240,
        });
        await camera.start();
        if (cancelled) {
          camera.stop();
          return;
        }
        setReady(true);
        cleanupRef.current = () => {
          camera.stop();
          hands.close();
        };
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "Hand tracking failed to start.",
          );
      }
    }

    void init();
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      setReady(false);
      setLandmarks(null);
    };
  }, [active, videoRef]);

  return { landmarks, ready, error };
}
