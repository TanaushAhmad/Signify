/**
 * GestureRecorder — /record-gesture
 * -----------------------------------
 * A developer tool page that lets you record your own gesture signatures for
 * each of the 8 phrases. Walk through each phrase one by one:
 *
 *  1. Click "Start recording" for a phrase.
 *  2. Hold the sign steadily in front of your camera for ~2 seconds.
 *  3. Click "Stop & save".
 *  4. Once all 8 are recorded, click "Copy all signatures" and paste
 *     the result into src/signing/gestureSignatures.ts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import type { Landmark } from "../hooks/useHandTracking";
import { useHandTracking } from "../hooks/useHandTracking";
import { computeSignature } from "../signing/gestureClassifier";

const PHRASES = [
  "Hi",
  "Hello",
  "Good morning",
  "Thank you",
  "I love you",
  "Bye",
  "Yes",
  "No",
] as const;

type Phrase = (typeof PHRASES)[number];

export function GestureRecorder() {
  const webcamRef = useRef<HTMLVideoElement | null>(null);
  // react-webcam gives us a Webcam instance; we need the underlying video el
  const webcamCompRef = useRef<{ video: HTMLVideoElement | null } | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [activePhrase, setActivePhrase] = useState<Phrase | null>(null);
  const [recording, setRecording] = useState(false);
  const [frameBuffer, setFrameBuffer] = useState<Landmark[][]>([]);
  const [signatures, setSignatures] = useState<Partial<Record<Phrase, number[]>>>({});
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Point the tracking hook at the webcam's video element
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (webcamCompRef.current?.video) {
      videoRef.current = webcamCompRef.current.video;
    }
  });

  const { landmarks, ready: trackingReady, error: trackingError } =
    useHandTracking(videoRef, cameraOn && cameraReady);

  // Accumulate frames while recording
  useEffect(() => {
    if (!recording || !landmarks) return;
    setFrameBuffer((prev) => [...prev, landmarks]);
  }, [landmarks, recording]);

  function startRecording(phrase: Phrase) {
    setActivePhrase(phrase);
    setFrameBuffer([]);
    setRecording(true);
    setStatusMsg(`Recording "${phrase}" — hold the sign steadily…`);
  }

  function stopRecording() {
    setRecording(false);
    if (!activePhrase || frameBuffer.length < 5) {
      setStatusMsg("Too few frames captured. Try again and hold the sign longer.");
      return;
    }
    const sig = computeSignature(frameBuffer);
    setSignatures((prev) => ({ ...prev, [activePhrase]: sig }));
    setStatusMsg(
      `✓ Saved "${activePhrase}" (${frameBuffer.length} frames). ${
        Object.keys(signatures).length + 1 < PHRASES.length
          ? "Record the next phrase."
          : "All phrases recorded — copy and paste into gestureSignatures.ts."
      }`,
    );
    setFrameBuffer([]);
  }

  const buildOutput = useCallback(() => {
    const lines = PHRASES.map((p) => {
      const sig = signatures[p];
      const val = sig
        ? `[${sig.map((n) => n.toFixed(6)).join(", ")}]`
        : "new Array(63).fill(0) /* NOT RECORDED YET */";
      return `  "${p}": ${val},`;
    });
    return (
      `export const GESTURE_SIGNATURES: Record<string, number[]> = {\n` +
      lines.join("\n") +
      `\n};\n`
    );
  }, [signatures]);

  async function copyAll() {
    await navigator.clipboard.writeText(buildOutput());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const recorded = Object.keys(signatures) as Phrase[];
  const allDone = recorded.length === PHRASES.length;

  return (
    <main id="main" className="workspace" style={{ maxWidth: 860 }}>
      <div className="demo-banner" style={{ borderColor: "#f59e0b", background: "rgb(120 53 15 / 0.3)" }}>
        <strong>Developer tool — Gesture Recorder</strong>
        <p>
          Record your hand signatures for each phrase. These replace the placeholder
          zeros in <code>gestureSignatures.ts</code> and enable real recognition.
        </p>
      </div>

      {/* Camera */}
      <section className="panel utility-panel" style={{ marginBottom: 24 }}>
        <h2>Camera</h2>
        {!cameraOn ? (
          <button className="primary-button" onClick={() => setCameraOn(true)}>
            Turn camera on
          </button>
        ) : (
          <>
            <div className="camera-stage">
              <Webcam
                ref={(inst) => {
                  webcamCompRef.current = inst as unknown as { video: HTMLVideoElement | null };
                }}
                audio={false}
                onUserMedia={() => setCameraReady(true)}
                onUserMediaError={() => {
                  setCameraOn(false);
                  setCameraReady(false);
                }}
                videoConstraints={{ facingMode: "user", width: 320, height: 240 }}
              />
            </div>
            {!cameraReady && <p role="status">Waiting for camera…</p>}
            {cameraReady && !trackingReady && !trackingError && (
              <p role="status">Loading MediaPipe hand tracking…</p>
            )}
            {trackingReady && (
              <p role="status" style={{ color: "#4ade80" }}>
                ✓ Hand tracking active{landmarks ? " — hand detected" : " — no hand in frame"}
              </p>
            )}
            {trackingError && (
              <p role="alert" className="inline-error">{trackingError}</p>
            )}
            <button
              className="text-button"
              style={{ marginTop: 10 }}
              onClick={() => {
                setCameraOn(false);
                setCameraReady(false);
                setRecording(false);
              }}
            >
              Turn camera off
            </button>
          </>
        )}
      </section>

      {/* Phrase recorder grid */}
      <section className="panel utility-panel" style={{ marginBottom: 24 }}>
        <h2>Record each phrase</h2>
        <p style={{ marginBottom: 16, fontSize: 13, color: "rgb(148 163 184)" }}>
          For each phrase: click Start, perform the sign for ~2 seconds, click Stop.
          A green tick means the signature is saved.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {PHRASES.map((phrase) => {
            const done = Boolean(signatures[phrase]);
            const isActive = activePhrase === phrase && recording;
            return (
              <div
                key={phrase}
                style={{
                  background: done ? "rgb(20 83 45 / 0.4)" : "rgb(30 41 59)",
                  border: `1px solid ${isActive ? "#f59e0b" : done ? "#16a34a" : "rgb(51 65 85)"}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                  <span>{phrase}</span>
                  {done && <span style={{ color: "#4ade80" }}>✓</span>}
                </div>
                {isActive ? (
                  <button
                    className="primary-button"
                    style={{ width: "100%", background: "#dc2626" }}
                    onClick={stopRecording}
                  >
                    Stop &amp; save
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    style={{ width: "100%" }}
                    disabled={!trackingReady || recording}
                    onClick={() => startRecording(phrase)}
                  >
                    {done ? "Re-record" : "Start recording"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {statusMsg && (
          <p role="status" style={{ marginTop: 16, fontSize: 13, color: "rgb(148 163 184)" }}>
            {statusMsg}
          </p>
        )}
        {recording && (
          <p role="status" style={{ color: "#f59e0b", marginTop: 8, fontSize: 13 }}>
            ● Recording… {frameBuffer.length} frames captured
          </p>
        )}
      </section>

      {/* Output */}
      <section className="panel utility-panel">
        <h2>Export signatures</h2>
        <p style={{ fontSize: 13, color: "rgb(148 163 184)", marginBottom: 16 }}>
          {allDone
            ? "All 8 phrases recorded. Copy the code below and replace the contents of src/signing/gestureSignatures.ts."
            : `${recorded.length}/8 phrases recorded. Record all phrases to enable full recognition.`}
        </p>
        <pre
          style={{
            background: "rgb(15 23 42)",
            border: "1px solid rgb(51 65 85)",
            borderRadius: 8,
            padding: 16,
            fontSize: 11,
            overflowX: "auto",
            color: "rgb(148 163 184)",
            maxHeight: 240,
          }}
        >
          {buildOutput()}
        </pre>
        <button
          className="primary-button"
          style={{ marginTop: 14 }}
          disabled={recorded.length === 0}
          onClick={copyAll}
        >
          {copied ? "✓ Copied!" : "Copy all signatures"}
        </button>
        <p style={{ marginTop: 12, fontSize: 12, color: "rgb(100 116 139)" }}>
          After pasting into gestureSignatures.ts, go to the conversation page
          and turn on your camera — recognition will use your signatures live.
        </p>
      </section>
    </main>
  );
}
