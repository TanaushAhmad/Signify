/**
 * Turn the ESL Zayed reference videos into
 *   (1) avatar animations   → captures/ESL/<id>.capture.json  (merged by `npm run build:assets`)
 *   (2) recognition samples → src/signing/gestureSignatures.ts (real-landmark examples)
 * Input is the landmark JSON from scripts/extract-landmarks.py (numbers only; no imagery kept).
 *   python3 scripts/extract-landmarks.py video.mp4 scripts/data/<name>.json
 *   npx tsx scripts/import-esl-videos.ts
 */
import fs from "node:fs";
import * as THREE from "three";
import { loadFrames } from "./lib/landmark-frames";
import { segmentSigns } from "../src/signing/recognition/segment";
import { bodyOf, sequenceFeatures } from "../src/signing/recognition/features";
import { clipFromFrames } from "../src/signing/recognition/retarget";
import { renderSignaturesFile, SIGNATURES_PATH, type TrainedMap } from "../src/signing/recognition/signatureFile";
import { TRAINED_TEMPLATES } from "../src/signing/gestureSignatures";

const SOURCE = "https://www.instagram.com/esl_zayed/";
const LICENSE = "Motion data derived from an ESL Zayed (Zayed Higher Organization) reference video; no imagery is stored. Permission to publish derived animations must be confirmed with the Zayed Higher Organization.";
interface Plan { file: string; signs: { id: string; label: string; labelAr: string; aliases: string[]; note: string }[] }
const plans: Plan[] = JSON.parse(fs.readFileSync("scripts/data/esl-import-plan.json", "utf8"));

fs.mkdirSync("captures/ESL", { recursive: true });
const trained: TrainedMap = JSON.parse(JSON.stringify(TRAINED_TEMPLATES));
trained.ESL = (trained.ESL || []).filter((t) => !t.origin?.startsWith("ESL Zayed video"));
for (const plan of plans) {
  const frames = loadFrames(plan.file);
  const segments = segmentSigns(frames);
  if (segments.length !== plan.signs.length) throw new Error(`${plan.file}: found ${segments.length} signs, expected ${plan.signs.length}`);
  segments.forEach((seg, i) => {
    const s = plan.signs[i];
    const padded = frames.filter((f) => f.t >= seg.start - 0.3 && f.t <= seg.end + 0.3);
    const result = clipFromFrames(padded, `esl-${s.id}`);
    if (!result) throw new Error(`${s.label}: not enough tracked movement`);
    const entry = {
      id: s.id, label: s.label, labelAr: s.labelAr, aliases: s.aliases, description: s.note,
      hands: result.hands, kind: "sign", rigId: "signify-neutral-v1", url: "", motion: result.motion,
      cues: [{ start: 0, caption: s.label }], source: SOURCE, license: LICENSE,
      validation: "draft", reviewedBy: "", reviewedOn: "",
    };
    fs.writeFileSync(`captures/ESL/${s.id}.capture.json`, JSON.stringify({ entry, clip: THREE.AnimationClip.toJSON(result.clip) }));
    const rows = sequenceFeatures(seg.frames, bodyOf(seg.frames));
    if (rows) trained.ESL.push({ id: s.id, label: s.label, rows, source: "user", origin: `ESL Zayed video ${plan.file.split("/").pop()} @${seg.start.toFixed(1)}s` });
    console.log(`${s.label}: ${seg.start.toFixed(2)}–${seg.end.toFixed(2)}s, hands ${result.hands}, hand-tracked ${Math.round(result.coverage * 100)}%`);
  });
}
fs.writeFileSync(SIGNATURES_PATH, renderSignaturesFile(trained));
console.log(`wrote ${SIGNATURES_PATH} (${trained.ESL.length} ESL examples)`);
