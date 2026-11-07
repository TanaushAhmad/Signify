# Signify

Sign-language prototype: **text/speech → signing avatar** and **camera/video → text**, built with React, TypeScript, Vite, Three.js and MediaPipe. Languages: **ASL** (23-sign reference demo) and **Emirati Sign Language (ESL)** (draft).

## Run

```sh
npm install            # Node >= 22.18 (build scripts import TypeScript directly)
npm run dev            # predev copies the MediaPipe WASM and tries to download the 2 model files
npm run build:assets   # regenerate animation clips + catalogs (after editing scripts/*.mjs or captures/)
npm run verify:avatar  # contact-accuracy report against the rendered avatar meshes
npm run test:unit      # Vitest: recognizer, retargeting, languages, capture merge, ESL video landmarks
npm run test:browser   # Playwright (needs Google Chrome): UI flows
```

If the models can't be downloaded at install time the browser fetches them from Google on first use (needs internet once).

## 1. Video → text (rewritten)

What was wrong: uploaded videos were never analysed (a timer returned a rotating list of phrases); the classifier averaged frames and compared raw wrist-relative coordinates (so movement was ignored); camera access was fought over by two libraries; tracking used the deprecated CDN `@mediapipe/hands`.

Now (`src/signing/recognition/`):
- **Tracking**: MediaPipe Tasks Vision, both hands + body pose from one `<video>` (`tracker.ts`). Hands are assigned left/right by matching the body's wrists.
- **Features** (`features.ts`): finger curl, spread, pinch, palm normal, finger direction, and wrist position relative to the nose in upper-arm lengths, plus the other hand. Rotation- and size-invariant.
- **Matching** (`recognizer.ts`): weighted DTW against templates (speed-independent). It **rejects** instead of guessing: "no match" or "too close to call between X and Y".
- **Segmentation** (`segment.ts`): a recording is split into signs wherever the hands drop out of signing space. Uploads are analysed frame by frame by seeking (15 fps), so any format the browser can play works.
- **Closest sign wins**: if Thank you is 43% and Good morning 32%, it shows Thank you; the top three with confidences are listed under each detection. Only "nothing resembles any known sign" (or no hand) produces no answer.
- **Templates**: bootstrapped from the avatar's own clips (forward kinematics), so every sign the avatar can perform is recognisable, plus **trained examples** from real people saved permanently in `src/signing/gestureSignatures.ts` (see Sign Capture). Trained examples count for more.

Measured on avatar-generated landmarks (`tests/unit/recognizer.test.ts`): 23/23 on clean replay; 92/92 with 4 mm landmark jitter and 0.8–1.25× speed. On the five real ESL Zayed video signs, avatar-derived templates alone pick the right sign 5/5 (`tests/unit/esl-video.test.ts`), but that is **not independent evidence**: the same signer produced both the clips and the test. **Accuracy on other real signers has not been measured.** `maxDistance` in `recognizer.ts` should be tuned on real recordings.

## 2. Emirati Sign Language

- Language selector (conversation + recognition), Arabic text input with normalisation (diacritics, alef/ya/ta-marbuta variants), Arabic speech input (`ar-AE`), RTL text.
- **7 ESL signs, all `validation: "draft"`** (never reviewed by a Deaf signer):
  - From two ESL Zayed (Zayed Higher Organization) reference videos, retargeted from the signer's body and hand landmarks: **Salaam Alaikum / السلام عليكم, How are you / كيف حالك, Fine / بخير, Thank you / شكرا, You are welcome / عفوا**. Common spellings work (Assalamualaikum, assalmualikum, "I'm fine", "you're welcome", …).
  - From published text descriptions: **Coffee / قهوة**, **Dubai / دبي**.
- 25 **planned** words (Hello, Please, Hospital, Emirates ID, …) are recognised and reported as "not signed yet". Nothing is invented.
- **Video-derived data**: only landmark numbers and joint rotations are stored, never video or images (`scripts/data/*.json`, `captures/ESL/*.capture.json`, `src/signing/gestureSignatures.ts`). Confirm with the Zayed Higher Organization that publishing animations derived from their videos is permitted, and have a Deaf Emirati signer review them against the official dictionary (https://www.za.gov.ae/Sign-Language-Dictionary).
- **Re-importing videos**: `python3 scripts/extract-landmarks.py video.mp4 scripts/data/x.json` (needs `pip install mediapipe==0.10.14 opencv-python-headless`), describe the signs in `scripts/data/esl-import-plan.json`, then `npx tsx scripts/import-esl-videos.ts && npm run build:assets`.

## Sign Capture (`/record-gesture`)

Two separate trainers, each fed by a camera recording or uploaded videos (several at once in A):
- **A · Video → sign (recognition)**: label examples with an existing sign, add them, then **Save to gestureSignatures.ts**, which writes the file directly while `npm run dev` runs (or downloads it otherwise). Saved examples are listed per sign and can be removed.
- **B · Sign → avatar (animation)**: record or import a video (pick one sign if it contains several), preview on the avatar, then **Save to project** (writes `captures/<LANG>/<id>.capture.json` and rebuilds the catalog; or downloads the file). Saved as draft.

Captured arm positions are matched to the avatar's own proportions (hands raised to the face are placed relative to the nose, because the avatar's neck is longer than a real person's); contact is still approximate: the forehead salute in Thank you stops slightly short.

## 3. Avatar accuracy

- **Contact-based authoring** (`scripts/rig-authoring.mjs`: `armTo`, `posedTo`, `twoHand`): say which fingertip must touch which point and the solver finds the wrist using forward kinematics of the real rig. An unreachable pose is an error, not a silent approximation.
- **`npm run verify:avatar`** measures every contact against the rendered head mesh, the torso (raycast) and the other palm. On the same metric the original clips passed 4/13 contacts (face contacts missed by 3–12 cm); now 13/13 within 2–2.5 cm, and no sign sinks a hand more than 2.5 cm into the head.
- Elbow flare control so face signs don't hide the face (Hello was covering the eye).
- Motion: C1-continuous quaternion spline (no stop at every keyframe; holds stay still).
- Fluent sequences: signs blend hand-to-hand using each sign's `motion` window instead of returning to rest between words.
- Mesh: capsule limbs and fingers, lips, eyelids; idle blinking and breathing that never touch signing joints.

Still approximate: rigid segments (no skinned hand), no facial grammar beyond brows, handshape orientation unverified by a signer. **No clip has been reviewed by a qualified signer.**

## Verification status

Passed here: TypeScript, lint (0 errors), production build, 29 Vitest tests (including real ESL video landmarks), the original 4 non-browser Playwright tests, contact verification.
**Not run here**: the browser Playwright tests (no Chrome in the build environment; the UI test selectors were kept but three label strings changed on the video tab), live camera, live MediaPipe inference, live microphone.
