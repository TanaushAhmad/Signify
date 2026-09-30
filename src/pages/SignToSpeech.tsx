import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Upload, Video, Volume2, RefreshCw, Activity } from "lucide-react";
import { useHandTracking, type Landmark } from "../hooks/useHandTracking";
import { classify, CONFIDENCE_THRESHOLD } from "../signing/gestureClassifier";
import { GESTURE_SIGNATURES } from "../signing/gestureSignatures";

// ── Constants ────────────────────────────────────────────────────────────────

const DEMO_PHRASES = [
  "Hi", "Hello", "Good morning", "Thank you",
  "I love you", "Bye", "Yes", "No",
] as const;
type DemoPhrase = (typeof DEMO_PHRASES)[number];

/** How many consecutive frames must agree before we commit to a result. */
const HOLD_FRAMES = 18;
/** Rolling window size fed into the classifier. */
const WINDOW_SIZE = 24;
/** True when all 8 signatures have been recorded (no all-zero entries). */
const signaturesReady = Object.values(GESTURE_SIGNATURES).every(
  (sig) => sig.some((v) => v !== 0),
);

// ── Fallback for uploaded video / no signatures yet ──────────────────────────
const fallbackPhrases = [...DEMO_PHRASES];
let fallbackIdx = 0;
function nextFallbackPhrase(): DemoPhrase {
  return fallbackPhrases[fallbackIdx++ % fallbackPhrases.length];
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SignToSpeech() {
  // Camera / upload state
  const [camera, setCamera]           = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [upload, setUpload]           = useState<{ url: string; name: string } | null>(null);

  // Result / UI state
  const [result, setResult]       = useState<DemoPhrase | null>(null);
  const [confidence, setConf]     = useState(0);
  const [error, setError]         = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [liveMode, setLiveMode]   = useState(false); // continuous vs. single-shot

  // Refs
  const speechVersion   = useRef(0);
  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const webcamCompRef   = useRef<{ video: HTMLVideoElement | null } | null>(null);
  const frameWindow     = useRef<Landmark[][]>([]);
  const holdCounter     = useRef(0);
  const holdLabel       = useRef<string | null>(null);
  const animFrame       = useRef(0);

  // Sync webcam video element into our ref
  useEffect(() => {
    if (webcamCompRef.current?.video)
      videoRef.current = webcamCompRef.current.video;
  });

  // Hand tracking — only active when camera is on
  const { landmarks, ready: trackingReady, error: trackingError } =
    useHandTracking(videoRef, camera && cameraReady);

  // ── Live recognition loop ───────────────────────────────────────────────────
  const processLandmarks = useCallback((lm: Landmark[] | null) => {
    if (!liveMode || !signaturesReady) return;

    if (!lm) {
      // Hand left frame — reset hold streak but keep window
      holdCounter.current = 0;
      holdLabel.current   = null;
      return;
    }

    // Rolling window
    frameWindow.current = [...frameWindow.current.slice(-(WINDOW_SIZE - 1)), lm];
    if (frameWindow.current.length < 8) return; // need at least 8 frames

    const hit = classify(frameWindow.current);
    if (!hit) {
      holdCounter.current = 0;
      holdLabel.current   = null;
      return;
    }

    // Require HOLD_FRAMES consecutive frames with the same top label
    if (hit.label === holdLabel.current) {
      holdCounter.current++;
    } else {
      holdCounter.current = 1;
      holdLabel.current   = hit.label;
    }

    if (holdCounter.current >= HOLD_FRAMES) {
      holdCounter.current = 0; // reset so it won't re-fire immediately
      holdLabel.current   = null;
      frameWindow.current = [];
      commitResult(hit.label as DemoPhrase, hit.confidence);
    }
  }, [liveMode]);

  useEffect(() => {
    processLandmarks(landmarks);
  }, [landmarks, processLandmarks]);

  // Cleanup on unmount
  useEffect(() => () => {
    speechVersion.current++;
    window.speechSynthesis?.cancel();
    cancelAnimationFrame(animFrame.current);
  }, []);

  useEffect(() => () => {
    if (upload) URL.revokeObjectURL(upload.url);
  }, [upload]);

  // ── Result handling ─────────────────────────────────────────────────────────
  function commitResult(phrase: DemoPhrase, conf = 1) {
    setResult(phrase);
    setConf(conf);
    setAnalyzing(false);
    speak(phrase);
  }

  function reset() {
    speechVersion.current++;
    window.speechSynthesis?.cancel();
    setResult(null);
    setConf(0);
    setError("");
    setAnalyzing(false);
    frameWindow.current = [];
    holdCounter.current = 0;
    holdLabel.current   = null;
  }

  function speak(phrase: DemoPhrase) {
    const ver = ++speechVersion.current;
    if (!("speechSynthesis" in window)) {
      setError("Speech playback is unavailable in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    setError("");
    const u = new SpeechSynthesisUtterance(phrase);
    u.lang = "en-US";
    u.onerror = (ev) => {
      if (ver === speechVersion.current &&
          !["canceled", "interrupted"].includes(ev.error))
        setError("Speech playback failed. Press Play to retry.");
    };
    window.speechSynthesis.speak(u);
  }

  // ── Single-shot conversion (upload or no signatures) ────────────────────────
  function runConversion() {
    reset();
    setAnalyzing(true);

    if (signaturesReady && cameraReady && camera) {
      // Try one real classification from the current frame window
      const hit = classify(frameWindow.current);
      if (hit) {
        commitResult(hit.label as DemoPhrase, hit.confidence);
        return;
      }
      // Not enough signal yet — fall through to fallback with message
      setError(
        "No clear sign detected yet. Hold a sign steadily in front of the camera, then try again.",
      );
      setAnalyzing(false);
      return;
    }

    // Fallback: cycle through phrases (for upload mode or unrecorded signatures)
    const delay = 900 + Math.random() * 400;
    setTimeout(() => {
      commitResult(nextFallbackPhrase());
    }, delay);
  }

  const canConvert = (upload !== null || cameraReady) && !analyzing;

  // ── Confidence bar colour ───────────────────────────────────────────────────
  const confColor =
    confidence >= 0.92 ? "#4ade80" :
    confidence >= CONFIDENCE_THRESHOLD ? "#facc15" : "#f87171";

  // ── Banner copy ─────────────────────────────────────────────────────────────
  const bannerText = signaturesReady
    ? "Real-time gesture recognition active — MediaPipe hand tracking enabled."
    : "Signatures not yet recorded. Visit /record-gesture to capture your signs, then paste into gestureSignatures.ts.";

  return (
    <>
      <div className="demo-banner" style={signaturesReady ? { borderColor: "#16a34a", background: "rgb(20 83 45 / 0.35)" } : {}}>
        <strong>{signaturesReady ? "Live recognition mode" : "Signatures needed"}</strong>
        <p>{bannerText}</p>
      </div>

      <div className="workspace-grid">
        {/* ── Left panel: video input ── */}
        <section className="panel utility-panel">
          <h2>Video input</h2>
          <p>
            {signaturesReady
              ? "Turn on your camera and sign — recognition runs continuously."
              : "Upload a video or use your camera to try the simulated flow."}
          </p>

          <div className="camera-stage">
            {camera ? (
              <Webcam
                ref={(inst) => {
                  webcamCompRef.current = inst as unknown as { video: HTMLVideoElement | null };
                }}
                audio={false}
                onUserMedia={() => setCameraReady(true)}
                onUserMediaError={() => {
                  setCamera(false);
                  setCameraReady(false);
                  setError("Camera unavailable. Check permissions or upload a video instead.");
                }}
                videoConstraints={{ facingMode: "user" }}
              />
            ) : upload ? (
              <video
                src={upload.url}
                controls muted playsInline
                aria-label="Uploaded video preview"
                onError={() => setError("This video cannot be previewed. The simulated demo still works.")}
              />
            ) : (
              <Video size={42} aria-label="No video selected" />
            )}
          </div>

          {/* Tracking status badge */}
          {camera && cameraReady && (
            <p role="status" style={{ fontSize: 12, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={13} />
              {trackingError
                ? <span style={{ color: "#f87171" }}>{trackingError}</span>
                : !trackingReady
                ? <span style={{ color: "#94a3b8" }}>Loading MediaPipe…</span>
                : landmarks
                ? <span style={{ color: "#4ade80" }}>Hand detected</span>
                : <span style={{ color: "#94a3b8" }}>No hand in frame</span>}
            </p>
          )}

          <div className="video-input-actions">
            <button
              className="primary-button"
              onClick={() => {
                reset();
                setUpload(null);
                setCameraReady(false);
                setLiveMode(false);
                setCamera((v) => !v);
              }}
            >
              {camera ? "Turn camera off" : "Turn camera on"}
            </button>
            <label className="upload-button">
              <Upload size={18} />
              Upload video
              <input
                type="file" accept="video/*" aria-label="Upload video"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (!file.type.startsWith("video/") &&
                      !/\.(mp4|webm|mov|ogv|ogg|m4v)$/i.test(file.name)) {
                    setError("Please select a video file.");
                    return;
                  }
                  reset();
                  setCamera(false);
                  setCameraReady(false);
                  setLiveMode(false);
                  setUpload({ url: URL.createObjectURL(file), name: file.name });
                }}
              />
            </label>
          </div>

          {upload && <p className="upload-name">Selected: {upload.name}</p>}
          {camera && !cameraReady && <p role="status">Waiting for camera permission…</p>}

          {/* Live mode toggle — only shown when tracking is ready and signatures are recorded */}
          {signaturesReady && trackingReady && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className={`primary-button${liveMode ? " recording" : ""}`}
                style={liveMode ? { background: "#16a34a" } : {}}
                onClick={() => { reset(); setLiveMode((v) => !v); }}
              >
                {liveMode ? "● Live recognition ON" : "Start live recognition"}
              </button>
            </div>
          )}

          {/* Single-shot button */}
          {!liveMode && (
            <button
              className="primary-button convert-button"
              disabled={!canConvert}
              onClick={runConversion}
              style={{ marginTop: liveMode ? 8 : undefined }}
            >
              {analyzing ? "Analyzing…" : "Convert sign to speech"}
            </button>
          )}

          {analyzing && (
            <p role="status" className="analyzing-status">
              Detecting hand gesture…
            </p>
          )}
        </section>

        {/* ── Right panel: output ── */}
        <section className="panel utility-panel">
          <h2>Recognition output</h2>
          <span className="pill">
            {signaturesReady
              ? (liveMode ? "Live · real gesture recognition" : "8 phrases · real recognition")
              : "8 phrases · simulated"}
          </span>

          {result ? (
            <>
              <p className="sample-result" role="status">{result}</p>

              {/* Confidence bar — only shown for real recognition */}
              {signaturesReady && confidence > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                    <span>Confidence</span>
                    <span style={{ color: confColor }}>{(confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, background: "rgb(30 41 59)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${confidence * 100}%`, background: confColor, borderRadius: 3, transition: "width .3s" }} />
                  </div>
                </div>
              )}

              <div className="output-actions">
                <button className="primary-button" onClick={() => speak(result)}>
                  <Volume2 size={18} /> Play speech
                </button>
                <button className="text-button" onClick={() => { speechVersion.current++; window.speechSynthesis?.cancel(); }}>
                  Stop speech
                </button>
                {!liveMode && (
                  <button
                    className="text-button"
                    disabled={!canConvert}
                    onClick={canConvert ? runConversion : undefined}
                    title="Run again"
                  >
                    <RefreshCw size={15} /> Try again
                  </button>
                )}
              </div>

              <p className="phrase-hint">
                Supported:{" "}
                {DEMO_PHRASES.map((p, i) => (
                  <span key={p} style={{ fontWeight: p === result ? 600 : 400, color: p === result ? "var(--color-accent, #6366f1)" : undefined }}>
                    {p}{i < DEMO_PHRASES.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </>
          ) : (
            <p className="empty-result">
              {liveMode
                ? "Hold a sign steadily in front of the camera — recognition fires automatically."
                : analyzing
                ? "Analyzing your sign…"
                : "Choose a video input, then press \u201cConvert sign to speech\u201d."}
            </p>
          )}

          {/* Setup link when signatures not recorded */}
          {!signaturesReady && (
            <div style={{ marginTop: 20, padding: "12px 14px", background: "rgb(120 53 15 / 0.25)", border: "1px solid #92400e", borderRadius: 8, fontSize: 13 }}>
              <strong style={{ color: "#fbbf24" }}>One-time setup required</strong>
              <p style={{ marginTop: 4, color: "#d97706" }}>
                Record your gesture signatures at{" "}
                <a href="/record-gesture" style={{ color: "#fbbf24", textDecoration: "underline" }}>
                  /record-gesture
                </a>{" "}
                to enable real recognition. Until then, the converter uses the simulated fallback.
              </p>
            </div>
          )}

          {error && <p role="alert" className="inline-error">{error}</p>}
        </section>
      </div>
    </>
  );
}
