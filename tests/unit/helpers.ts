/* eslint-disable @typescript-eslint/no-non-null-assertion */
import fs from "node:fs";
import * as THREE from "three";
import { validateCatalog, type Catalog } from "../../src/signing/pipeline";

export const aslCatalog: Catalog = validateCatalog(JSON.parse(fs.readFileSync("public/signing/catalog.json", "utf8")));
export const eslCatalog: Catalog = validateCatalog(JSON.parse(fs.readFileSync("public/signing/esl/catalog.json", "utf8")));
export const clipOf = (catalog: Catalog, id: string) =>
  THREE.AnimationClip.parse(JSON.parse(fs.readFileSync("public" + catalog.signs.find((s) => s.id === id)!.url, "utf8")));
