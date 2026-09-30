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
  shape(
    jaw,
    "Mouth",
    [0, 0.023, 0.05],
    [0.04, 0.005, 0.005],
    new THREE.MeshStandardMaterial({ color: "#754642" }),
  );
  for (const [side, direction] of [
    ["Left", 1],
    ["Right", -1],
  ] as const) {
    const shoulder = bone(spine, `${side}Shoulder`, direction * 0.29, 0.37);
    const arm = bone(shoulder, `${side}UpperArm`, 0, 0);
    arm.rotation.z = direction * 0.13;
    shape(arm, `${side}Sleeve`, [0, -0.11, 0], [0.102, 0.16, 0.104], shirt);
    shape(arm, `${side}ArmSkin`, [0, -0.21, 0], [0.071, 0.14, 0.074], skin);
    const elbow = bone(arm, `${side}Forearm`, 0, -0.31);
    shape(
      elbow,
      `${side}ForearmSkin`,
      [0, -0.13, 0],
      [0.062, 0.155, 0.066],
      skin,
    );
    const hand = bone(elbow, `${side}Hand`, 0, -0.28);
    shape(hand, `${side}Palm`, [0, -0.047, 0.005], [0.055, 0.077, 0.026], skin);
    ["Index", "Middle", "Ring", "Little"].forEach((finger, index) => {
      let parent: THREE.Object3D = hand;
      const length = [0.033, 0.038, 0.035, 0.028][index];
      for (let joint = 1; joint <= 3; joint++) {
        const b = bone(
          parent,
          `${side}${finger}${joint}`,
          joint === 1 ? (index - 1.5) * 0.025 : 0,
          joint === 1 ? -0.1 : -length,
          0.005,
        );
        shape(
          b,
          `${b.name}Skin`,
          [0, -length / 2, 0],
          [0.012, length * 0.67, 0.013],
          skin,
        );
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
        0.01,
      );
      if (joint === 1) b.rotation.z = -direction * 0.65;
      shape(b, `${b.name}Skin`, [0, -0.014, 0], [0.014, 0.022, 0.014], skin);
      parent = b;
    }
  }
  return root;
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
