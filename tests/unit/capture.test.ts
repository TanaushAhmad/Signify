/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { execSync } from "node:child_process";
import fs from "node:fs";
import { afterAll, expect, test } from "vitest";
import * as THREE from "three";
import { createNeutralAvatar } from "../../src/signing/neutralAvatar";
import { loadMotion } from "../../src/signing/motion";
import { validateCatalog } from "../../src/signing/pipeline";
import { clipFromFrames } from "../../src/signing/recognition/retarget";
import { framesFromClip } from "../../src/signing/recognition/synth";
import { aslCatalog, clipOf } from "./helpers";

const FILE = "captures/ESL/hospital-test.capture.json";
const rebuild = () => execSync("node scripts/build-demo-assets.mjs", { stdio: "pipe" });
afterAll(() => { fs.rmSync(FILE, { force: true }); rebuild(); });

test("a captured sign is merged into the ESL catalog, removed from pending, and plays on the rig", async () => {
  const result = clipFromFrames(framesFromClip(clipOf(aslCatalog, "thank-you")), "esl-hospital")!;
  const entry = { id: "hospital-test", label: "Hospital", labelAr: "مستشفى", aliases: ["مستشفى"], description: "test", hands: result.hands, kind: "sign",
    rigId: "signify-neutral-v1", url: "", motion: result.motion, cues: [{ start: 0, caption: "Hospital" }],
    source: "test", license: "test", validation: "draft", reviewedBy: "", reviewedOn: "" };
  fs.writeFileSync(FILE, JSON.stringify({ entry, clip: THREE.AnimationClip.toJSON(result.clip) }));
  rebuild();
  const catalog = validateCatalog(JSON.parse(fs.readFileSync("public/signing/esl/catalog.json", "utf8")));
  const sign = catalog.signs.find((s) => s.id === "hospital-test")!;
  expect(sign.validation).toBe("draft");
  expect(catalog.pending!.some((p) => p.label === "Hospital")).toBe(false);
  const root = createNeutralAvatar();
  const real = globalThis.fetch;
  globalThis.fetch = (async (u: string) => new Response(fs.readFileSync("public" + u, "utf8"))) as typeof fetch;
  try { await expect(loadMotion(sign, root, new AbortController().signal)).resolves.toBeTruthy(); } finally { globalThis.fetch = real; }
});
