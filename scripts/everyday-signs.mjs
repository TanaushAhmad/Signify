import * as THREE from "three";
import { arm, posed, q, rest, question, posedTo, twoHand, anchor, v3, palmOf, wristOf, flared } from "./rig-authoring.mjs";
const standoff = (p, dx = 0, dy = 0, dz = 0.012) => p.clone().add(v3(dx, dy, dz));
const T = {
  mouth: standoff(anchor.mouth, 0, -0.004),
  chin: standoff(anchor.chin),
  forehead: standoff(anchor.forehead, -0.04, 0, 0.012),
  chest: v3(-0.085, 1.15, 0.205),
};
const PALM_GAP = 0.058; // centre-to-centre distance of two palms resting face to face
const fist = { Index: 1, Middle: 1, Ring: 1, Little: 1 };
const spread = { Index: -0.18, Middle: -0.05, Ring: 0.1, Little: 0.24 };
const h = { Ring: 1, Little: 1 };
// Palm points along local -Z; the finger chain extends along local -Y.
function facing(fingers, palm) {
  const y = new THREE.Vector3(...fingers).normalize().negate();
  const z = new THREE.Vector3(...palm).normalize().negate();
  const x = y.clone().cross(z).normalize();
  z.copy(x).cross(y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const upForward = facing([0, 0, 1], [0, 1, 0]);
const downForward = facing([0, 0, 1], [0, -1, 0]);
function both(right, left) {
  return arm(posed(...right), "Left", ...left);
}
function anchors(poses) {
  return [[0, rest], ...poses.map((pose, i) => [0.65 + i * 0.38, pose]),
    [1.05 + (poses.length - 1) * 0.38, poses.at(-1)], [1.7 + (poses.length - 1) * 0.38, rest]];
}
function spec(id, label, reference, description, poses, hands = "right", aliases = []) {
  return { id, label, reference, note: description, anchors: anchors(poses), hands, aliases };
}
const circle = (closed) => Array.from({ length: 13 }, (_, i) => {
  const angle = i * Math.PI / 3;
  return posedTo("Palm", T.chest.clone().add(v3(Math.sin(angle) * 0.055, Math.cos(angle) * 0.055, 0)),
    q(0, 0, Math.PI), closed ? fist : {}, closed ? "a" : "flat", 0, closed ? 0.1 : 0);
});
const help = (lift) => twoHand(
  [[0.03, 1.1 + lift, 0.29], facing([-1, 0, 0], [0, 1, 0]), {}, "flat"],
  { point: "Palm", target: () => palmOf("Left").add(v3(0, PALM_GAP, 0)), orientation: q(Math.PI), folds: fist, thumb: "a" });
const name = (lift) => both(
  [[-0.11, 1.16 + lift, 0.3], facing([1, 0, 0], [0, -1, 0]), h, "fist"],
  [[0.1, 1.11, 0.23], downForward, h, "fist"]);
const school = (lift) => twoHand(
  [[0.025, 1.025, 0.26], upForward, {}, "flat"],
  { point: "Palm", target: () => palmOf("Left").add(v3(0, PALM_GAP + lift, 0)), orientation: downForward, folds: {}, thumb: "flat" });
const work = (lift) => twoHand(
  [[0.055, 1.05, 0.31], facing([-1, 0, 0], [0, -1, 0]), fist, "fist"],
  { point: "Palm", target: () => palmOf("Left").add(v3(0, PALM_GAP + lift, 0)), orientation: downForward, folds: fist, thumb: "fist" });
const family = (t) => {
  const x = 0.1 + 0.14 * Math.sin(t * Math.PI);
  const z = 0.22 + t * 0.2;
  const shape = { Index: [0.8, 1.35, 0.7] };
  return both([[-x, 1.2, z], q(Math.PI, -t * Math.PI / 2, 0), shape, "pinch", spread],
    [[x, 1.2, z], q(Math.PI, t * Math.PI / 2, 0), shape, "pinch", spread]);
};
const gathered = { Index: [1.05, 0.65, 0.35], Middle: [1.1, 0.7, 0.35], Ring: [1.05, 0.65, 0.35], Little: [0.95, 0.6, 0.3] };
const food = (near) => flared(1.0, () => posedTo("MiddleTip", near ? T.mouth : T.mouth.clone().add(v3(0, -0.015, 0.07)), q(0, 0, Math.PI),
  gathered, [[0.85, -0.5, -0.5], [0.65, 0, 0], [0.3, 0, 0]]));
const water = (near) => flared(1.0, () => posedTo("IndexTip", near ? T.chin : T.chin.clone().add(v3(0, -0.01, 0.06)), q(0, 0, Math.PI),
  { Little: 1 }, "fist", 0, 0, { Index: -0.2, Middle: 0, Ring: 0.2 }));
// 5-hand beside the face, palm facing the signer's left, thumb tip on the chin (MOTHER) or forehead (FATHER).
const parent = (target, near) => flared(1.5, () => posedTo("ThumbTip", near ? target : target.clone().add(v3(0, 0, 0.06)),
  facing([0, 1, 0], [1, 0, 0]), {}, "open", 0, 0, spread));
const where = (angle) => question(posed([-0.24, 1.29, 0.3], q(Math.PI, 0, angle),
  { Middle: 1, Ring: 1, Little: 1 }, "fist"));
const what = (distance) => question(both(
  [[-0.24 - distance, 1.08, 0.3 + distance], upForward, {}, "open", spread],
  [[0.24 + distance, 1.08, 0.3 + distance], upForward, {}, "open", spread]));
export { T, PALM_GAP, facing, flared };
export const everyday = [
  spec("please", "Please", "p/please.htm", "Flat hand circles on the chest.", circle(false)),
  spec("sorry", "Sorry", "s/sorry.htm", "A hand circles on the chest; apologetic head inclination.", circle(true)),
  spec("help", "Help", "h/help.htm", "The base palm lifts the dominant loose-thumb fist. Neutral HELP, without directional inflection.", [help(0), help(0), help(0.14), help(0.14)], "both"),
  spec("welcome", "Welcome", "w/welcome.htm", "Invitation sense: flat palm draws inward. Not a response to thank you.",
    [posed([-0.34, 1.12, 0.44], upForward, {}, "flat"), posed([-0.26, 1.12, 0.34], upForward, {}, "flat"), posed([-0.18, 1.12, 0.23], upForward, {}, "flat")]),
  spec("name", "Name", "n/name.htm", "Two H hands cross and tap twice. The word NAME, not a person's name.", [name(0.08), name(0), name(0.08), name(0)], "both"),
  spec("family", "Family", "f/family.htm", "Two F hands trace an enclosing circle.", [0, 0.25, 0.5, 0.75, 1].map(family), "both"),
  spec("food", "Food", "f/food.htm", "Gathered fingertips approach the mouth twice (citation form).", [food(false), food(true), food(false), food(true)]),
  spec("eat", "Eat", "e/eat.htm", "Gathered fingertips approach the mouth once.", [food(false), food(true), food(true)]),
  spec("water", "Water", "w/water.htm", "W handshape approaches the mouth twice.", [water(false), water(true), water(false), water(true)]),
  spec("school", "School", "s/school.htm", "Dominant flat palm taps the upward base palm twice.", [school(0.1), school(0), school(0.1), school(0)], "both"),
  spec("work", "Work", "w/work.htm", "Employment/labor sense: dominant S fist taps the base fist/wrist twice.", [work(0.1), work(0), work(0.1), work(0)], "both"),
  spec("mother", "Mother", "m/mom.htm", "Open 5 hand, thumb near the chin.", [parent(T.chin, false), parent(T.chin, true), parent(T.chin, true)], "right", ["Mom"]),
  spec("father", "Father", "d/dad.htm", "Open 5 hand, thumb near the forehead.", [parent(T.forehead, false), parent(T.forehead, true), parent(T.forehead, true)], "right", ["Dad"]),
  spec("where", "Where", "w/where.htm", "Extended index, wrist pivots side to side; furrowed brows.", [-0.2, 0.2, -0.2, 0.2].map(where)),
  spec("what", "What", "w/what.htm", "Relaxed open palms move outward with furrowed brows (general question form).", [what(0), what(0.045), what(0), what(0.045)], "both"),
];
// The existing compound keeps its own continuous clip and gains the missing base arm.
export function morningSupport(pose, rising = false) {
  return arm(pose, "Left", rising ? [0.02, 1.14, 0.32] : [0.005, 1.075, 0.35],
    facing([-1, 0, 0], [0, 1, 0]), {}, "flat");
}
