/**
 * Copies MediaPipe's WASM runtime into public/ (so the app never depends on a CDN at run time) and
 * downloads the two model files if missing. Network failure is NOT fatal: the app falls back to
 * Google's model URLs in the browser. Run automatically before `npm run dev` / `build`.
 */
import fs from "node:fs";
import path from "node:path";
const quiet = process.argv.includes("--quiet");
const log = (...a) => !quiet && console.log(...a);
const from = "node_modules/@mediapipe/tasks-vision/wasm", to = "public/mediapipe/wasm";
if (fs.existsSync(from)) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f));
  log(`MediaPipe WASM → ${to}`);
} else console.warn("setup-mediapipe: @mediapipe/tasks-vision not installed; run npm install");
const models = {
  "hand_landmarker.task": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  "pose_landmarker_lite.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};
fs.mkdirSync("public/models", { recursive: true });
for (const [file, url] of Object.entries(models)) {
  const dest = path.join("public/models", file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1e6) continue;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    log(`model ${file} downloaded`);
  } catch (e) {
    console.warn(`setup-mediapipe: could not download ${file} (${e.message}). The browser will fetch it from Google at run time instead.`);
  }
}
