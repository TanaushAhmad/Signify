/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "vitest";
import { createNeutralAvatar, disposeAvatar } from "../../src/signing/neutralAvatar";
import { SequencePlayer } from "../../src/signing/motion";
import { normalize } from "../../src/signing/pipeline";
import { resolveDemoInput } from "../../src/signing/demo";
import { aslCatalog, eslCatalog, clipOf } from "./helpers";

describe("Emirati Sign Language catalog and Arabic input", () => {
  test("Arabic spelling variants normalise to the same key", () => {
    expect(normalize("أهلاً وسهلاً")).toBe(normalize("اهلا وسهلا"));
    expect(normalize("قهوة")).toBe(normalize("قهوه"));
    expect(normalize("دبي،")).toBe("دبي");
  });
  test("every sign is marked draft and has a citable source", () => {
    for (const s of eslCatalog.signs) { expect(s.validation).toBe("draft"); expect(s.source).toMatch(/^https:\/\//); expect(s.reviewedBy).toBe(""); }
  });
  test("Arabic, English and mixed input resolve to the same signs", () => {
    const ids = (t: string) => { const r = resolveDemoInput(t, eslCatalog); return r.ok ? r.plan.signs.map((s) => s.id) : r; };
    expect(ids("قهوة")).toEqual(["coffee"]);
    expect(ids("Coffee, Dubai!")).toEqual(["coffee", "dubai"]);
    expect(ids("قهوةٌ ثم دبي".replace("ثم", ""))).toEqual(["coffee", "dubai"]);
  });
  test("the five signs taken from the ESL Zayed videos resolve in English, Arabic and common spellings", () => {
    const ids = (t: string) => { const r = resolveDemoInput(t, eslCatalog); return r.ok ? r.plan.signs.map((s) => s.id) : r; };
    expect(ids("Assalamualaikum")).toEqual(["salaam-alaikum"]);
    expect(ids("assalmualikum")).toEqual(["salaam-alaikum"]);
    expect(ids("السلام عليكم")).toEqual(["salaam-alaikum"]);
    expect(ids("How are you?")).toEqual(["how-are-you"]);
    expect(ids("كيف حالك")).toEqual(["how-are-you"]);
    expect(ids("Fine")).toEqual(["fine"]);
    expect(ids("بخير")).toEqual(["fine"]);
    expect(ids("Thank you")).toEqual(["thank-you"]);
    expect(ids("شكرا")).toEqual(["thank-you"]);
    expect(ids("you're welcome")).toEqual(["you-are-welcome"]);
    expect(ids("Assalamualaikum, how are you? Fine, thank you")).toEqual(["salaam-alaikum", "how-are-you", "fine", "thank-you"]);
  });
  test("signed words are no longer listed as pending", () => {
    const pending = (eslCatalog.pending || []).map((p) => p.label);
    for (const label of ["Thank you", "Peace be upon you"]) expect(pending).not.toContain(label);
  });
  test("planned-but-uncaptured words are reported, never signed or skipped", () => {
    for (const text of ["شكرا جزيلا", "Hospital", "مستشفى", "coffee hospital"]) {
      const r = resolveDemoInput(text, eslCatalog);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Not signed yet/);
    }
    const unknown = resolveDemoInput("coffee spaceship", eslCatalog);
    expect(unknown).toMatchObject({ ok: false, unsupported: ["spaceship"] });
  });
  test("ASL catalog is untouched by the ESL pack", () => {
    expect(aslCatalog.signs).toHaveLength(23);
    expect(aslCatalog.pending).toBeUndefined();
  });
});

describe("fluent sign-to-sign playback", () => {
  const ids = ["hello", "water", "thank-you"];
  const clips = ids.map((id) => clipOf(aslCatalog, id));
  const windows = ids.map((id) => aslCatalog.signs.find((s) => s.id === id)!.motion);
  test("every ASL sign declares a motion window inside its clip", () => {
    for (const s of aslCatalog.signs) {
      const c = clipOf(aslCatalog, s.id);
      expect(s.motion!.start).toBeGreaterThan(0);
      expect(s.motion!.end).toBeLessThanOrEqual(c.duration);
      expect(s.motion!.end).toBeGreaterThan(s.motion!.start);
    }
  });
  test("trimmed sequence is shorter, ends at rest, and starts at rest", () => {
    const root = createNeutralAvatar();
    const plain = new SequencePlayer(root, clips, 0.35);
    const fluent = new SequencePlayer(root, clips, 0.35, windows);
    expect(fluent.duration).toBeLessThan(plain.duration - 1);
    const hand = root.getObjectByName("RightForearm")!;
    fluent.seek(0);
    const startAngle = hand.quaternion.angleTo(new (hand.quaternion.constructor as typeof import("three").Quaternion)());
    expect(startAngle).toBeLessThan(0.001);
    fluent.seek(fluent.duration);
    expect(hand.quaternion.angleTo(new (hand.quaternion.constructor as typeof import("three").Quaternion)())).toBeLessThan(0.001);
    // the middle sign must not pass through the rest pose between words
    const mid = fluent.starts[1];
    fluent.seek(mid - 0.05);
    expect(hand.quaternion.angleTo(new (hand.quaternion.constructor as typeof import("three").Quaternion)())).toBeGreaterThan(0.3);
    plain.dispose(); fluent.dispose(); disposeAvatar(root);
  });
});
