import {
  normalize,
  resolveInput,
  type Catalog,
  type Resolution,
} from "./pipeline";
export const demoPhrases = [
  "Hi",
  "Hello",
  "Good morning",
  "Thank you",
  "I love you",
  "Bye",
  "Yes",
  "No",
] as const;
export const unsupportedDemoMessage =
  "Please choose one of the demo phrases: Hi, Hello, Good morning, Thank you, I love you, Bye, Yes, or No.";
export function matchDemoPhrase(input: string) {
  const normalized = normalize(input)
    .replace(/[\p{P}\s]+$/gu, "")
    .trim();
  return demoPhrases.find((phrase) => normalize(phrase) === normalized);
}
export function resolveDemoInput(input: string, catalog: Catalog): Resolution {
  const phrase = matchDemoPhrase(input);
  if (!phrase)
    return { ok: false, error: unsupportedDemoMessage, unsupported: [] };
  const result = resolveInput(phrase, catalog, "phrases");
  if (!result.ok) return result;
  // Refuse a pack which substitutes the identical motion sequence for another phrase.
  const signature = result.plan.signs
    .map((sign) => `${sign.url}#${sign.animationName || ""}`)
    .join("|");
  const duplicate = demoPhrases
    .filter((other) => other !== phrase)
    .some((other) => {
      const candidate = resolveInput(other, catalog, "phrases");
      return (
        candidate.ok &&
        candidate.plan.signs
          .map((sign) => `${sign.url}#${sign.animationName || ""}`)
          .join("|") === signature
      );
    });
  if (duplicate)
    return {
      ok: false,
      error:
        "This demo pack reuses the same animation for different phrases. Connect distinct reviewed phrase animations before playback.",
      unsupported: [],
    };
  return { ok: true, plan: { ...result.plan, text: input } };
}
