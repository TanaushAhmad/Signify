/** Dump the posed avatar as world-space triangles (for offline software rendering in QA). */
import fs from "node:fs";
import * as THREE from "three";
import { avatar } from "./fk.mjs";
const [, , signId = "", time = "0", out = "/tmp/mesh.json", dir = "public/signing/asl-demo"] = process.argv;
if (signId) {
  const clip = THREE.AnimationClip.parse(JSON.parse(fs.readFileSync(`${dir}/${signId}.json`, "utf8")));
  const mixer = new THREE.AnimationMixer(avatar);
  mixer.clipAction(clip).play();
  mixer.setTime(Math.min(Number(time), clip.duration));
}
avatar.updateMatrixWorld(true);
const tris = [];
avatar.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return;
  const pos = o.geometry.attributes.position, idx = o.geometry.index;
  const color = "#" + o.material.color.getHexString();
  const v = (i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).toArray();
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
    tris.push([...v(a), ...v(b), ...v(c), color]);
  }
});
fs.writeFileSync(out, JSON.stringify(tris));
console.log(`${tris.length} triangles -> ${out}`);
