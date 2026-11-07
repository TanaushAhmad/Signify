import * as THREE from "three";
import config from "./rigConfig.json" with { type: "json" };

export const signingJoints = config.sides.flatMap(side => [
  `${side}Shoulder`, `${side}UpperArm`, `${side}Forearm`, `${side}Hand`,
  ...config.fingers.flatMap(f => [1, 2, 3].map(j => `${side}${f}${j}`)),
]);

/** Validate the built-in rig contract, including every independently addressable joint. */
export function validateRig(root: THREE.Object3D) {
  const missing = signingJoints.filter(name => !(root.getObjectByName(name) instanceof THREE.Bone));
  if (missing.length) throw new Error(`Incomplete signing rig: ${missing.join(", ")}`);
}

/** Keep interpolation inside the same conservative ranges used by the authoring tools. */
export function constrainHands(root: THREE.Object3D) {
  for (const side of config.sides) {
    for (const finger of config.fingers) {
      for (let j = 1; j <= 3; j++) {
        const bone = root.getObjectByName(`${side}${finger}${j}`);
        if (!bone) continue;
        const e = bone.rotation;
        if (finger === "Thumb") {
          const limits = config.thumbLimits[j - 1];
          e.set(THREE.MathUtils.clamp(e.x, limits[0], limits[1]),
            THREE.MathUtils.clamp(e.y, limits[2], limits[3]),
            THREE.MathUtils.clamp(e.z, limits[4], limits[5]));
        } else {
          e.set(THREE.MathUtils.clamp(e.x, 0, config.fingerFlexion[j - 1]), 0,
            j === 1 ? THREE.MathUtils.clamp(e.z, -config.fingerSpread, config.fingerSpread) : 0);
        }
      }
    }
    const wrist = root.getObjectByName(`${side}Hand`);
    if (wrist) {
      const e = wrist.rotation, [x, y, z] = config.wristLimits;
      e.set(THREE.MathUtils.clamp(e.x, -x, x), THREE.MathUtils.clamp(e.y, -y, y), THREE.MathUtils.clamp(e.z, -z, z));
    }
  }
}
