export interface Review {
  source: string;
  validation?: "reference-demo" | "validated";
  license: string;
  reviewedBy: string;
  reviewedOn: string;
}
export interface SignAsset extends Review {
  id: string;
  label: string;
  kind: "sign" | "fingerspelling";
  rigId: string;
  url: string;
  animationName?: string;
  cues: { start: number; caption: string }[];
}
export interface Phrase extends Review {
  text: string;
  signIds: string[];
  transitionSeconds: number;
}
export interface Catalog {
  version: 1;
  language: string | null;
  rig: { id: string; url: string | null };
  signs: SignAsset[];
  phrases: Phrase[];
}
export interface Plan {
  text: string;
  language: string;
  signs: SignAsset[];
  transitionSeconds: number;
  mode: "phrases" | "vocabulary";
}
export type Resolution =
  | { ok: true; plan: Plan }
  | { ok: false; error: string; unsupported: string[] };
export const normalize = (s: string) =>
  s.trim().replace(/\s+/g, " ").toLowerCase();
function hasProvenance(value: Review) {
  if (value.validation === "reference-demo")
    return Boolean(value.source?.trim() && value.license?.trim());
  if (value.validation !== undefined && value.validation !== "validated")
    return false;
  return (["source", "license", "reviewedBy", "reviewedOn"] as const).every(
    (key) =>
      typeof value[key] === "string" && value[key].trim(),
  );
}
export function validateCatalog(value: unknown): Catalog {
  const c = value as Catalog;
  if (
    !c ||
    c.version !== 1 ||
    (c.language !== null &&
      (typeof c.language !== "string" || !c.language.trim())) ||
    !c.rig?.id ||
    !(c.rig.url === null || typeof c.rig.url === "string") ||
    !Array.isArray(c.signs) ||
    !Array.isArray(c.phrases)
  )
    throw new Error(
      "Invalid signing catalog. Check its version, language, rig, signs, and phrases.",
    );
  const ids = new Set<string>();
  for (const s of c.signs) {
    if (
      !c.language ||
      !s.id ||
      ids.has(s.id) ||
      !s.label?.trim() ||
      !["sign", "fingerspelling"].includes(s.kind) ||
      s.rigId !== c.rig.id ||
      !s.url ||
      !hasProvenance(s) ||
      !Array.isArray(s.cues) ||
      s.cues.some(
        (cue, i) =>
          !Number.isFinite(cue.start) ||
          cue.start < 0 ||
          !cue.caption ||
          (i > 0 && cue.start < s.cues[i - 1].start),
      )
    )
      throw new Error(
        "Unreviewed, duplicate, or incompatible signing asset in catalog.",
      );
    ids.add(s.id);
  }
  const phrases = new Set<string>();
  for (const p of c.phrases) {
    if (
      !p.text?.trim() ||
      phrases.has(normalize(p.text)) ||
      !hasProvenance(p) ||
      !Array.isArray(p.signIds) ||
      !p.signIds.length ||
      p.signIds.some((id) => !ids.has(id)) ||
      !Number.isFinite(p.transitionSeconds) ||
      p.transitionSeconds < 0 ||
      p.transitionSeconds > 1
    )
      throw new Error("Invalid phrase plan or missing sign reference.");
    phrases.add(normalize(p.text));
  }
  return c;
}
export function resolveInput(
  text: string,
  catalog: Catalog,
  mode: Plan["mode"],
): Resolution {
  const fail = (error: string, unsupported: string[] = []): Resolution => ({
    ok: false,
    error,
    unsupported,
  });
  if (!text.trim()) return fail("Type a message or use the microphone first.");
  if (text.length > 500)
    return fail(
      "Your message exceeds 500 characters. Shorten it before preparing signing.",
    );
  if (!catalog.language)
    return fail(
      "Choose and confirm a target sign language before connecting a signing pack. No signing language is established in this project.",
    );
  if (!catalog.signs.length)
    return fail(
      `No reviewed ${catalog.language} animations are installed. Your input was received, but the avatar cannot sign it yet.`,
    );
  const phrase = catalog.phrases.find(
    (p) => normalize(p.text) === normalize(text),
  );
  if (mode === "phrases") {
    if (!phrase)
      return fail(
        "No reviewed phrase sequence matches this input. Try a supported phrase or explicitly choose vocabulary practice.",
        [text.trim()],
      );
    return {
      ok: true,
      plan: {
        text,
        language: catalog.language,
        signs: phrase.signIds.map(
          (id) => catalog.signs.find((s) => s.id === id) as SignAsset,
        ),
        transitionSeconds: phrase.transitionSeconds,
        mode,
      },
    };
  }
  // Vocabulary demonstration only; never presented as sentence translation.
  const words = normalize(text).split(/\s+/);
  const dictionary = catalog.signs
    .filter((s) => s.kind === "sign")
    .map((sign) => ({ sign, words: normalize(sign.label).split(" ") }))
    .sort((a, b) => b.words.length - a.words.length);
  const signs: SignAsset[] = [],
    unsupported: string[] = [];
  for (let i = 0; i < words.length;) {
    const match = dictionary.find((entry) =>
      entry.words.every((word, offset) => words[i + offset] === word),
    );
    if (match) {
      signs.push(match.sign);
      i += match.words.length;
    } else {
      unsupported.push(words[i]);
      i++;
    }
  }
  if (unsupported.length)
    return fail(
      "Unsupported vocabulary. Nothing will play; unknown words are not skipped or replaced.",
      unsupported,
    );
  return {
    ok: true,
    plan: {
      text,
      language: catalog.language,
      signs,
      transitionSeconds: 0,
      mode,
    },
  };
}
export async function loadCatalog(signal: AbortSignal) {
  const response = await fetch("/signing/catalog.json", { signal });
  if (!response.ok)
    throw new Error("Signing catalog could not load. Please retry.");
  return validateCatalog(await response.json());
}
