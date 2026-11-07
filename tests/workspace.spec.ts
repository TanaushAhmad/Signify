/* Non-null assertions follow explicit fixture/rig validation in these tests. */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import assert from "node:assert/strict";
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import * as THREE from "three";
import { normalize, validateCatalog } from "../src/signing/pipeline";
import { resolveDemoInput } from "../src/signing/demo";
import { SequencePlayer, loadMotion } from "../src/signing/motion";
import { createNeutralAvatar, disposeAvatar } from "../src/signing/neutralAvatar";
import { signingJoints, validateRig } from "../src/signing/rig";
import limits from "../src/signing/rigConfig.json" with { type: "json" };
const catalog = validateCatalog(JSON.parse(fs.readFileSync("public/signing/catalog.json", "utf8")));
const clipFor = (id: string) => THREE.AnimationClip.parse(JSON.parse(fs.readFileSync("public" + catalog.signs.find(s => s.id === id)!.url, "utf8")));

test("dictionary normalizes every label and alias, prioritizes phrases and blocks unknown tokens", () => {
  expect(catalog.signs).toHaveLength(23);
  for (const sign of catalog.signs) for (const label of [sign.label, ...(sign.aliases || [])]) {
    const result = resolveDemoInput(`  ${label.toUpperCase().replaceAll(" ", "  ")}!? `, catalog);
    expect(result.ok).toBeTruthy();
    if (result.ok) expect(result.plan.signs.map(s => s.id)).toEqual([sign.id]);
  }
  const result = resolveDemoInput("HELLO, please; help. Thank you! Good morning", catalog);
  expect(result.ok).toBeTruthy();
  if (result.ok) {
    expect(result.plan.signs.map(s => s.id)).toEqual(["hello", "please", "help", "thank-you", "good-morning"]);
    expect(result.plan.transitionSeconds).toBeGreaterThan(0);
  }
  expect(resolveDemoInput("water spaceship please", catalog)).toMatchObject({ ok: false, unsupported: ["spaceship"] });
  for (const text of ["", "...", "🙂", "a".repeat(501), "you're welcome", "Alice"])
    expect(resolveDemoInput(text, catalog).ok).toBeFalsy();
  expect(normalize("Good-morning!")).toBe("good morning");
  expect(() => validateCatalog({ ...catalog, signs: catalog.signs.map((s, i) => i === 1 ? { ...s, url: catalog.signs[0].url } : s) })).toThrow(/reuse/);
});

