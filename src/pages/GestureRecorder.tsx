/**
 * Sign Capture — /record-gesture. Two independent trainers that share the same inputs
 * (camera recording or uploaded videos) but teach different things:
 *   A) Video → sign:  examples for the RECOGNIZER, saved permanently in src/signing/gestureSignatures.ts
 *   B) Sign → avatar: an ANIMATION for the avatar, saved as captures/<LANG>/<id>.capture.json
 * Only landmark numbers are kept. Never record or import a person's video without their consent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Playback } from "../components/Playback";
import { LANGUAGES, loadCatalog, type Catalog, type Plan, type SignAsset } from "../signing/pipeline";
import { createTracker, type Tracker } from "../signing/recognition/tracker";
import { clipFromFrames } from "../signing/recognition/retarget";
import { segmentSigns } from "../signing/recognition/segment";
import { bodyOf, sequenceFeatures } from "../signing/recognition/features";
import { clearUserTemplates, loadUserTemplates, saveUserTemplate } from "../signing/recognition/templates";
import { renderSignaturesFile, type TrainedMap } from "../signing/recognition/signatureFile";
import { extractFrames, loadVideoFile } from "../signing/recognition/videoFrames";
import { TRAINED_TEMPLATES } from "../signing/gestureSignatures";
import type { Frame, Template } from "../signing/recognition/types";

type Lang = "ASL" | "ESL";
const RIG = "signify-neutral-v1";
const download = (name: string, text: string, type = "application/json") => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
};
async function devPost(path: string, body: string) {
  try {
    const r = await fetch(`/__signify/${path}`, { method: "POST", body });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok ? { ok: true as const, log: j.log as string | undefined } : { ok: false as const, error: (j.error as string) || `HTTP ${r.status}` };
  } catch {
    return { ok: false as const, error: "dev server not reachable" };
  }
}
const trackedShare = (frames: Frame[]) => (frames.length ? frames.filter((f) => f.right || f.left).length / frames.length : 0);

/** Camera + record/stop. Calls onDone with the recorded frames. */
function CameraRecorder({ getTracker, onDone, disabled }: { getTracker: () => Promise<Tracker>; onDone: (frames: Frame[]) => void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<Frame[]>([]);
  const run = useRef(0);
  const [state, setState] = useState<"off" | "starting" | "ready" | "countdown" | "recording">("off");
  const [count, setCount] = useState(0), [error, setError] = useState(""), [n, setN] = useState(0);
  useEffect(() => () => { run.current++; streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);
  async function start() {
    setError(""); setState("starting");
    try {
      await getTracker();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      streamRef.current = stream; videoRef.current!.srcObject = stream; await videoRef.current!.play(); setState("ready");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start the camera."); setState("off"); }
  }
  async function record() {
    for (let c = 3; c > 0; c--) { setState("countdown"); setCount(c); await new Promise((r) => setTimeout(r, 1000)); }
    const id = ++run.current, tracker = await getTracker(), v = videoRef.current!;
    tracker.reset(); framesRef.current = []; setState("recording");
    let last = 0;
    const tick = (now: number) => {
      if (run.current !== id) return;
      if (now - last > 33) { last = now; framesRef.current.push(tracker.detect(v, Math.round(now)).frame); setN(framesRef.current.length); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function stop() { run.current++; setState("ready"); onDone(framesRef.current); }
  return (
    <div>
      <div className="camera-stage">
        <video ref={videoRef} muted playsInline aria-label="Camera preview" style={{ width: "100%", transform: "scaleX(-1)", display: state === "off" || state === "starting" ? "none" : "block" }} />
        {(state === "off" || state === "starting") && <p>Camera off</p>}
      </div>
      {state === "countdown" && <p role="status" style={{ fontSize: 28 }}>{count}</p>}
      {state === "recording" && <p role="status">● Recording… {n} frames</p>}
      <div className="video-input-actions">
        {state === "off" && <button className="primary-button" disabled={disabled} onClick={() => void start()}>Turn camera on</button>}
        {state === "starting" && <button className="primary-button" disabled>Starting…</button>}
        {state === "ready" && <button className="primary-button" disabled={disabled} onClick={() => void record()}>Record (3-second countdown)</button>}
        {state === "recording" && <button className="primary-button recording" onClick={stop}>Stop</button>}
      </div>
      {error && <p role="alert" className="inline-error">{error}</p>}
    </div>
  );
}

/** One or many video files → tracked frames (never uploaded anywhere). */
function VideoImport({ getTracker, multiple, onFrames, busyLabel }: { getTracker: () => Promise<Tracker>; multiple: boolean; onFrames: (frames: Frame[], origin: string) => void; busyLabel: string }) {
  const [progress, setProgress] = useState<string>(""), [error, setError] = useState("");
  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    try {
      const tracker = await getTracker();
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|ogv|ogg|m4v)$/i.test(file.name)) { setError(`${file.name} isn't a video file.`); continue; }
        const { video, url } = await loadVideoFile(file);
        const frames = await extractFrames(video, tracker, { onProgress: (p) => setProgress(`${file.name}: ${p}%`) });
        URL.revokeObjectURL(url);
        onFrames(frames, file.name);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not analyse the video."); }
    finally { setProgress(""); }
  }
  return (
    <div>
      <label className="upload-button">
        {progress ? busyLabel : multiple ? "Upload videos…" : "Upload a video…"}
        <input type="file" accept="video/*" multiple={multiple} aria-label={multiple ? "Upload videos" : "Upload video"} disabled={Boolean(progress)}
          onChange={(e) => { const f = e.target.files; void handle(f); e.target.value = ""; }} />
      </label>
      {progress && <p role="status" className="local-note">{progress}</p>}
      {error && <p role="alert" className="inline-error">{error}</p>}
    </div>
  );
}

interface Example { key: number; origin: string; frames: Frame[]; signId: string }
export function GestureRecorder() {
  const trackerRef = useRef<Tracker | null>(null);
  const [lang, setLang] = useState<Lang>("ESL");
  const [section, setSection] = useState<"recognition" | "avatar">("recognition");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [trackerMsg, setTrackerMsg] = useState("");
  useEffect(() => () => trackerRef.current?.close(), []);
  useEffect(() => {
    const a = new AbortController(); setCatalog(null);
    loadCatalog(a.signal, lang).then(setCatalog).catch(() => undefined);
    return () => a.abort();
  }, [lang]);
  const getTracker = useCallback(async () => {
    if (!trackerRef.current) trackerRef.current = await createTracker(setTrackerMsg);
    setTrackerMsg("");
    return trackerRef.current;
  }, []);
  const signs = catalog?.signs ?? [];

  // ── A · recognition ─────────────────────────────────────────────────────
  const [examples, setExamples] = useState<Example[]>([]);
  const [defaultSign, setDefaultSign] = useState("");
  const [oneSignPerVideo, setOneSignPerVideo] = useState(true);
  const [unsaved, setUnsaved] = useState<Template[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [msgA, setMsgA] = useState("");
  const keyRef = useRef(1);
  useEffect(() => { setUnsaved(loadUserTemplates(lang)); setExamples([]); setDefaultSign(""); }, [lang]);
  const permanent = (TRAINED_TEMPLATES[lang] || []).map((t, i) => ({ t, k: `${lang}:${i}` }));

  function addExamples(frames: Frame[], origin: string, whole: boolean) {
    const segs = whole ? [{ start: frames[0]?.t ?? 0, end: frames.at(-1)?.t ?? 0, frames }] : segmentSigns(frames);
    if (!frames.some((f) => f.right || f.left)) { setMsgA(`${origin}: no hands were found.`); return; }
    if (!segs.length) { setMsgA(`${origin}: no signing movement found. Try “each video is one sign”.`); return; }
    setMsgA("");
    const single = whole || segs.length === 1;
    setExamples((prev) => [...prev, ...segs.map((s): Example => ({
      key: keyRef.current++,
      origin: whole ? origin : `${origin} @${s.start.toFixed(1)}s`,
      frames: s.frames,
      signId: single ? defaultSign : "",
    }))]);
  }
  function commitExamples() {
    let added = 0;
    for (const ex of examples) {
      const sign = signs.find((s) => s.id === ex.signId);
      const rows = sign && sequenceFeatures(ex.frames, bodyOf(ex.frames));
      if (sign && rows) { saveUserTemplate(lang, { id: sign.id, label: sign.label, rows, source: "user", origin: ex.origin }); added++; }
    }
    setUnsaved(loadUserTemplates(lang));
    setExamples((prev) => prev.filter((e) => !signs.find((s) => s.id === e.signId)));
    setMsgA(`${added} example${added === 1 ? "" : "s"} added (not yet saved to the file).`);
  }
  const trainedMap = useMemo<TrainedMap>(() => {
    const map: TrainedMap = {};
    for (const l of LANGUAGES.map((x) => x.code)) {
      const keep = (TRAINED_TEMPLATES[l] || []).filter((_, i) => !removed.has(`${l}:${i}`));
      map[l] = [...keep, ...(l === lang ? unsaved : loadUserTemplates(l))];
    }
    return map;
  }, [removed, unsaved, lang]);
  async function saveSignatures() {
    const text = renderSignaturesFile(trainedMap);
    const r = await devPost("save-signatures", text);
    if (r.ok) {
      LANGUAGES.forEach((l) => clearUserTemplates(l.code));
      setUnsaved([]); setRemoved(new Set());
      setMsgA("Saved to src/signing/gestureSignatures.ts. The page reloads with the new examples built in.");
    } else {
      download("gestureSignatures.ts", text, "text/plain");
      setMsgA(`Couldn't write the file directly (${r.error}). Downloaded gestureSignatures.ts instead: replace src/signing/gestureSignatures.ts with it.`);
    }
  }
  const counts = useMemo(() => signs.map((s) => ({
    id: s.id, label: s.label,
    saved: permanent.filter((p) => p.t.id === s.id && !removed.has(p.k)).length,
    unsaved: unsaved.filter((t) => t.id === s.id).length,
  })), [signs, permanent, removed, unsaved]);

  // ── B · avatar ─────────────────────────────────────────────────────────
  const [label, setLabel] = useState(""), [labelAr, setLabelAr] = useState(""), [signer, setSigner] = useState(""), [source, setSource] = useState("");
  const [candidate, setCandidate] = useState<{ frames: Frame[]; origin: string } | null>(null);
  const [segPick, setSegPick] = useState(0);
  const [msgB, setMsgB] = useState("");
  const [preview, setPreview] = useState<{ catalog: Catalog; plan: Plan; entry: SignAsset; clipJson: unknown; coverage: number } | null>(null);
  const segments = useMemo(() => (candidate ? segmentSigns(candidate.frames) : []), [candidate]);

  function convert(frames: Frame[]) {
    if (!label.trim()) { setMsgB("Enter the English label for this sign first."); return; }
    const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sign";
    const result = frames.length > 5 ? clipFromFrames(frames, `${lang.toLowerCase()}-${slug}`) : null;
    if (!result || result.coverage < 0.4) {
      setMsgB(`Not enough tracked movement (${frames.length} frames${result ? `, hands tracked in ${Math.round(result.coverage * 100)}%` : ""}). Keep arms and hands in view and try again.`);
      return;
    }
    const clipJson = THREE.AnimationClip.toJSON(result.clip);
    const url = URL.createObjectURL(new Blob([JSON.stringify(clipJson)], { type: "application/json" }));
    const entry: SignAsset = {
      id: slug, label: label.trim(), ...(labelAr.trim() ? { labelAr: labelAr.trim() } : {}), aliases: labelAr.trim() ? [labelAr.trim()] : [],
      description: `Captured from a signer${signer ? ` (${signer})` : ""} and retargeted to the avatar. Contacts are approximate.`,
      hands: result.hands, kind: "sign", rigId: RIG, url, motion: result.motion, cues: [{ start: 0, caption: label.trim() }],
      source: source.trim() || "https://www.za.gov.ae/Sign-Language-Dictionary", license: "Recorded with the signer's consent; terms to be set by the project",
      validation: "draft", reviewedBy: "", reviewedOn: "",
    };
    const cat: Catalog = { version: 1, language: lang, rig: { id: RIG, url: null }, signs: [entry], phrases: [] };
    setMsgB(""); setPreview({ catalog: cat, plan: { text: entry.label, language: lang, signs: [entry], transitionSeconds: 0.25, mode: "vocabulary" }, entry, clipJson, coverage: result.coverage });
  }
  /** Trim to the signing part (± 0.3 s) so idle time before/after doesn't become part of the sign. */
  const trim = (frames: Frame[]) => {
    const segs = segmentSigns(frames);
    if (!segs.length) return frames;
    const a = segs[0].start - 0.3, b = segs[segs.length - 1].end + 0.3;
    return frames.filter((f) => f.t >= a && f.t <= b);
  };
  async function saveCapture() {
    if (!preview) return;
    const { url: _u, ...entry } = preview.entry; void _u;
    const body = JSON.stringify({ entry: { ...entry, url: "" }, clip: preview.clipJson });
    const r = await devPost(`save-capture?language=${lang}&id=${preview.entry.id}`, body);
    if (r.ok) setMsgB(`Saved to captures/${lang}/${preview.entry.id}.capture.json and rebuilt the catalog. Reload the Speech to Sign page to see it.`);
    else { download(`${preview.entry.id}.capture.json`, body); setMsgB(`Couldn't save directly (${r.error}). Downloaded the file: put it in captures/${lang}/ and run npm run build:assets.`); }
  }

  return (
    <main id="main" className="workspace" style={{ maxWidth: 1040 }}>
      <div className="conversation-title">
        <h1>Sign Capture</h1>
        <p>Teach the recognizer and the avatar separately. Only landmark numbers are kept; get the signer's consent before recording or importing a video.</p>
      </div>
      <div className="workspace-toolbar">
        <div className="mode-tabs">
          <button aria-pressed={section === "recognition"} onClick={() => setSection("recognition")}>A · Video → sign (recognition)</button>
          <button aria-pressed={section === "avatar"} onClick={() => setSection("avatar")}>B · Sign → avatar (animation)</button>
        </div>
      </div>
      <section className="panel utility-panel">
        <label className="field-label" htmlFor="cap-lang">Sign language</label>
        <select id="cap-lang" value={lang} onChange={(e) => { setLang(e.target.value as Lang); setPreview(null); setCandidate(null); }}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        {trackerMsg && <p role="status" className="local-note">{trackerMsg}</p>}
      </section>

      {section === "recognition" ? (
        <>
          <div className="workspace-grid">
            <section className="panel utility-panel">
              <h2>1 · Add examples</h2>
              <label className="field-label" htmlFor="cap-sign">Sign these examples show</label>
              <select id="cap-sign" value={defaultSign} onChange={(e) => setDefaultSign(e.target.value)}>
                <option value="">choose…</option>
                {signs.map((s) => <option key={s.id} value={s.id}>{s.label}{s.labelAr ? ` · ${s.labelAr}` : ""}</option>)}
              </select>
              <p className="local-note">New words must first exist in the catalog: create them in section B.</p>
              <h3>Record</h3>
              <CameraRecorder getTracker={getTracker} onDone={(f) => addExamples(f, "camera recording", true)} />
              <h3>Or import videos</h3>
              <label className="check-row">
                <input type="checkbox" checked={oneSignPerVideo} onChange={(e) => setOneSignPerVideo(e.target.checked)} />
                <span>Each video is one sign (otherwise split into signs automatically)</span>
              </label>
              <VideoImport getTracker={getTracker} multiple busyLabel="Analysing…" onFrames={(f, o) => addExamples(f, o, oneSignPerVideo)} />
            </section>
            <section className="panel utility-panel">
              <h2>2 · Check and add</h2>
              {examples.length === 0 ? <p className="empty-result">Recorded or imported examples appear here.</p> : (
                <ol style={{ listStyle: "none", padding: 0 }}>
                  {examples.map((ex) => (
                    <li key={ex.key} style={{ borderTop: "1px solid rgb(51 65 85)", padding: "8px 0", fontSize: 13 }}>
                      <strong>{ex.origin}</strong> · {ex.frames.length} frames · hands in {Math.round(trackedShare(ex.frames) * 100)}%
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <select aria-label={`Sign for ${ex.origin}`} value={ex.signId} onChange={(e) => setExamples((p) => p.map((x) => (x.key === ex.key ? { ...x, signId: e.target.value } : x)))}>
                          <option value="">choose sign…</option>
                          {signs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <button className="text-button" onClick={() => setExamples((p) => p.filter((x) => x.key !== ex.key))}>Remove</button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <button className="primary-button" disabled={!examples.some((e) => e.signId)} onClick={commitExamples}>Add labelled examples</button>
              {msgA && <p role="status" className="local-note">{msgA}</p>}
            </section>
          </div>
          <section className="panel utility-panel">
            <h2>3 · Save permanently</h2>
            <p>
              Examples are numbers saved in <code>src/signing/gestureSignatures.ts</code>, which the recognizer loads at start-up.
              {unsaved.length > 0 && <strong> {unsaved.length} unsaved example{unsaved.length === 1 ? "" : "s"} (this browser only).</strong>}
              {removed.size > 0 && <strong> {removed.size} marked for removal.</strong>}
            </p>
            <div className="video-input-actions">
              <button className="primary-button" onClick={() => void saveSignatures()} disabled={!unsaved.length && !removed.size}>Save to gestureSignatures.ts</button>
              <button className="text-button" onClick={() => download("gestureSignatures.ts", renderSignaturesFile(trainedMap), "text/plain")}>Download gestureSignatures.ts</button>
              <button className="text-button" disabled={!unsaved.length} onClick={() => { clearUserTemplates(lang); setUnsaved([]); }}>Discard unsaved</button>
            </div>
            <p className="local-note">“Save” writes the file when running <code>npm run dev</code>; otherwise it downloads the file for you to drop in.</p>
            <table style={{ width: "100%", fontSize: 13, marginTop: 8 }}>
              <thead><tr><th align="left">Sign</th><th>In file</th><th>Unsaved</th></tr></thead>
              <tbody>{counts.map((c) => <tr key={c.id}><td>{c.label}</td><td align="center">{c.saved}</td><td align="center">{c.unsaved}</td></tr>)}</tbody>
            </table>
            {permanent.length > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary>Saved examples ({permanent.length})</summary>
                <ul style={{ listStyle: "none", padding: 0, fontSize: 13 }}>
                  {permanent.map(({ t, k }) => (
                    <li key={k} style={{ display: "flex", gap: 8, alignItems: "center", opacity: removed.has(k) ? 0.4 : 1 }}>
                      <span>{t.label} — {t.origin ?? "saved example"}</span>
                      <button className="text-button" onClick={() => setRemoved((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; })}>{removed.has(k) ? "Undo" : "Remove"}</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="workspace-grid">
            <section className="panel utility-panel">
              <h2>1 · Describe the sign</h2>
              <label className="field-label" htmlFor="cap-label">English label</label>
              <input id="cap-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Thank you" />
              <label className="field-label" htmlFor="cap-ar">Arabic label (optional)</label>
              <input id="cap-ar" dir="rtl" lang="ar" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} placeholder="شكرا" />
              <label className="field-label" htmlFor="cap-signer">Signer (name or initials, optional)</label>
              <input id="cap-signer" value={signer} onChange={(e) => setSigner(e.target.value)} />
              <label className="field-label" htmlFor="cap-source">Reference (dictionary page / URL)</label>
              <input id="cap-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://www.za.gov.ae/Sign-Language-Dictionary" />
            </section>
            <section className="panel utility-panel">
              <h2>2 · Record or import</h2>
              <CameraRecorder getTracker={getTracker} onDone={(f) => convert(trim(f))} />
              <h3>Or import a video</h3>
              <VideoImport getTracker={getTracker} multiple={false} busyLabel="Analysing…"
                onFrames={(f, o) => { setCandidate({ frames: f, origin: o }); setSegPick(0); setPreview(null); const segs = segmentSigns(f); if (segs.length <= 1) convert(trim(f)); }} />
              {candidate && segments.length > 1 && (
                <div>
                  <p className="local-note">{candidate.origin} contains {segments.length} signs. Pick the one to turn into an animation:</p>
                  <select aria-label="Sign in video" value={segPick} onChange={(e) => setSegPick(Number(e.target.value))}>
                    {segments.map((s, i) => <option key={i} value={i}>#{i + 1} · {s.start.toFixed(1)}s–{s.end.toFixed(1)}s</option>)}
                  </select>
                  <button className="primary-button" onClick={() => { const s = segments[segPick]; convert(candidate.frames.filter((f) => f.t >= s.start - 0.3 && f.t <= s.end + 0.3)); }}>Convert selected sign</button>
                </div>
              )}
              {msgB && <p role="alert" className="inline-error">{msgB}</p>}
            </section>
          </div>
          {preview && (
            <>
              <p className="local-note">Hands tracked in {Math.round(preview.coverage * 100)}% of frames. Preview the avatar, then save.</p>
              <div className="workspace-grid">
                <Playback key={preview.entry.url} catalog={preview.catalog} plan={preview.plan} />
                <section className="panel utility-panel">
                  <h2>3 · Save</h2>
                  <p>Saves <code>captures/{lang}/{preview.entry.id}.capture.json</code> and rebuilds the catalog (when running <code>npm run dev</code>); otherwise downloads the file for <code>captures/{lang}/</code> + <code>npm run build:assets</code>.</p>
                  <button className="primary-button" onClick={() => void saveCapture()}>Save to project</button>
                  <p className="local-note">Saved signs are marked <strong>draft</strong>. A qualified signer of the language must review them before real use.</p>
                </section>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
