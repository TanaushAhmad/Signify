/**
 * Emirati Sign Language (ESL) pack.
 *
 * ESL is a real, distinct language of the UAE Deaf community (official dictionary: Zayed Higher
 * Organization for People of Determination, adopted by Cabinet Decision 38/2018, ~5,000 signs).
 * It is NOT ASL and NOT "Unified Arabic Sign Language". This pack therefore contains ONLY signs
 * whose form is described in a published source we could cite. Everything else is listed as
 * `pending`: the app recognises the word and says the sign has not been captured, instead of
 * performing an invented sign.
 *
 * Every sign here is validation:"draft" — an approximation of a TEXT description, never reviewed
 * by a Deaf Emirati signer. Add real signs with the Sign Capture tool (/record-gesture), then have
 * a Deaf Emirati signer review them against the official dictionary: https://www.za.gov.ae/Sign-Language-Dictionary
 */
import { q, posed, posedTo, anchor, v3, flared } from "./rig-authoring.mjs";
import { facing } from "./everyday-signs.mjs";
import { rest } from "./rig-authoring.mjs";
import { buildPack } from "./lib/pack-builder.mjs";

const EURONEWS = "https://www.euronews.com/2020/07/03/why-isn-t-there-one-unified-sign-language-in-the-middle-east-region";
const HANDSPEAK_DUBAI = "https://www.handspeak.com/word/7784/";

// COFFEE (قهوة): "the gesture for coffee involves shaking an imaginary cup" (Euronews, 2020) — as
// opposed to lifting a cup to the lips, as in some Levantine signs. Authored: a small-cup grip held
// in front of the body, rocked from the forearm three times.
const cupGrip = { Index: [0.9, 1.0, 0.55], Middle: [1.0, 1.1, 0.6], Ring: [1.05, 1.15, 0.6], Little: [1.1, 1.2, 0.6] };
const cupThumb = [[0.35, 0, 0.45], [0.35, 0, 0], [0.12, 0, 0]];
const cupBase = facing([0, 0.35, 1], [1, 0, 0]);
const cup = (roll) => flared(0.9, () => posed([-0.2, 1.3, 0.3], cupBase.clone().multiply(q(0, roll * 0.45, 0)), cupGrip, cupThumb));

// DUBAI (دبي): Handspeak records the UAE sign loaned into ASL: dominant horizontal "G" handshape,
// palm facing sideways, moves toward the nose, nose tip between index finger and thumb.
const gHand = { Middle: 1, Ring: 1, Little: 1 };
const gThumb = [[0.1, 0, 0.5], [0.05, 0, 0], [0.03, 0, 0]];
// Described as horizontal; pitched ~40° so the wrist stays within the avatar's arm reach.
const gOrient = facing([0, 0.8, -0.6], [1, 0, 0]);
const nose = (away) => flared(1.0, () => posedTo("IndexThumbGap", anchor.nose.clone().add(v3(-away * 0.4, -away * 0.5, away * 0.5 + 0.018)), gOrient, gHand, gThumb));

const specs = [
  {
    id: "coffee", label: "Coffee", labelAr: "قهوة", aliases: ["قهوة", "gahwa", "Arabic coffee"],
    reference: EURONEWS, hands: "right",
    note: "Draft from a published description: a held imaginary cup is shaken (not lifted to the lips).",
    anchors: [[0, rest], [0.7, cup(0)], [1.0, cup(-1)], [1.3, cup(1)], [1.6, cup(-1)], [1.9, cup(1)], [2.2, cup(0)], [2.5, cup(0)], [3.1, rest]],
  },
  {
    id: "dubai", label: "Dubai", labelAr: "دبي", aliases: ["دبي"],
    reference: HANDSPEAK_DUBAI, hands: "right",
    note: "Draft from a published description: horizontal G hand, palm sideways, nose tip between index finger and thumb.",
    anchors: [[0, rest], [0.8, nose(0.14)], [1.25, nose(0)], [1.6, nose(0)], [2.0, nose(0.14)], [2.7, rest]],
  },
];