test("bilateral rig hierarchy, distinct motions, actual independent articulation and joint limits", () => {
  const root = createNeutralAvatar();
  validateRig(root);
  const joints = signingJoints.map(name => root.getObjectByName(name)!);
  const initial = new Map(joints.map(j => [j.name, j.quaternion.clone()]));
  const moved = new Set<string>();
  const signatures = new Set<string>();
  for (const side of limits.sides) {
    const direction = side === "Left" ? 1 : -1;
    expect(root.getObjectByName(`${side}Index1`)!.position.x * direction).toBeLessThan(0);
    for (const f of limits.fingers) for (let j = 2; j <= 3; j++)
      expect(root.getObjectByName(`${side}${f}${j}`)!.parent!.name).toBe(`${side}${f}${j - 1}`);
  }
  for (const sign of catalog.signs) {
    const clip = clipFor(sign.id);
    expect(clip.validate()).toBeTruthy();
    signatures.add(JSON.stringify(clip.tracks));
    for (const name of signingJoints) expect(clip.tracks.some(t => t.name === `${name}.quaternion`)).toBeTruthy();
    const player = new SequencePlayer(root, [clip], 0.25);
    let leftMoved = false;
    for (let t = 0; t <= clip.duration; t += 0.1) {
      player.seek(t);
      for (const joint of joints) {
        assert(Math.abs(joint.quaternion.length() - 1) < 0.0001);
        if (joint.quaternion.angleTo(initial.get(joint.name)!) > 0.01) {
          moved.add(joint.name);
          if (joint.name.startsWith("Left")) leftMoved = true;
        }
        const match = joint.name.match(/(Index|Middle|Ring|Little)([123])$/);
        if (match) {
          assert(joint.rotation.x >= -1e-6);
          assert(joint.rotation.x <= limits.fingerFlexion[+match[2] - 1] + 1e-6);
        }
        if (joint.name.endsWith("Hand")) for (const [i, axis] of ["x", "y", "z"].entries())
          assert(Math.abs(joint.rotation[axis as "x" | "y" | "z"]) <= limits.wristLimits[i] + 1e-6);
      }
    }
    expect(leftMoved).toBe(sign.hands === "both");
    player.seek(0);
    for (const joint of joints) expect(joint.quaternion.angleTo(initial.get(joint.name)!)).toBeLessThan(0.001);
    player.dispose();
  }
  expect(signatures.size).toBe(catalog.signs.length);
  expect([...moved].sort()).toEqual([...signingJoints].sort());
  // A single DIP track must move that segment without changing its ancestor or the other hand.
  const distal = root.getObjectByName("LeftIndex3")!;
  const parent = root.getObjectByName("LeftIndex2")!.quaternion.clone();
  const right = root.getObjectByName("RightIndex3")!.quaternion.clone();
  const isolated = new THREE.AnimationClip("independent", 1, [new THREE.QuaternionKeyframeTrack("LeftIndex3.quaternion", [0, 1], [0, 0, 0, 1, ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.8, 0, 0)).toArray()])]);
  const player = new SequencePlayer(root, [isolated], 0);
  player.seek(1);
  expect(distal.rotation.x).toBeCloseTo(0.8, 4);
  expect(root.getObjectByName("LeftIndex2")!.quaternion.angleTo(parent)).toBeLessThan(0.001);
  expect(root.getObjectByName("RightIndex3")!.quaternion.angleTo(right)).toBeLessThan(0.001);
  player.dispose();
  disposeAvatar(root);
});

test("sequence timing, transitions, repeat signs, pause and replay are deterministic", () => {
  const root = createNeutralAvatar();
  const clips = [clipFor("help"), clipFor("water"), clipFor("help")];
  const player = new SequencePlayer(root, clips, 0.25);
  expect(player.duration).toBeCloseTo(clips.reduce((n, c) => n + c.duration, 0) + 0.5);
  expect(player.seek(clips[0].duration + 0.125).inTransition).toBeTruthy();
  expect(player.seek(player.starts[1] + 1).index).toBe(1);
  const pose = root.getObjectByName("RightHand")!.quaternion.clone();
  player.seek(player.starts[1] + 1);
  expect(root.getObjectByName("RightHand")!.quaternion.angleTo(pose)).toBeLessThan(0.001);
  expect(player.seek(player.duration).ended).toBeTruthy();
  expect(player.seek(0).index).toBe(0);
  player.dispose(); disposeAvatar(root);
});

test("motion loader rejects missing bones and incomplete mappings", async () => {
  const root = createNeutralAvatar();
  const originalFetch = globalThis.fetch;
  const asset = catalog.signs.find(s => s.id === "help")!;
  try {
    globalThis.fetch = async () => new Response(fs.readFileSync("public" + asset.url, "utf8"));
    const node = root.getObjectByName("LeftThumb3")!;
    node.parent!.remove(node);
    await expect(loadMotion(asset, root, new AbortController().signal)).rejects.toThrow(/missing joint/);
    root.add(node);
    const clip = THREE.AnimationClip.toJSON(clipFor("help"));
    clip.tracks = clip.tracks.filter(t => t.name !== "LeftThumb3.quaternion");
    globalThis.fetch = async () => new Response(JSON.stringify(clip));
    await expect(loadMotion(asset, root, new AbortController().signal)).rejects.toThrow(/Incomplete animation mapping/);
  } finally { globalThis.fetch = originalFetch; disposeAvatar(root); }
});

