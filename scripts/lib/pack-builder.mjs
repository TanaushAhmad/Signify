/**
 * Turns authored sign specs into animation clips + a catalog for ONE sign language.
 * Shared by the ASL and ESL packs so both get identical motion quality.
 */
import fs from "node:fs";
import * as THREE from "three";
import { bones, rest } from "../rig-authoring.mjs";

const EPS = 1e-4;
const same = (a, b) => 1 - Math.abs(a.dot(b)) < EPS;
const flip = (a, ref) => (a.dot(ref) < 0 ? new THREE.Quaternion(-a.x, -a.y, -a.z, -a.w) : a.clone());
function qlog(a) {
  const v = Math.hypot(a.x, a.y, a.z);
  if (v < 1e-9) return new THREE.Vector3();
  const k = Math.atan2(v, a.w) / v;
  return new THREE.Vector3(a.x * k, a.y * k, a.z * k);
}
function qexp(v) {
  const m = v.length();
  if (m < 1e-9) return new THREE.Quaternion();
  const k = Math.sin(m) / m;
  return new THREE.Quaternion(v.x * k, v.y * k, v.z * k, Math.cos(m));
}
/** SQUAD control point; zero tangent when the neighbour is a hold so held poses stay perfectly still. */
function control(prev, cur, next) {
  if (same(cur, next) || same(cur, prev)) return cur.clone();
  const inv = cur.clone().invert();
  const a = qlog(inv.clone().multiply(flip(next, cur)));
  const b = qlog(inv.clone().multiply(flip(prev, cur)));
  return cur.clone().multiply(qexp(a.add(b).multiplyScalar(-0.25)));
}
/** C1-continuous quaternion interpolation through the anchors: no stop at every keyframe. */
function squad(p0, p1, p2, p3, t) {
  if (same(p1, p2)) return p1.clone();
  const q2 = flip(p2, p1);
  const s1 = control(p0, p1, q2), s2 = control(p1, q2, flip(p3, q2));
  const a = p1.clone().slerp(q2, t), b = s1.clone().slerp(s2, t);
  return a.slerp(b, 2 * t * (1 - t));
}
const ease = (t) => t * t * (3 - 2 * t);

export function sampleBone(anchors, name, time) {
  let i = anchors.findIndex(([t]) => t >= time);
  if (i <= 0) return rest[name].clone();
  const [a, pA] = anchors[i - 1], [b, pB] = anchors[i];
  const t = (time - a) / (b - a);
  const p0 = anchors[Math.max(i - 2, 0)][1][name], p3 = anchors[Math.min(i + 1, anchors.length - 1)][1][name];
  // Ease only the first/last segment so every clip starts and ends at rest with zero velocity.
  const u = i === 1 || i === anchors.length - 1 ? ease(t) : t;
  return squad(p0, pA[name], pB[name], p3, u);
}

export function buildPack({ language, rigId = "signify-neutral-v1", dir, catalogPath, specs, review, title, notes, pending = [], captureDir }) {
  const catalog = { version: 1, language, rig: { id: rigId, url: null }, signs: [], phrases: [], ...(pending.length ? { pending } : {}) };
  fs.mkdirSync(dir, { recursive: true });
  for (const spec of specs) {
    const duration = spec.anchors.at(-1)[0];
    const times = Array.from({ length: Math.ceil(duration * 30) + 1 }, (_, i) => Math.min(i / 30, duration));
    times[times.length - 1] = duration;
    const tracks = bones.map((name) => new THREE.QuaternionKeyframeTrack(
      `${name}.quaternion`, times, times.flatMap((time) => sampleBone(spec.anchors, name, time).toArray())));
    const clip = new THREE.AnimationClip(`${language.toLowerCase()}-${spec.id}`, duration, tracks);
    fs.writeFileSync(`${dir}/${spec.id}.json`, JSON.stringify(THREE.AnimationClip.toJSON(clip)) + "\n");
    const meta = review(spec);
    const urlBase = "/" + dir.replace(/^public\//, "");
    catalog.signs.push({
      id: spec.id, label: spec.label, aliases: spec.aliases || [], description: spec.note,
      hands: spec.hands, kind: "sign", rigId, url: `${urlBase}/${spec.id}.json`,
      // Active window: from the first pose reached to the last pose left. Used to skip the
      // rest-pose lead-in/out between neighbouring signs so sentences flow.
      motion: { start: +spec.anchors[1][0].toFixed(3), end: +spec.anchors.at(-2)[0].toFixed(3) },
      cues: [{ start: 0, caption: spec.label }],
      ...(spec.labelAr ? { labelAr: spec.labelAr } : {}),
      ...meta,
    });
    catalog.phrases.push({ text: spec.label, signIds: [spec.id], transitionSeconds: 0.3, ...meta });
  }
  // Captured signs (from the Sign Capture tool): captures/<LANG>/<id>.capture.json = { entry, clip }.
  if (captureDir && fs.existsSync(captureDir)) {
    const key = (t) => (t || "").toLowerCase().replace(/[\u064B-\u065F\u0640]/g, "").trim();
    for (const file of fs.readdirSync(captureDir).filter((f) => f.endsWith(".capture.json"))) {
      const { entry, clip } = JSON.parse(fs.readFileSync(`${captureDir}/${file}`, "utf8"));
      if (catalog.signs.some((x) => x.id === entry.id)) { console.warn(`capture ${file}: id "${entry.id}" already exists, skipped`); continue; }
      fs.writeFileSync(`${dir}/${entry.id}.json`, JSON.stringify(clip) + "\n");
      const meta = { source: entry.source, license: entry.license, validation: entry.validation || "draft", reviewedBy: entry.reviewedBy || "", reviewedOn: entry.reviewedOn || "" };
      catalog.signs.push({ ...entry, url: `/${dir.replace(/^public\//, "")}/${entry.id}.json`, ...meta });
      catalog.phrases.push({ text: entry.label, signIds: [entry.id], transitionSeconds: 0.3, ...meta });
      if (catalog.pending) catalog.pending = catalog.pending.filter((p) => ![p.label, p.labelAr, ...(p.aliases || [])].some((n) => n && [entry.label, entry.labelAr].some((m) => key(m) && key(m) === key(n))));
      console.log(`merged captured sign "${entry.label}" into ${language}`);
    }
  }
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
  fs.writeFileSync(`${dir}/REFERENCES.md`, `# ${title}\n\n${notes}\n\n` +
    specs.map((s) => `- **${s.label}**${s.labelAr ? ` (${s.labelAr})` : ""}: ${s.note} Reference: ${review(s).source}`).join("\n") + "\n" +
    (pending.length ? `\n## Planned, not yet signed (no reviewed sign exists — nothing is guessed)\n\n` + pending.map((e) => `- ${e.label}${e.labelAr ? ` (${e.labelAr})` : ""}${e.note ? ` — ${e.note}` : ""}`).join("\n") + "\n" : ""));
  return catalog;
}
