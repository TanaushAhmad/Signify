/**
 * Forward kinematics helpers for authoring + verification.
 * Loads the real neutral avatar (TypeScript source, via Node type stripping) so contact
 * checks run against exactly the geometry the browser renders.
 */
import * as THREE from "three";
import { createNeutralAvatar } from "../../src/signing/neutralAvatar.ts";

export const avatar = createNeutralAvatar();
avatar.updateMatrixWorld(true);

export function applyPose(pose) {
  for (const [name, quat] of Object.entries(pose)) {
    const bone = avatar.getObjectByName(name);
    if (bone) bone.quaternion.copy(quat);
  }
  avatar.updateMatrixWorld(true);
}
export const worldOf = (name, local = new THREE.Vector3()) =>
  avatar.getObjectByName(name).localToWorld(local.clone());

/** Fingertip = end of the distal segment (segment 3 + its own length). */
const TIP_LENGTH = { Index: 0.033, Middle: 0.038, Ring: 0.035, Little: 0.028 };
export function tipOf(side, finger) {
  if (finger === "Thumb") return worldOf(`${side}Thumb3`, new THREE.Vector3(0, -0.03, 0));
  return worldOf(`${finger === "Index" ? side + "Index3" : side + finger + "3"}`, new THREE.Vector3(0, -TIP_LENGTH[finger], 0));
}
export const palmOf = (side) => worldOf(`${side}Hand`, new THREE.Vector3(0, -0.05, 0));
export const wristOf = (side) => worldOf(`${side}Hand`);

/** Named contact points on the avatar's body, measured from the rendered geometry. */
export function bodyAnchors() {
  applyPose({});
  const head = avatar.getObjectByName("Head");
  const jaw = avatar.getObjectByName("Jaw");
  const at = (obj, x, y, z) => obj.localToWorld(new THREE.Vector3(x, y, z));
  return {
    forehead: at(head, 0, 0.13, 0.125),
    templeRight: at(head, -0.1, 0.1, 0.1),
    eyeLevel: at(head, 0, 0.073, 0.14),
    nose: at(head, 0, 0.02, 0.165),
    mouth: at(jaw, 0, 0.023, 0.062),
    chin: at(head, 0, -0.14, 0.085),
    cheekRight: at(head, -0.1, -0.02, 0.1),
    chest: avatar.getObjectByName("Spine").localToWorld(new THREE.Vector3(0, 0.22, 0.2)),
    chestRight: avatar.getObjectByName("Spine").localToWorld(new THREE.Vector3(-0.1, 0.22, 0.2)),
  };
}
