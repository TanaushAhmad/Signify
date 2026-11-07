export interface Review {
  source: string;
  /** `draft`: authored from published descriptions only; needs review by a Deaf signer of that language. */
  validation?: "reference-demo" | "draft" | "validated";
  license: string;
  reviewedBy: string;
  reviewedOn: string;
}
export interface SignAsset extends Review {
  aliases?: string[];
  description?: string;
  hands?: "right" | "both";
  /** Arabic display label (also accepted as an alias for input matching). */
  labelAr?: string;
  /** Part of the clip that carries the sign; lets neighbouring signs blend without returning to rest. */
  motion?: { start: number; end: number };
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
/** A word we know belongs in the vocabulary but for which no reviewed sign exists yet. */
export interface PendingEntry {
  label: string;
  labelAr?: string;
  aliases?: string[];
  note?: string;
}
export interface Catalog {
  version: 1;
  language: string | null;
  rig: { id: string; url: string | null };
  signs: SignAsset[];
  phrases: Phrase[];
  pending?: PendingEntry[];
}
export interface LanguageInfo {
  code: "ASL" | "ESL";
  name: string;
  nativeName: string;
  region: string;
  catalogUrl: string;
  /** BCP-47 tag handed to browser speech recognition. */
  speechLang: string;
  rtl: boolean;
  placeholder: string;
}
export const LANGUAGES: LanguageInfo[] = [
  { code: "ASL", name: "American Sign Language", nativeName: "American Sign Language", region: "United States", catalogUrl: "/signing/catalog.json", speechLang: "en-US", rtl: false, placeholder: "Try: Hello, Please, Help, Water, or Thank you" },
  { code: "ESL", name: "Emirati Sign Language", nativeName: "لغة الإشارة الإماراتية", region: "United Arab Emirates", catalogUrl: "/signing/esl/catalog.json", speechLang: "ar-AE", rtl: true, placeholder: "جرّب: قهوة، دبي — or Coffee, Dubai" },
];
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
/** Arabic: drop diacritics/tatweel and unify letter variants so أهلاً / اهلا / أهلا all match. */
const arabic = (s: string) =>
  s.replace(/[\u064B-\u065F\u0670\u0640]/gu, "")
    .replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي").replace(/ة/gu, "ه").replace(/ؤ/gu, "و").replace(/ئ/gu, "ي");
export const normalize = (s: string) =>
  arabic(s.normalize("NFKC").toLowerCase()).replace(/[’']/gu, "")
    .replace(/\p{P}/gu, " ").trim().replace(/\s+/g, " ");
function hasProvenance(value: Review) {
  if (value.validation === "reference-demo" || value.validation === "draft")
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
  const labels = new Set<string>();
  const motions = new Set<string>();
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
    const motion = `${s.url}#${s.animationName || ""}`;
    if (motions.has(motion)) throw new Error("Different signs cannot reuse the same animation; use aliases for synonyms.");
    motions.add(motion);
    if (s.aliases !== undefined && (!Array.isArray(s.aliases) || s.aliases.some(a => typeof a !== "string" || !normalize(a))))
      throw new Error("Invalid sign aliases.");
    for (const label of [s.label, ...(s.aliases || [])]) {
      const key = normalize(label);
      if (!key || labels.has(key)) throw new Error("Ambiguous sign dictionary label or alias.");
      labels.add(key);
    }
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
  if (!normalize(text)) return fail("Type a message or use the microphone first.");
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
  const byId = new Map(catalog.signs.map(sign => [sign.id, sign]));
  const dictionary = [
    ...catalog.phrases.map(p => ({ signs: p.signIds.map(id => {
      const sign = byId.get(id);
      if (!sign) throw new Error(`Missing sign mapping: ${id}`);
      return sign;
    }), words: normalize(p.text).split(" ") })),
    ...catalog.signs.filter(s => s.kind === "sign").flatMap(sign =>
      [sign.label, ...(sign.aliases || [])].map(label => ({ signs: [sign], words: normalize(label).split(" ") }))),
  ].sort((a, b) => b.words.length - a.words.length);
  const pendingEntries = (catalog.pending || []).flatMap((entry) =>
    [entry.label, entry.labelAr, ...(entry.aliases || [])].filter((l): l is string => Boolean(l && normalize(l)))
      .map((label) => ({ words: normalize(label).split(" "), label: entry.label })));
  pendingEntries.sort((a, b) => b.words.length - a.words.length);
  const signs: SignAsset[] = [],
    unsupported: string[] = [],
    awaiting: string[] = [];
  for (let i = 0; i < words.length;) {
    const match = dictionary.find((entry) =>
      entry.words.every((word, offset) => words[i + offset] === word),
    );
    const waiting = match ? undefined : pendingEntries.find((entry) =>
      entry.words.every((word, offset) => words[i + offset] === word));
    // A longer planned phrase ("Thank you very much") beats a shorter signed one ("Thank you").
    const longerPending = pendingEntries.find((entry) =>
      entry.words.length > (match?.words.length ?? 0) && entry.words.every((word, offset) => words[i + offset] === word));
    if (longerPending) {
      awaiting.push(longerPending.label);
      i += longerPending.words.length;
    } else if (match) {
      signs.push(...match.signs);
      i += match.words.length;
    } else if (waiting) {
      awaiting.push(waiting.label);
      i += waiting.words.length;
    } else {
      unsupported.push(words[i]);
      i++;
    }
  }
  if (awaiting.length)
    return fail(
      `Not signed yet: ${[...new Set(awaiting)].join(", ")} ${awaiting.length > 1 ? "are" : "is"} planned for ${catalog.language} but no reviewed sign has been captured. Nothing will play; the sign is not guessed.`,
      [...new Set([...awaiting, ...unsupported])],
    );
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
      transitionSeconds: 0.25,
      mode,
    },
  };
}
export async function loadCatalog(signal: AbortSignal, language: LanguageInfo["code"] = "ASL") {
  const info = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];
  const response = await fetch(info.catalogUrl, { signal });
  if (!response.ok)
    throw new Error("Signing catalog could not load. Please retry.");
  return validateCatalog(await response.json());
}
