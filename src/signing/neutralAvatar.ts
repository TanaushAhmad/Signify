import * as THREE from "three";
/** Neutral presentation rig, not signing data. Every joint has a stable track name. */
export function createNeutralAvatar() {
  const root = new THREE.Group();
  root.name = "SignifyAvatar";
  const skin = new THREE.MeshStandardMaterial({
    color: "#bc8769",
    roughness: 0.78,
  });
  const shirt = new THREE.MeshStandardMaterial({
    color: "#57428c",
    roughness: 0.85,
  });
  const hair = new THREE.MeshStandardMaterial({
    color: "#241a26",
    roughness: 0.95,
  });
  const white = new THREE.MeshStandardMaterial({ color: "#f4ece4" });
  const iris = new THREE.MeshStandardMaterial({ color: "#242838" });
  function shape(
    parent: THREE.Object3D,
    name: string,
    position: number[],
    scale: number[],
    material: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 20), material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    parent.add(mesh);
    return mesh;
  }
  /** Rounded limb segment hanging down -Y from its bone origin; overlaps neighbours to hide joints. */
  function limb(
    parent: THREE.Object3D,
    name: string,
    top: number,
    bottom: number,
    radiusX: number,
    radiusZ: number,
    material: THREE.Material,
  ) {
    const length = Math.max(bottom - top - radiusX, 0.001);
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(1, length / radiusX, 6, 16),
      material,
    );
    mesh.name = name;
    mesh.scale.set(radiusX, radiusX, radiusZ);
    mesh.position.set(0, -(top + bottom) / 2 - radiusX * 0.1, 0);
    parent.add(mesh);
    return mesh;
  }
  function bone(
    parent: THREE.Object3D,
    name: string,
    x: number,
    y: number,
    z = 0,
  ) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent.add(b);
    return b;
  }
  const spine = bone(root, "Spine", 0, 0.92);
  const outline = new THREE.SplineCurve([
    new THREE.Vector2(0, -0.36),
    new THREE.Vector2(0.22, -0.36),
    new THREE.Vector2(0.25, -0.29),
    new THREE.Vector2(0.25, -0.08),
    new THREE.Vector2(0.29, 0.2),
    new THREE.Vector2(0.31, 0.32),
    new THREE.Vector2(0.24, 0.4),
    new THREE.Vector2(0.095, 0.45),
  ])
    .getPoints(48)
    .map((point) => new THREE.Vector2(Math.max(0, point.x), point.y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(outline, 48), shirt);
  torso.name = "Torso";
  torso.scale.z = 0.55;
  spine.add(torso);
  const neck = bone(spine, "Neck", 0, 0.52);
  shape(neck, "NeckSkin", [0, 0.015, 0], [0.086, 0.13, 0.08], skin);
  const head = bone(neck, "Head", 0, 0.19);
  shape(head, "HeadSkin", [0, 0.05, 0], [0.157, 0.219, 0.145], skin);
  shape(head, "Hair", [0, 0.165, -0.03], [0.162, 0.13, 0.142], hair);
  shape(head, "Nose", [0, 0.02, 0.143], [0.026, 0.037, 0.023], skin);
  for (const side of [-1, 1]) {
    shape(
      head,
      `Ear${side}`,
      [side * 0.159, 0.033, 0],
      [0.03, 0.065, 0.023],
      skin,
    );
    shape(
      head,
      `Eye${side}`,
      [side * 0.059, 0.073, 0.128],
      [0.033, 0.018, 0.014],
      white,
    );
    shape(
      head,
      `Iris${side}`,
      [side * 0.059, 0.073, 0.14],
      [0.014, 0.015, 0.006],
      iris,
    );
    const brow = bone(
      head,
      side === 1 ? "LeftBrow" : "RightBrow",
      side * 0.06,
      0.118,
      0.137,
    );
    shape(brow, `BrowMesh${side}`, [0, 0, 0], [0.043, 0.008, 0.008], hair);
  }
  const jaw = bone(head, "Jaw", 0, -0.09, 0.08);
  const lip = new THREE.MeshStandardMaterial({ color: "#9a5a52", roughness: 0.6 });
  shape(jaw, "Mouth", [0, 0.023, 0.05], [0.04, 0.005, 0.005], new THREE.MeshStandardMaterial({ color: "#5a2f2c" }));
  shape(jaw, "UpperLip", [0, 0.029, 0.052], [0.037, 0.007, 0.009], lip);
  shape(jaw, "LowerLip", [0, 0.017, 0.051], [0.033, 0.0075, 0.0095], lip);
  for (const side of [-1, 1]) {
    // Eyelids start open (scaled flat, tucked above the eye) and are driven by updateIdle().
    const lid = shape(head, `Eyelid${side}`, [side * 0.059, 0.087, 0.131], [0.036, 0.0, 0.017], skin);
    lid.userData.openY = 0.087;
  }
  for (const [side, direction] of [
    ["Left", 1],
    ["Right", -1],
  ] as const) {
    const shoulder = bone(spine, `${side}Shoulder`, direction * 0.29, 0.37);
    const arm = bone(shoulder, `${side}UpperArm`, 0, 0);
    arm.rotation.z = direction * 0.13;
    limb(arm, `${side}Sleeve`, 0.0, 0.2, 0.098, 0.1, shirt);
    limb(arm, `${side}ArmSkin`, 0.17, 0.31, 0.066, 0.07, skin);
    const elbow = bone(arm, `${side}Forearm`, 0, -0.31);
    shape(elbow, `${side}ElbowJoint`, [0, 0, 0], [0.06, 0.06, 0.062], skin);
    limb(elbow, `${side}ForearmSkin`, 0.0, 0.29, 0.058, 0.062, skin);
    const hand = bone(elbow, `${side}Hand`, 0, -0.28);
    shape(hand, `${side}WristJoint`, [0, 0.0, 0], [0.043, 0.03, 0.036], skin);
    shape(hand, `${side}Palm`, [0, -0.05, 0.004], [0.057, 0.08, 0.024], skin);
    shape(hand, `${side}PalmHeel`, [0, -0.02, 0.004], [0.05, 0.04, 0.026], skin);
    ["Index", "Middle", "Ring", "Little"].forEach((finger, index) => {
      let parent: THREE.Object3D = hand;
      const length = [0.033, 0.038, 0.035, 0.028][index];
      for (let joint = 1; joint <= 3; joint++) {
        const b = bone(
          parent,
          `${side}${finger}${joint}`,
          joint === 1 ? direction * (index - 1.5) * 0.025 : 0,
          joint === 1 ? -0.1 : -length,
          joint === 1 ? 0.005 : 0,
        );
        const radius = [0.0125, 0.0135, 0.0125, 0.0105][index] * (joint === 3 ? 0.92 : 1);
        limb(b, `${b.name}Skin`, 0, length, radius, radius * 1.04, skin);
        parent = b;
      }
    });
    let parent: THREE.Object3D = hand;
    for (let joint = 1; joint <= 3; joint++) {
      const b = bone(
        parent,
        `${side}Thumb${joint}`,
        joint === 1 ? -direction * 0.045 : 0,
        joint === 1 ? -0.035 : -0.027,
        joint === 1 ? 0.01 : 0,
      );
      if (joint === 1) b.rotation.z = -direction * 0.65;
      const thumbRadius = [0.0165, 0.0145, 0.0128][joint - 1];
      limb(b, `${b.name}Skin`, 0, joint === 1 ? 0.04 : 0.032, thumbRadius, thumbRadius, skin);
      parent = b;
    }
  }
  return root;
}
/**
 * Non-signing life: blinking and breathing. Touches only meshes/bones that no sign clip animates
 * (eyelids, spine scale), so it can never alter a sign pose. Safe to call every frame.
 */
export function updateIdle(root: THREE.Object3D, seconds: number) {
  const phase = seconds % 4.2;
  const blink = phase > 4.0 ? Math.sin(((phase - 4.0) / 0.2) * Math.PI) : 0; // 0 open … 1 closed
  root.traverse((object) => {
    if (object.name.startsWith("Eyelid")) {
      object.scale.y = 0.0001 + blink * 0.021;
      object.position.y = (object.userData.openY as number) - blink * 0.014;
    }
  });
  const spine = root.getObjectByName("Spine");
  if (spine) spine.scale.set(1 + Math.sin(seconds * 1.6) * 0.004, 1 + Math.sin(seconds * 1.6) * 0.006, 1);
}
export function disposeAvatar(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (Array.isArray(object.material)
        ? object.material
        : [object.material]
      ).forEach((material) => materials.add(material));
    }
  });
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) value.dispose();
    });
    material.dispose();
  });
}
