import { test, expect } from "@playwright/test";
import fs from "node:fs";
import * as THREE from "three";
import { validateCatalog } from "../src/signing/pipeline";
import {
  demoPhrases,
  matchDemoPhrase,
  resolveDemoInput,
  unsupportedDemoMessage,
} from "../src/signing/demo";
import { SequencePlayer } from "../src/signing/motion";
import {
  createNeutralAvatar,
  disposeAvatar,
} from "../src/signing/neutralAvatar";
const catalog = validateCatalog(
  JSON.parse(fs.readFileSync("public/signing/catalog.json", "utf8")),
);

test("five production phrases normalize consistently and have distinct animation tracks", () => {
  const signatures = new Set<string>();
  for (const phrase of demoPhrases) {
    const input = `  ${phrase.toUpperCase().replaceAll(" ", "   ")}...!?  `;
    expect(matchDemoPhrase(input)).toBe(phrase);
    const result = resolveDemoInput(input, catalog);
    expect(result.ok).toBeTruthy();
    if (!result.ok) throw Error(result.error);
    const clip = JSON.parse(
      fs.readFileSync("public" + result.plan.signs[0].url, "utf8"),
    );
    expect(clip.tracks.length).toBeGreaterThan(10);
    signatures.add(JSON.stringify(clip.tracks));
    expect(result.plan.text).toBe(input);
  }
  expect(signatures.size).toBe(5);
  for (const input of [
    "hello",
    "Hi there",
    "Yes and No",
    "thanks",
    "",
    "I love you tomorrow",
  ])
    expect(resolveDemoInput(input, catalog)).toMatchObject({
      ok: false,
      error: unsupportedDemoMessage,
    });
  const duplicate = {
    ...catalog,
    signs: catalog.signs.map((sign, i) =>
      i === 1 ? { ...sign, url: catalog.signs[0].url } : sign,
    ),
  };
  expect(resolveDemoInput("Thank you", duplicate).ok).toBeFalsy();
});

test("actual clips move different joints and reset the existing rig", () => {
  const root = createNeutralAvatar();
  const poses = new Set<string>();
  function joint(name: string) {
    const node = root.getObjectByName(name);
    if (!node) throw new Error(`Missing joint: ${name}`);
    return node;
  }
  for (const sign of catalog.signs) {
    const clip = THREE.AnimationClip.parse(
      JSON.parse(fs.readFileSync("public" + sign.url, "utf8")),
    );
    const player = new SequencePlayer(root, [clip], 0);
    player.seek(1.25);
    poses.add(
      ["RightHand", "RightIndex1", "RightRing1", "RightThumb1"]
        .map((name) =>
          joint(name)
            .quaternion.toArray()
            .map((v) => v.toFixed(3))
            .join(","),
        )
        .join("|"),
    );
    const frozen = joint("RightHand").quaternion.clone();
    player.seek(1.25);
    expect(
      joint("RightHand").quaternion.angleTo(frozen),
    ).toBeLessThan(0.001);
    expect(player.seek(clip.duration).ended).toBeTruthy();
    player.seek(0);
    expect(
      joint("RightHand")
        .quaternion.angleTo(new THREE.Quaternion()),
    ).toBeLessThan(0.001);
    player.dispose();
  }
  expect(poses.size).toBe(5);
  disposeAvatar(root);
});