// Words the project intends to support. Listed so the app can say "planned, not captured" rather than
// "unknown" — and so reviewers know the backlog. Sources for the service-phrase set: Etisalat/e& staff
// training on ESL (greetings, "How can I help you today?", payment/ID phrases) and the dictionary's
// published chapters (alphabet, official documents, family, places).
const pending = [
  ["Peace be upon you", "السلام عليكم", ["Assalamu alaikum", "As-salamu alaykum", "Salam"], "Standard UAE greeting; used in service training."],
  ["Hello", "مرحبا", ["Marhaba", "Ahlan"], ""],
  ["Welcome", "اهلا وسهلا", ["Ahlan wa sahlan"], ""],
  ["Thank you", "شكرا", ["Shukran"], ""],
  ["Thank you very much", "شكرا جزيلا", [], ""],
  ["Please", "من فضلك", ["Min fadlak"], ""],
  ["Yes", "نعم", [], ""],
  ["No", "لا", [], ""],
  ["Goodbye", "مع السلامه", ["Ma'a salama", "Bye"], ""],
  ["How can I help you?", "كيف استطيع مساعدتك", ["How can I help you today"], "Customer-service phrase from ESL staff training."],
  ["What is your name?", "ما اسمك", ["Shu ismak"], ""],
  ["Water", "ماء", ["مي"], ""],
  ["Food", "طعام", ["اكل"], ""],
  ["Mother", "ام", ["ماما", "Mama"], "Dictionary 'family' chapter."],
  ["Father", "اب", ["بابا", "Baba"], "Dictionary 'family' chapter."],
  ["Family", "عائله", ["اسره"], "Dictionary 'family' chapter."],
  ["Help", "مساعده", [], ""],
  ["Hospital", "مستشفى", [], ""],
  ["Doctor", "طبيب", ["دكتور"], ""],
  ["Bank", "بنك", ["مصرف"], ""],
  ["School", "مدرسه", [], ""],
  ["Emirates ID", "الهويه الاماراتيه", ["Emirates identity"], "Official-documents chapter; service training."],
  ["Salary certificate", "شهاده راتب", [], "Official-documents chapter; service training."],
  ["People of Determination ID", "بطاقه اصحاب الهمم", [], "Service training."],
  ["Ghutra", "غتره", ["Headdress"], "Culture-specific sign cited by the dictionary's compilers (Euronews)."],
  ["Henna", "حناء", ["حنا"], "Culture-specific; multiple signs exist per Euronews."],
  ["Oud", "عود", ["Oud perfume"], "Culture-specific; multiple signs exist per Euronews."],
].map(([label, labelAr, aliases, note]) => ({ label, labelAr, aliases, ...(note ? { note } : {}) }));

const review = (spec) => ({
  source: spec.reference,
  license: "Project-authored draft keyframes from a published text description; no source media redistributed",
  validation: "draft",
  reviewedBy: "",
  reviewedOn: "",
});
buildPack({
  language: "ESL",
  dir: "public/signing/esl",
  catalogPath: "public/signing/esl/catalog.json",
  captureDir: "captures/ESL",
  specs, review, pending,
  title: "Emirati Sign Language (ESL) draft pack",
  notes: "DRAFT — NOT REVIEWED. Only signs with a citable published description are animated. They approximate text and must be reviewed by a Deaf Emirati signer against the official Emirati Sign Language Dictionary (Zayed Higher Organization for People of Determination, https://www.za.gov.ae/Sign-Language-Dictionary) before any real use. ESL differs between emirates; the dictionary is the unified reference.",
});
console.log(`Built ${specs.length} ESL draft clips (${specs.map((s) => s.label).join(", ")}) + ${pending.length} pending vocabulary entries.`);
