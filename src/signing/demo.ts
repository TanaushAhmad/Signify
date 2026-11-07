import { resolveInput, type Catalog, type Resolution } from "./pipeline";

/** Shared entry point for typed text and final speech transcripts. */
export function resolveDemoInput(input: string, catalog: Catalog): Resolution {
  return resolveInput(input, catalog, "vocabulary");
}