for (const label of ["Please", "Help", "Water", "Family", "School", "Good morning", "No", "I love you"])
  test(`browser playback: ${label}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/conversation");
    await page.getByLabel("Your message / transcript").fill(label);
    await page.getByRole("button", { name: "Prepare signing", exact: true }).click();
    await expect(page.locator(".stage-status")).toHaveText("Ready to sign");
    await expect(page.locator(".caption > p").first()).toHaveText(label);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => Number(await page.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeGreaterThan(35);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(150);
    const progress = await page.getByRole("progressbar").getAttribute("aria-valuenow");
    await page.waitForTimeout(150);
    expect(await page.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(progress);
    await page.locator(".stage").screenshot({ path: `test-results/asl-${label.toLowerCase().replaceAll(" ", "-")}.png` });
    await page.getByLabel("Speed").selectOption("1.5");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator(".stage-status")).toHaveText("Sequence complete");
    await page.getByRole("button", { name: "Replay sign sequence" }).click();
    await expect(page.locator(".stage-status")).toHaveText("Playing sign sequence");
    expect(errors).toEqual([]);
  });

test("searchable suggestions, sequential captions, unsupported input and removed hashing", async ({ page }) => {
  await page.goto("/conversation");
  await page.getByLabel("Search supported vocabulary").fill("water");
  await expect(page.locator(".vocabulary-entry")).toHaveCount(1);
  await page.locator(".vocabulary-entry").getByRole("button", { name: "Water", exact: true }).click();
  await expect(page.getByLabel("Your message / transcript")).toHaveValue("Water");
  await page.getByLabel("Your message / transcript").fill("Hello, help. Thank you!");
  await page.getByRole("button", { name: "Prepare signing", exact: true }).click();
  await expect(page.locator(".stage-status")).toHaveText("Ready to sign");
  await page.getByLabel("Speed").selectOption("1.5");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".caption > p").first()).toHaveText("Help");
  await expect(page.locator(".caption > p").first()).toHaveText("Thank you");
  await expect(page.locator(".stage-status")).toHaveText("Sequence complete");
  await page.getByLabel("Your message / transcript").fill("water spaceship");
  await page.getByRole("button", { name: "Prepare signing", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Unsupported: spaceship");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await page.goto("/");
  await expect(page.getByText(/hashing/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bridging");
  await page.goto("/security");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

for (const scenario of ["success", "not-allowed", "no-speech", "empty", "unavailable", "start-failure"])
  test(`speech pipeline: ${scenario}`, async ({ page }) => {
    await page.addInitScript((scenario) => {
      class Recognition {
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          if (scenario === "start-failure") throw new Error("start failed");
          setTimeout(() => {
            if (scenario === "success") this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "  PLEASE, help! Thank you.  " } }] });
            else if (scenario !== "empty") this.onerror?.({ error: scenario });
            this.onend?.();
          }, 100);
        }
        stop() { this.onend?.(); }
        abort() { this.onend?.(); }
      }
      Object.defineProperty(window, "SpeechRecognition", { value: scenario === "unavailable" ? undefined : Recognition });
      Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined });
    }, scenario);
    await page.goto("/conversation");
    await page.getByRole("button", { name: "Start microphone" }).click();
    if (scenario === "success") {
      await expect(page.getByLabel("Your message / transcript")).toHaveValue("PLEASE, help! Thank you.");
      await expect(page.locator(".stage-status")).toHaveText("Ready to sign");
      await expect(page.locator(".caption > p").first()).toHaveText("Please");
      await expect(page.locator(".caption .eyebrow")).toContainText("1 / 3");
    } else {
      await expect(page.getByRole("alert")).toContainText(scenario === "not-allowed" ? "permission was denied" : scenario === "unavailable" ? "unavailable" : scenario === "start-failure" ? "could not start" : "No speech");
      await expect(page.getByLabel("Your message / transcript")).toBeEnabled();
      await page.getByLabel("Your message / transcript").fill("Help");
      await page.getByRole("button", { name: "Prepare signing", exact: true }).click();
      await expect(page.locator(".stage-status")).toHaveText("Ready to sign");
    }
  });

test("mobile layout and missing animation errors", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/signing/asl-demo/no.json", route => route.fulfill({ status: 404, body: "" }));
  await page.goto("/conversation");
  await page.getByRole("group", { name: "Demo phrases" }).getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Prepare signing", exact: true }).click();
  await expect(page.locator(".stage-status")).toContainText("Animation unavailable");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "test-results/conversation-mobile.png", fullPage: true });
});