for (const phrase of demoPhrases)
  test(`${phrase}: phrase button, typed variant, caption and actual avatar playback`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/conversation");
    await page
      .getByRole("group", { name: "Demo phrases" })
      .getByRole("button", { name: phrase, exact: true })
      .click();
    await expect(page.getByLabel("Your message / transcript")).toHaveValue(
      phrase,
    );
    await page
      .getByLabel("Your message / transcript")
      .fill(` ${phrase.toUpperCase().replaceAll(" ", "  ")}! `);
    await page
      .getByRole("button", { name: "Prepare signing", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Ready to sign");
    await expect(page.locator(".caption > p").first()).toHaveText(phrase);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect
      .poll(async () =>
        Number(
          await page.getByRole("progressbar").getAttribute("aria-valuenow"),
        ),
      )
      .toBeGreaterThan(33);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(150);
    const progress = await page
      .getByRole("progressbar")
      .getAttribute("aria-valuenow");
    await page.waitForTimeout(250);
    expect(
      await page.getByRole("progressbar").getAttribute("aria-valuenow"),
    ).toBe(progress);
    await page
      .locator(".stage")
      .screenshot({
        path: `test-results/asl-${phrase.toLowerCase().replaceAll(" ", "-")}.png`,
      });
    await page.getByLabel("Speed").selectOption("1.5");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Sequence complete");
    await page.getByRole("button", { name: "Replay sign sequence" }).click();
    await expect(page.getByRole("status")).toHaveText("Playing sign sequence");
    expect(
      Number(await page.getByRole("progressbar").getAttribute("aria-valuenow")),
    ).toBeLessThan(30);
    expect(errors).toEqual([]);
  });

test("unsupported input has the exact prompt and no mode selector", async ({
  page,
}) => {
  await page.goto("/conversation");
  await expect(
    page.getByPlaceholder("Try: Hi, Thank you, I love you, Yes, or No"),
  ).toBeVisible();
  await expect(page.getByLabel("Signing mode", { exact: true })).toHaveCount(0);
  await page.getByLabel("Your message / transcript").fill("Something else");
  await page
    .getByRole("button", { name: "Prepare signing", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(unsupportedDemoMessage);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
});

test("microphone transcripts use the same case/space/punctuation matching", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class MockRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        setTimeout(() => {
          this.onresult?.({
            resultIndex: 0,
            results: [
              { isFinal: true, 0: { transcript: "  THANK   YOU!!!  " } },
            ],
          });
          this.onend?.();
        }, 50);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend = null;
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: MockRecognition,
    });
  });
  await page.goto("/conversation");
  await page.getByRole("button", { name: "Start microphone" }).click();
  await expect(page.getByRole("status")).toHaveText("Ready to sign");
  await expect(page.locator(".caption > p").first()).toHaveText("Thank you");
});

test("video upload and camera return and speak only the fixed Thank you sample", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const words: string[] = [];
    Object.defineProperty(window, "__spoken", { value: words });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        cancel() {
          return undefined;
        },
        speak(utterance: { text: string }) {
          words.push(utterance.text);
        },
      },
    });
    const tracks: MediaStreamTrack[] = [];
    Object.defineProperty(window, "__cameraTracks", { value: tracks });
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      canvas.getContext("2d")?.fillRect(0, 0, 320, 240);
      const stream = canvas.captureStream(10);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto("/conversation");
  await page.getByRole("button", { name: /Video to Speech/ }).click();
  await expect(
    page.getByText("Demo mode — fixed sample output", { exact: true }),
  ).toBeVisible();
  for (const name of ["unrelated-one.webm", "unrelated-two.webm"]) {
    await page
      .getByLabel("Upload video", { exact: true })
      .setInputFiles({
        name,
        mimeType: "video/webm",
        buffer: Buffer.from("non-signing test file"),
      });
    await page
      .getByRole("button", { name: "Convert video — simulated demo" })
      .click();
    await expect(page.locator(".sample-result")).toHaveText("Thank you");
  }
  await page.getByRole("button", { name: "Turn camera on" }).click();
  await expect(
    page.getByRole("button", { name: "Convert video — simulated demo" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Convert video — simulated demo" })
    .click();
  await expect(page.locator(".sample-result")).toHaveText("Thank you");
  expect(await page.evaluate(() => Reflect.get(window, "__spoken"))).toEqual([
    "Thank you",
    "Thank you",
    "Thank you",
  ]);
  await page.getByRole("button", { name: "Turn camera off" }).click();
  expect(
    await page.evaluate(() =>
      Reflect.get(window, "__cameraTracks").every(
        (track: MediaStreamTrack) => track.readyState === "ended",
      ),
    ),
  ).toBeTruthy();
});

test("mobile layout, missing animation error, and original home presentation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/signing/asl-demo/no.json", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto("/conversation");
  await page
    .getByRole("group", { name: "Demo phrases" })
    .getByRole("button", { name: "No", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare signing", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Animation unavailable");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/conversation-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Bridging",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
});
