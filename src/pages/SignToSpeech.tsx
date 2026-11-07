import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Video, Volume2, Activity, Copy } from "lucide-react";
import { LANGUAGES, loadCatalog, type Catalog } from "../signing/pipeline";
import { createTracker, type Overlay, type Tracker } from "../signing/recognition/tracker";
import { SignRecognizer } from "../signing/recognition/recognizer";
import { segmentSigns } from "../signing/recognition/segment";
import { seekTo } from "../signing/recognition/videoFrames";
import { allTrainedTemplates, buildRecognizer, templatesFromCatalog } from "../signing/recognition/templates";
import type { Frame, Recognition, Template } from "../signing/recognition/types";

interface Detection {
  id: number;
  start: number;
  end: number;
  result: Recognition;
}
const REASONS: Record<string, string> = {
  "no-hand": "No hand was visible.",
  "too-short": "Too little hand movement to judge.",
  "no-match": "Not close enough to any known sign.",
};
const ANALYSIS_FPS = 15;

export function SignToSpeech({ languageCode, onLanguageChange }: { languageCode: "ASL" | "ESL"; onLanguageChange: (c: "ASL" | "ESL") => void }) {
  const language = LANGUAGES.find((l) => l.code === languageCode) ?? LANGUAGES[0];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<Tracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef(new Map<number, Frame[]>());
  const runId = useRef(0);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [avatarTemplates, setAvatarTemplates] = useState<Template[]>([]);
  const [trainedTemplates, setTrainedTemplates] = useState<Template[]>([]);
  const [status, setStatus] = useState("Loading sign templates…");
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  const [upload, setUpload] = useState<{ url: string; name: string } | null>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [wholeClip, setWholeClip] = useState(false);
  const [leftHanded, setLeftHanded] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [handSeen, setHandSeen] = useState(false);
  const [trackerState, setTrackerState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // Templates for the selected language: avatar-derived bootstrap + this browser's own recordings.
  useEffect(() => {
    const abort = new AbortController();
    setCatalog(null); setAvatarTemplates([]); setDetections([]); setStatus("Loading sign templates…");
    loadCatalog(abort.signal, languageCode)
      .then(async (c) => {
        setCatalog(c);
        const t = await templatesFromCatalog(c, abort.signal);
        if (abort.signal.aborted) return;
        setAvatarTemplates(t);
        setTrainedTemplates(allTrainedTemplates(languageCode));
        setStatus("");
      })
      .catch((e) => !abort.signal.aborted && setError(e instanceof Error ? e.message : "Could not load sign templates."));
    return () => abort.abort();
  }, [languageCode]);

  const recognizer = useMemo<SignRecognizer | null>(
    () => (avatarTemplates.length ? buildRecognizer(avatarTemplates, trainedTemplates, { leftHanded }) : null),
    [avatarTemplates, trainedTemplates, leftHanded]);
  const recognizerRef = useRef(recognizer);
  recognizerRef.current = recognizer;

  const ensureTracker = useCallback(async () => {
    if (trackerRef.current) return trackerRef.current;
    setTrackerState("loading");
    try {
      const t = await createTracker(setStatus);
      trackerRef.current = t;
      setTrackerState("ready"); setStatus(t.hasPose ? "" : "Body model unavailable — hand shape only (less accurate).");
      return t;
    } catch (e) {
      setTrackerState("error");
      throw new Error(`Hand tracking could not start: ${e instanceof Error ? e.message : e}. Check your connection (first run downloads the models) and try again.`);
    }
  }, []);

  const stopCamera = useCallback(() => {
    runId.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current && !upload) videoRef.current.srcObject = null;
    setCamera(false); setLive(false);
  }, [upload]);
  useEffect(() => () => {
    runId.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    trackerRef.current?.close(); trackerRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => () => { if (upload) URL.revokeObjectURL(upload.url); }, [upload]);

  function draw(o: Overlay) {
    const c = canvasRef.current, v = videoRef.current;
    if (!c || !v) return;
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = "#4ade80";
    for (const hand of o.hands) for (const p of hand) { g.beginPath(); g.arc(p.x * c.width, p.y * c.height, 3, 0, 7); g.fill(); }
    g.fillStyle = "#93c5fd";
    for (const i of [0, 11, 12, 13, 14, 15, 16]) { const p = o.pose?.[i]; if (p) { g.beginPath(); g.arc(p.x * c.width, p.y * c.height, 4, 0, 7); g.fill(); } }
  }

  function addDetections(items: { start: number; end: number; frames: Frame[] }[]) {
    const rec = recognizerRef.current;
    if (!rec) return;
    setDetections((prev) => {
      const next = [...prev];
      for (const seg of items) {
        const id = Date.now() + Math.random();
        framesRef.current.set(id, seg.frames);
        next.push({ id, start: seg.start, end: seg.end, result: rec.recognize(seg.frames) });
      }
      return next;
    });
  }

  async function startCamera() {
    setError(""); setDetections([]);
    try {
      const tracker = await ensureTracker();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      const v = videoRef.current!;
      setUpload(null);
      v.srcObject = stream; streamRef.current = stream;
      await v.play();
      setCamera(true);
      void loop(tracker);
    } catch (e) {
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access or upload a video instead." : e instanceof Error ? e.message : "Camera unavailable.");
      stopCamera();
    }
  }
  // Live loop: every processed frame joins a rolling buffer; finished signs are recognised exactly as in uploads.
  async function loop(tracker: Tracker) {
    const id = ++runId.current;
    const buffer: Frame[] = [];
    let last = 0, lastSeg = 0, consumed = -1;
    const v = videoRef.current!;
    const tick = (now: number) => {
      if (runId.current !== id) return;
      if (v.readyState >= 2 && now - last >= 45) {
        last = now;
        try {
          const { frame, overlay } = tracker.detect(v, Math.round(now));
          draw(overlay);
          setHandSeen(Boolean(frame.right || frame.left));
          buffer.push(frame);
          while (buffer.length && frame.t - buffer[0].t > 12) buffer.shift();
          if (liveRef.current && now - lastSeg > 400) {
            lastSeg = now;
            const done = segmentSigns(buffer, { leftHanded }).filter((s) => s.end > consumed && frame.t - s.end > 0.55);
            if (done.length) { consumed = done[done.length - 1].end; addDetections(done); }
          }
        } catch (e) { setError(e instanceof Error ? e.message : "Tracking error"); return; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const liveRef = useRef(false);
  liveRef.current = live;

  async function analyzeUpload() {
    const v = videoRef.current;
    if (!v || !upload) return;
    setError(""); setDetections([]); setBusy(true); setProgress(0);
    const id = ++runId.current;
    try {
      const tracker = await ensureTracker();
      if (!Number.isFinite(v.duration) || v.duration <= 0) throw new Error("This video's length can't be read. Try an MP4 or WebM file.");
      tracker.reset();
      const frames: Frame[] = [];
      const step = 1 / ANALYSIS_FPS;
      for (let t = 0; t <= v.duration; t += step) {
        if (runId.current !== id) return;
        await seekTo(v, t);
        const { frame, overlay } = tracker.detect(v, Math.round(t * 1000));
        draw(overlay);
        frames.push(frame);
        setProgress(Math.round((t / v.duration) * 100));
      }
      if (!frames.some((f) => f.right || f.left)) { setError("No hands were found in this video. Make sure hands are visible and well lit."); return; }
      const segs = wholeClip ? [{ start: 0, end: v.duration, frames }] : segmentSigns(frames, { leftHanded });
      if (!segs.length) setError("Hands were visible, but no signing movement was found. Try “Treat the whole video as one sign”.");
      else addDetections(segs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally { setBusy(false); setProgress(100); }
  }

  const accepted = detections.filter((d) => d.result.accepted);
  const transcript = accepted.map((d) => d.result.best!.label).join(" ");
  function speak() {
    if (!("speechSynthesis" in window)) { setError("Speech playback is unavailable in this browser."); return; }
    window.speechSynthesis.cancel();
    const labelAr = (label: string) => catalog?.signs.find((s) => s.label === label)?.labelAr;
    const text = language.rtl ? accepted.map((d) => labelAr(d.result.best!.label) || d.result.best!.label).join(" ") : transcript;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language.rtl ? "ar-AE" : "en-US";
    window.speechSynthesis.speak(u);
  }

  return (
    <>
      <div className="workspace-grid">
        <section className="panel utility-panel">
          <h2>Video input</h2>
          <label className="field-label" htmlFor="recognition-language">Sign language</label>
          <select id="recognition-language" value={languageCode} disabled={live || busy} onChange={(e) => onLanguageChange(e.target.value as "ASL" | "ESL")}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <div className="camera-stage" style={{ position: "relative" }}>
            <video ref={videoRef} src={upload?.url} muted playsInline controls={Boolean(upload)}
              style={{ display: camera || upload ? "block" : "none", transform: camera ? "scaleX(-1)" : undefined, width: "100%" }}
              aria-label="Video being analysed" onError={() => upload && setError("This video cannot be played. Try an MP4 or WebM file.")} />
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", transform: camera ? "scaleX(-1)" : undefined }} />
            {!camera && !upload && <Video size={42} aria-label="No video selected" />}
          </div>
          {camera && (
            <p role="status" style={{ fontSize: 12, marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
              <Activity size={13} />
              {trackerState === "loading" ? status : handSeen ? <span style={{ color: "#4ade80" }}>Hand detected</span> : <span style={{ color: "#94a3b8" }}>No hand in frame</span>}
            </p>
          )}
          <div className="video-input-actions">
            <button className="primary-button" disabled={busy} onClick={() => (camera ? stopCamera() : void startCamera())}>
              {camera ? "Turn camera off" : "Turn camera on"}
            </button>
            <label className="upload-button">
              <Upload size={18} /> Upload video
              <input type="file" accept="video/*" aria-label="Upload video" disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|ogv|ogg|m4v)$/i.test(file.name)) { setError("Please select a video file."); return; }
                  stopCamera(); setDetections([]); setError("");
                  setUpload({ url: URL.createObjectURL(file), name: file.name });
                }} />
            </label>
          </div>
          {upload && <p className="upload-name">Selected: {upload.name}</p>}
          <label className="check-row">
            <input type="checkbox" checked={wholeClip} onChange={(e) => setWholeClip(e.target.checked)} />
            <span>Treat the whole video as one sign</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={leftHanded} onChange={(e) => setLeftHanded(e.target.checked)} />
            <span>Signer is left-handed</span>
          </label>
          {camera && (
            <button className="primary-button" style={{ marginTop: 12, background: live ? "#16a34a" : undefined }} disabled={!recognizer || trackerState !== "ready"} onClick={() => setLive((v) => !v)}>
              {live ? "● Live recognition ON" : "Start live recognition"}
            </button>
          )}
          {upload && (
            <button className="primary-button convert-button" disabled={!recognizer || busy} onClick={() => void analyzeUpload()}>
              {busy ? `Analysing… ${progress}%` : "Convert sign to speech"}
            </button>
          )}
          {status && !camera && <p role="status" className="analyzing-status">{status}</p>}
          {error && <p role="alert" className="inline-error">{error}</p>}
        </section>

        <section className="panel utility-panel">
          <h2>Recognition output</h2>
          <span className="pill">{avatarTemplates.length} {language.code} signs · {trainedTemplates.length} trained examples</span>
          {transcript ? <p className="sample-result" role="status" dir="auto">{transcript}</p>
            : <p className="empty-result">{live ? "Sign in front of the camera, then lower your hands briefly between signs." : "Turn on the camera or upload a video."}</p>}
          {transcript && (
            <div className="output-actions">
              <button className="primary-button" onClick={speak}><Volume2 size={18} /> Play speech</button>
              <button className="text-button" onClick={() => void navigator.clipboard?.writeText(transcript)}><Copy size={15} /> Copy text</button>
              <button className="text-button" onClick={() => { setDetections([]); framesRef.current.clear(); }}>Clear</button>
            </div>
          )}
          <ol style={{ listStyle: "none", padding: 0, marginTop: 14 }}>
            {detections.map((d) => (
              <li key={d.id} style={{ borderTop: "1px solid rgb(51 65 85)", padding: "10px 0", fontSize: 13 }}>
                <strong>{d.start.toFixed(1)}s–{d.end.toFixed(1)}s · </strong>
                {d.result.accepted
                  ? <span style={{ color: "#4ade80" }}>{d.result.best!.label} ({Math.round(d.result.best!.confidence * 100)}%)</span>
                  : <span style={{ color: "#facc15" }}>Not sure — {REASONS[d.result.reason ?? "no-match"]}</span>}
                {d.result.ranked.length > 0 && <div style={{ color: "#94a3b8" }}>Closest: {d.result.ranked.slice(0, 3).map((c) => `${c.label} ${Math.round(c.confidence * 100)}%`).join(" · ")}</div>}
              </li>
            ))}
          </ol>
          <p className="phrase-hint">
            Camera frames are processed in this browser and are not uploaded. To improve recognition, add examples in Sign Capture.
          </p>
        </section>
      </div>
    </>
  );
}
